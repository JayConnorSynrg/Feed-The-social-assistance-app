// supabase/functions/resource-discover/index.ts
//
// Admin resource-sourcing — Phase B.
//
// Takes an admin natural-language query, sources candidate resources / forms via
// Firecrawl /v2/agent (Spark models), chosen here as the engine for autonomous
// multi-source discovery across many pages. (Firecrawl /extract remains available
// for single-page structured extraction; both coexist — /agent is the better fit
// for this open-ended discovery workload.) It verifies provenance, geocodes, and
// STAGES accepted candidates as
// status='pending' for human review in the Resources tab (Phase C). The admin
// later approves a pending tile via the existing approve_resource() SECDEF RPC.
//
// This function WRITES pending rows and RETURNS a summary. It NEVER auto-approves
// and NEVER returns ephemeral-only candidates as if they were live resources.
//
// Auth model: deployed with --no-verify-jwt, so the JWT is verified IN CODE and
// the caller MUST be an admin (is_current_user_admin()). Anonymous + non-admin
// callers are rejected before any provider call is made (cost gate).
//
// Provider keys (FIRECRAWL_API_KEY, FIREWORKS_API_KEY) are read from Deno.env and
// are NEVER exposed to the client. Writes use the service-role client (RLS bypass)
// and only after the admin gate has passed.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { edgeLog, getCorrelationId } from '../_shared/log.ts'

// ═══════════════════════════════════════════════════════════
// Env
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')
// Server-side Mapbox token for address-first geocoding. Set this as a Supabase
// edge-function secret named MAPBOX_TOKEN to activate precise street-level
// geocoding. When absent, geocoding degrades to ZIP-centroid lookup.
const MAPBOX_TOKEN = Deno.env.get('MAPBOX_TOKEN')

// ═══════════════════════════════════════════════════════════
// Constants — cost caps & valid enum sets
// ═══════════════════════════════════════════════════════════

const MAX_QUERY_LEN = 300
const DEFAULT_MAX_CANDIDATES = 25
const HARD_CAP_CANDIDATES = 25
const AGENT_POLL_BUDGET_MS = 30_000 // bounded async poll budget for /v2/agent (proxy-timeout hygiene)
const AGENT_POLL_INTERVAL_MS = 3_000

// resource_category enum (live values, fetched 2026-06-26). Used to constrain /
// normalize the agent's category output. Anything unmapped → 'other'.
const RESOURCE_CATEGORIES = new Set<string>([
  'food', 'housing', 'healthcare', 'employment', 'education', 'legal',
  'transportation', 'utilities', 'clothing', 'financial', 'mental_health',
  'substance_abuse', 'domestic_violence', 'childcare', 'senior_services',
  'disability_services', 'veteran_services', 'immigration', 'other',
  'eitc_tax_filing', 'free_legal', 'prenatal_natal_care', 'waste_disposal',
  'free_camping', 'free_goods_donation',
])

// form_type enum (live values, fetched 2026-06-26). Unmapped → 'general'.
const FORM_TYPES = new Set<string>([
  'snap', 'medicaid', 'tanf', 'wic', 'housing', 'utility',
  'unemployment', 'disability', 'childcare', 'general',
])

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type ContentType = 'resource' | 'form' | 'all'

interface DiscoverRequest {
  query?: string
  contentType?: ContentType
  maxCandidates?: number
}

interface ResourceCandidate {
  name?: string
  description?: string
  category?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  website?: string
  application_url?: string
  sources?: string[]
}

interface FormCandidate {
  name?: string
  form_type?: string
  description?: string
  agency_name?: string
  agency_website?: string
  application_url?: string
  sources?: string[]
}

interface Provenance {
  source_url: string | null
  confidence: 'high' | 'medium'
  corroborating_count: number
  authoritative_domain: boolean
  query: string
  discovered_at: string
  sources: string[]
}

// ═══════════════════════════════════════════════════════════
// Verification layer — the core value.
//
//   authoritative_domain = any source/website host ends in .gov or .org
//   corroborating_count  = number of DISTINCT source hosts
//   ACCEPT iff authoritative_domain === true OR corroborating_count >= 2
//   confidence: 'high'  if authoritative AND corroborating_count >= 2
//               'medium' if exactly one of the two holds
//               (rejected otherwise — returns null)
// ═══════════════════════════════════════════════════════════

function hostOf(url: string): string | null {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase()
    return h.startsWith('www.') ? h.slice(4) : h
  } catch {
    return null
  }
}

function isAuthoritativeHost(host: string): boolean {
  return host.endsWith('.gov') || host.endsWith('.org')
}

/**
 * Computes provenance for a candidate from its citation URLs (+ optional website).
 * Returns null when the candidate fails BOTH acceptance tests (→ drop, don't stage).
 */
function verify(query: string, sources: string[], website?: string | null): Provenance | null {
  const urls = [...sources]
  if (website) urls.push(website)

  const hosts = new Set<string>()
  let authoritative = false
  for (const u of urls) {
    const h = hostOf(u)
    if (!h) continue
    hosts.add(h)
    if (isAuthoritativeHost(h)) authoritative = true
  }

  const corroborating_count = hosts.size
  const accept = authoritative || corroborating_count >= 2
  if (!accept) return null

  const confidence: 'high' | 'medium' =
    authoritative && corroborating_count >= 2 ? 'high' : 'medium'

  const cleanSources = urls.filter((u) => hostOf(u) !== null)
  return {
    source_url: cleanSources[0] ?? null,
    confidence,
    corroborating_count,
    authoritative_domain: authoritative,
    query,
    discovered_at: new Date().toISOString(),
    sources: cleanSources,
  }
}

// ═══════════════════════════════════════════════════════════
// Normalization helpers
// ═══════════════════════════════════════════════════════════

function normalizeCategory(raw: string | undefined): string {
  if (!raw) return 'other'
  const c = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return RESOURCE_CATEGORIES.has(c) ? c : 'other'
}

function normalizeFormType(raw: string | undefined): string {
  if (!raw) return 'general'
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return FORM_TYPES.has(t) ? t : 'general'
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone.trim() || null
}

function cleanUrl(url: string | undefined): string | null {
  if (!url) return null
  const u = url.trim()
  return /^https?:\/\/.+/.test(u) ? u : null
}

function buildExternalId(name: string): string {
  return `discover_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}`
}

function buildFormId(name: string): string {
  return `discover_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50)}_${Date.now().toString(36)}`
}

function collectSources(c: { sources?: string[]; website?: string | null; application_url?: string | null; agency_website?: string | null }): string[] {
  const out: string[] = []
  if (Array.isArray(c.sources)) out.push(...c.sources.filter((s) => typeof s === 'string'))
  for (const extra of [c.website, c.application_url, c.agency_website]) {
    if (extra) out.push(extra)
  }
  return out
}

// ═══════════════════════════════════════════════════════════
// Firecrawl /v2/agent — async job: POST returns {id}; poll GET until completed.
//
// Schema requests an array of resource + form candidates, each with per-field
// source_url citations. If the plan lacks /agent or the job does not complete
// within the poll budget, the caller falls back to /v2/search.
// ═══════════════════════════════════════════════════════════

function buildAgentSchema(contentType: ContentType) {
  const resourceItem = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string', description: 'one of the FEED resource categories e.g. food, housing, healthcare, legal, financial' },
      address_line1: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zip_code: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      website: { type: 'string' },
      application_url: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' }, description: 'citation URLs that confirm this candidate' },
    },
    required: ['name', 'sources'],
  }
  const formItem = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      form_type: { type: 'string', description: 'one of: snap, medicaid, tanf, wic, housing, utility, unemployment, disability, childcare, general' },
      description: { type: 'string' },
      agency_name: { type: 'string' },
      agency_website: { type: 'string' },
      application_url: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' }, description: 'citation URLs that confirm this form' },
    },
    required: ['name', 'sources'],
  }
  const properties: Record<string, unknown> = {}
  if (contentType === 'resource' || contentType === 'all') {
    properties.resources = { type: 'array', items: resourceItem }
  }
  if (contentType === 'form' || contentType === 'all') {
    properties.forms = { type: 'array', items: formItem }
  }
  return { type: 'object', properties }
}

interface AgentResult {
  resources: ResourceCandidate[]
  forms: FormCandidate[]
  via: 'agent' | 'search'
}

async function sourceViaAgent(query: string, contentType: ContentType, maxCandidates: number): Promise<AgentResult | null> {
  if (!FIRECRAWL_API_KEY) return null

  const prompt =
    `Find up to ${maxCandidates} real, currently-operating mutual-aid / public-benefit ` +
    `${contentType === 'form' ? 'benefit application forms' : 'community resources'} for: "${query}". ` +
    `For each, include every verifiable field and a "sources" array of citation URLs ` +
    `(prefer official .gov / .org pages). Only include candidates you can cite.`

  // Kick off the async job.
  let jobId: string
  try {
    const resp = await fetch('https://api.firecrawl.dev/v2/agent', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, schema: buildAgentSchema(contentType) }),
    })
    if (!resp.ok) {
      edgeLog('warn', 'discover.agent.start_failed', { status: resp.status })
      return null
    }
    const json = await resp.json()
    if (!json?.success || !json?.id) {
      edgeLog('warn', 'discover.agent.no_id', {})
      return null
    }
    jobId = json.id
  } catch (e) {
    edgeLog('warn', 'discover.agent.start_error', { error: e instanceof Error ? e.message : String(e) })
    return null
  }

  // Poll within a bounded budget.
  const deadline = Date.now() + AGENT_POLL_BUDGET_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, AGENT_POLL_INTERVAL_MS))
    try {
      const resp = await fetch(`https://api.firecrawl.dev/v2/agent/${jobId}`, {
        headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
      })
      if (!resp.ok) continue
      const json = await resp.json()
      const status = json?.status
      if (status === 'completed') {
        const data = json?.data ?? {}
        const resources = Array.isArray(data.resources) ? data.resources : []
        const forms = Array.isArray(data.forms) ? data.forms : []
        edgeLog('info', 'discover.agent.completed', { jobId, resources: resources.length, forms: forms.length })
        return { resources, forms, via: 'agent' }
      }
      if (status === 'failed' || status === 'cancelled') {
        edgeLog('warn', 'discover.agent.terminal', { jobId, status })
        return null
      }
    } catch {
      // transient — keep polling within budget
    }
  }
  edgeLog('warn', 'discover.agent.timeout', { jobId, budgetMs: AGENT_POLL_BUDGET_MS })
  return null
}

// Degraded fallback: /v2/search returns {url,title,description} per hit. Each hit
// becomes a thin resource candidate whose only source is its own URL — it will
// only survive verification when that host is authoritative (.gov/.org), which is
// the correct strict behaviour.
async function sourceViaSearch(query: string, maxCandidates: number): Promise<AgentResult | null> {
  if (!FIRECRAWL_API_KEY) return null
  try {
    const resp = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: Math.min(maxCandidates, 10) }),
    })
    if (!resp.ok) {
      edgeLog('warn', 'discover.search.failed', { status: resp.status })
      return null
    }
    const json = await resp.json()
    const web = json?.data?.web ?? []
    // deno-lint-ignore no-explicit-any
    const resources: ResourceCandidate[] = (web as any[]).map((w) => ({
      name: (w.title || '').replace(/\s*[-|:–].*$/, '').trim() || w.title,
      description: w.description,
      website: w.url,
      sources: [w.url],
    })).filter((r) => r.name)
    edgeLog('info', 'discover.search.completed', { resources: resources.length })
    return { resources, forms: [], via: 'search' }
  } catch (e) {
    edgeLog('warn', 'discover.search.error', { error: e instanceof Error ? e.message : String(e) })
    return null
  }
}

// ═══════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════

interface StageContext {
  service: SupabaseClient
  adminId: string
  query: string
}

async function geocodeByZip(service: SupabaseClient, zip: string): Promise<{ lat: number; lng: number } | null> {
  const z = zip.trim().slice(0, 5)
  if (!/^\d{5}$/.test(z)) return null
  const { data } = await service.from('zip_centroids').select('lat, lng').eq('zip', z).maybeSingle()
  if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
    return { lat: data.lat, lng: data.lng }
  }
  return null
}

/**
 * Precise street-level geocode via the Mapbox Geocoding API (server-side). Returns
 * null when no MAPBOX_TOKEN is configured, the address is unusable, or Mapbox
 * returns no result. Never throws — failures degrade to the ZIP-centroid path.
 */
async function geocodeByAddressMapbox(
  parts: { address_line1?: string | null; city?: string | null; state?: string | null; zip_code?: string | null },
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null
  const segments = [parts.address_line1, parts.city, parts.state, parts.zip_code]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
  // Require at least a street line plus one locality component for a meaningful
  // forward geocode; otherwise let the ZIP-centroid fallback handle it.
  if (!parts.address_line1?.trim() || segments.length < 2) return null
  const queryStr = segments.join(', ')
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(queryStr)}.json` +
      `?access_token=${MAPBOX_TOKEN}&country=US&types=address&limit=1`
    const resp = await fetch(url)
    if (!resp.ok) {
      edgeLog('warn', 'discover.geocode.mapbox_failed', { status: resp.status })
      return null
    }
    const json = await resp.json()
    const center = json?.features?.[0]?.center
    if (Array.isArray(center) && typeof center[0] === 'number' && typeof center[1] === 'number') {
      // Mapbox returns [lng, lat].
      return { lat: center[1], lng: center[0] }
    }
    return null
  } catch (e) {
    edgeLog('warn', 'discover.geocode.mapbox_error', { error: e instanceof Error ? e.message : String(e) })
    return null
  }
}

/**
 * Address-first geocoding: precise Mapbox street geocode when an address +
 * MAPBOX_TOKEN are available, falling back to the ZIP centroid otherwise.
 * Returns null when neither path resolves (location legitimately stays null).
 */
async function geocodeCandidate(
  service: SupabaseClient,
  parts: { address_line1?: string | null; city?: string | null; state?: string | null; zip_code?: string | null },
): Promise<{ lat: number; lng: number } | null> {
  const byAddress = await geocodeByAddressMapbox(parts)
  if (byAddress) return byAddress
  if (parts.zip_code) return await geocodeByZip(service, parts.zip_code)
  return null
}

/**
 * Dedup check: approved-resource fuzzy match via find_duplicate_resource PLUS a
 * direct pending-name match (find_duplicate_resource scans approved only).
 */
async function isDuplicateResource(
  service: SupabaseClient,
  name: string,
  phone: string | null,
  address: string | null,
): Promise<boolean> {
  const { data: dupes } = await service.rpc('find_duplicate_resource', {
    p_name: name,
    p_phone: phone,
    p_address: address,
    p_threshold: 0.4,
  })
  if (Array.isArray(dupes) && dupes.length > 0) {
    const best = dupes[0]
    const phoneMatch =
      phone && best.phone && best.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, '')
    if (best.similarity_score >= 0.6 || phoneMatch) return true
  }
  // Pending-name match (case-insensitive) — find_duplicate_resource ignores pending.
  const { data: pending } = await service
    .from('resources')
    .select('id')
    .eq('status', 'pending')
    .ilike('name', name.trim())
    .limit(1)
  return Array.isArray(pending) && pending.length > 0
}

// ═══════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════

serve(async (req: Request) => {
  const t0 = performance.now()
  const correlationId = getCorrelationId(req)
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, 'resource-discover')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── AUTH GATE: verify JWT in-code (deployed --no-verify-jwt) + require admin ──
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client bound to the caller token — used ONLY to identify + authorize the caller.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser(token)
    if (userErr || !user || user.is_anonymous) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isAdmin, error: adminErr } = await callerClient.rpc('is_current_user_admin')
    if (adminErr || isAdmin !== true) {
      edgeLog('warn', 'discover.forbidden', { userId: user.id, correlationId })
      return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── INPUT ──
    let body: DiscoverRequest
    try { body = await req.json() } catch { body = {} }

    const query = (body.query ?? '').trim()
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (query.length > MAX_QUERY_LEN) {
      return new Response(JSON.stringify({ error: `query exceeds ${MAX_QUERY_LEN} characters` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const contentType: ContentType =
      body.contentType === 'resource' || body.contentType === 'form' ? body.contentType : 'all'
    const maxCandidates = Math.min(
      HARD_CAP_CANDIDATES,
      Math.max(1, Number.isFinite(body.maxCandidates) ? Number(body.maxCandidates) : DEFAULT_MAX_CANDIDATES),
    )

    if (!FIRECRAWL_API_KEY) {
      edgeLog('error', 'discover.no_firecrawl_key', {})
      return new Response(JSON.stringify({ error: 'Sourcing provider not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    edgeLog('info', 'discover.start', { userId: user.id, contentType, maxCandidates, queryLen: query.length, correlationId })

    // ── SOURCING (one /agent call per request; degrade to /search on miss) ──
    let sourced = await sourceViaAgent(query, contentType, maxCandidates)
    if (!sourced) {
      sourced = await sourceViaSearch(query, maxCandidates)
    }
    if (!sourced) {
      return new Response(JSON.stringify({ error: 'Sourcing failed', staged: { resources: 0, forms: 0 }, deduped: 0, rejected: 0, candidates: [] }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const ctx: StageContext = { service, adminId: user.id, query }

    let stagedResources = 0
    let stagedForms = 0
    let deduped = 0
    let rejected = 0
    const summaries: Array<{ kind: 'resource' | 'form'; name: string; confidence: string; sources: string[] }> = []

    // ── RESOURCES ──
    const rawResources = (sourced.resources ?? []).slice(0, maxCandidates)
    for (const cand of rawResources) {
      const name = (cand.name ?? '').trim()
      if (!name || name.length < 2) { rejected++; continue }

      const prov = verify(query, collectSources(cand), cleanUrl(cand.website))
      if (!prov) { rejected++; continue }

      const phone = normalizePhone(cand.phone)
      const address = cand.address_line1?.trim() || null
      if (await isDuplicateResource(ctx.service, name, phone, address)) { deduped++; continue }

      // Address-first geocode (Mapbox precise → ZIP-centroid fallback). Resolve
      // BEFORE insert so the resolved location classifies content_type.
      const geo = await geocodeCandidate(ctx.service, {
        address_line1: address,
        city: cand.city?.trim() || null,
        state: cand.state?.trim() || null,
        zip_code: cand.zip_code?.trim() || null,
      })
      // A physical resource resolves to a location; a candidate with a URL but no
      // resolvable location is an informational site-link.
      const contentTypeStamp: 'resource' | 'link' =
        geo ? 'resource' : 'link'

      const row = {
        external_id: buildExternalId(name),
        source: 'admin_added',
        name,
        category: normalizeCategory(cand.category),
        description: cand.description?.trim() || null,
        address_line1: address,
        city: cand.city?.trim() || null,
        state: cand.state?.trim() || null,
        zip_code: cand.zip_code?.trim() || null,
        phone,
        email: cand.email?.trim() || null,
        website: cleanUrl(cand.website),
        application_url: cleanUrl(cand.application_url),
        status: 'pending',
        submitted_by: ctx.adminId,
        moderated_by: null,
        is_verified: false,
        discovery_metadata: { ...prov, content_type: contentTypeStamp },
      }

      const { data: inserted, error: insErr } = await ctx.service
        .from('resources')
        .insert(row)
        .select('id')
        .single()
      if (insErr || !inserted) {
        edgeLog('warn', 'discover.resource.insert_failed', { name, error: insErr?.message })
        rejected++
        continue
      }

      // Set PostGIS location via RPC when geocoding resolved a point.
      if (geo) {
        await ctx.service.rpc('set_resource_location_by_id', {
          p_id: inserted.id, p_lat: geo.lat, p_lng: geo.lng,
        })
      }

      stagedResources++
      summaries.push({ kind: 'resource', name, confidence: prov.confidence, sources: prov.sources.slice(0, 5) })
    }

    // ── FORMS ──
    const rawForms = (sourced.forms ?? []).slice(0, maxCandidates)
    for (const cand of rawForms) {
      const name = (cand.name ?? '').trim()
      if (!name || name.length < 2) { rejected++; continue }

      const prov = verify(query, collectSources(cand), cleanUrl(cand.agency_website))
      if (!prov) { rejected++; continue }

      // Pending/inactive duplicate check by name.
      const { data: dupForm } = await ctx.service
        .from('form_templates')
        .select('id')
        .ilike('name', name)
        .limit(1)
      if (Array.isArray(dupForm) && dupForm.length > 0) { deduped++; continue }

      const formRow = {
        id: buildFormId(name),
        name,
        form_type: normalizeFormType(cand.form_type),
        description: cand.description?.trim() || null,
        schema: {}, // empty schema placeholder; reviewer completes before activation
        agency_name: cand.agency_name?.trim() || null,
        agency_website: cleanUrl(cand.agency_website),
        is_active: false,
        discovery_metadata: { ...prov, content_type: 'form', application_url: cleanUrl(cand.application_url) },
      }

      const { error: formErr } = await ctx.service.from('form_templates').insert(formRow)
      if (formErr) {
        edgeLog('warn', 'discover.form.insert_failed', { name, error: formErr.message })
        rejected++
        continue
      }
      stagedForms++
      summaries.push({ kind: 'form', name, confidence: prov.confidence, sources: prov.sources.slice(0, 5) })
    }

    const result = {
      staged: { resources: stagedResources, forms: stagedForms },
      deduped,
      rejected,
      via: sourced.via,
      candidates: summaries,
    }
    edgeLog('info', 'discover.complete', { userId: user.id, ...result.staged, deduped, rejected, via: sourced.via, correlationId })
    edgeLog('info', 'discover.request.complete', { durationMs: Math.round(performance.now() - t0), correlationId })

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    edgeLog('error', 'discover.error', { error: message, correlationId, durationMs: Math.round(performance.now() - t0) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
