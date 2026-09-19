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
import {
  classifyGeocodeWrite,
  geocodeForwardV6,
  reverseGeocodeV6,
  type GeocodeAccuracyTier,
} from '../_shared/mapbox-v6.ts'
import {
  buildExistingUrlIndex,
  buildOutcomeResponse,
  checkUrlLiveness,
  classifyOutcome,
  fetchWithRetry,
  isDuplicateUrl,
  normalizeUrlForDedup,
  sourceCandidates,
  verify,
  type AgentResult,
  type ResourceCandidate,
} from '../_shared/discovery-pipeline.ts'

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

// Region-relevance guardrail. A candidate whose resolved point lies farther than
// this from the admin's resolved lat/lng is treated as out-of-region and rejected
// (used when a per-candidate state match is unavailable). ~150 km ≈ 93 mi keeps
// same-metro / adjacent-town results while dropping cross-state noise.
const MAX_REGION_RADIUS_KM = 150

// US state / territory name → USPS 2-letter code. Used to normalize candidate and
// region state values to a comparable token during the region-relevance filter.
const US_STATE_ABBR: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'puerto rico': 'PR',
}
const VALID_STATE_CODES = new Set<string>(Object.values(US_STATE_ABBR))

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
  nearLocation?: { label?: string; lat?: number; lng?: number }
}

// ResourceCandidate, FormCandidate, Provenance + the verification layer
// (hostOf / isAuthoritativeHost / verify — INV-2b/2c) now live in
// ../_shared/discovery-pipeline.ts and are imported above.

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

// Outcome of one provider call: the parsed result (null on hard failure) plus a
// transient-rate-limit flag so the handler can emit the honest admin signal
// (INV-0c) instead of a generic error when Firecrawl is temporarily throttled.
interface SourceOutcome {
  result: AgentResult | null
  rateLimited: boolean
  providerError: boolean
}

// Backoff dependencies for fetchWithRetry (INV-0b). Real timers + jittered
// exponential backoff, honoring Retry-After, bounded to a proxy-safe budget.
const RETRY_DEPS = {
  sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  jitter: () => Math.random(),
  maxRetries: 3,
  baseDelayMs: 600,
  maxBudgetMs: 15_000,
}

// ── Candidate liveness (INV-2a): keep only URLs that resolve 200 on the SAME
//    host (HEAD → ranged-GET fallback), each bounded by a per-URL timeout. ──
const LIVENESS_TIMEOUT_MS = 5_000

async function isUrlLive(url: string): Promise<boolean> {
  const res = await checkUrlLiveness(url, (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS) }),
  )
  return res.ok
}

// Filter a candidate's citation URLs down to those that pass liveness. A
// candidate with ANY live source is kept (with its dead links pruned); a
// candidate whose every source is dead/cross-host/404 is dropped upstream.
async function pruneDeadSources(urls: string[]): Promise<string[]> {
  const checks = await Promise.all(urls.map(async (u) => ({ u, live: await isUrlLive(u) })))
  return checks.filter((c) => c.live).map((c) => c.u)
}

async function sourceViaAgent(query: string, contentType: ContentType, maxCandidates: number, geoBias?: string | null): Promise<SourceOutcome> {
  if (!FIRECRAWL_API_KEY) return { result: null, rateLimited: false, providerError: false }

  const locationBias =
    geoBias && geoBias.trim()
      ? ` Prioritize resources physically located in or serving ${geoBias.trim()}. Only include candidates in that state/region. Unless the query text explicitly names a different location, focus results on that area.`
      : ''

  const prompt =
    `Find up to ${maxCandidates} real, currently-operating mutual-aid / public-benefit ` +
    `${contentType === 'form' ? 'benefit application forms' : 'community resources'} for: "${query}". ` +
    `For each, include every verifiable field and a "sources" array of citation URLs ` +
    `(prefer official .gov / .org pages). Only include candidates you can cite.` +
    locationBias

  // Kick off the async job (retrying transient 429/5xx — INV-0b).
  let jobId: string
  try {
    const resp = await fetchWithRetry(() => fetch('https://api.firecrawl.dev/v2/agent', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, schema: buildAgentSchema(contentType) }),
    }), RETRY_DEPS)
    if (!resp.ok) {
      const transient = resp.status === 429 || resp.status >= 500
      edgeLog('warn', 'discover.agent.start_failed', { status: resp.status })
      return { result: null, rateLimited: transient, providerError: !transient }
    }
    const json = await resp.json()
    if (!json?.success || !json?.id) {
      edgeLog('warn', 'discover.agent.no_id', {})
      return { result: null, rateLimited: false, providerError: true }
    }
    jobId = json.id
  } catch (e) {
    edgeLog('warn', 'discover.agent.start_error', { error: e instanceof Error ? e.message : String(e) })
    return { result: null, rateLimited: false, providerError: true }
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
        return { result: { resources, forms, via: 'agent' }, rateLimited: false, providerError: false }
      }
      if (status === 'failed' || status === 'cancelled') {
        edgeLog('warn', 'discover.agent.terminal', { jobId, status })
        return { result: null, rateLimited: false, providerError: false }
      }
    } catch {
      // transient — keep polling within budget
    }
  }
  edgeLog('warn', 'discover.agent.timeout', { jobId, budgetMs: AGENT_POLL_BUDGET_MS })
  return { result: null, rateLimited: false, providerError: false }
}

// PRIMARY fast path: /v2/search returns {url,title,description} per hit. Each hit
// becomes a thin resource candidate whose only source is its own URL — it will
// only survive verification when that host is authoritative (.gov/.org) or is
// corroborated, which is the correct strict behaviour.
async function sourceViaSearch(query: string, maxCandidates: number, geoBias?: string | null): Promise<SourceOutcome> {
  if (!FIRECRAWL_API_KEY) return { result: null, rateLimited: false, providerError: false }
  try {
    const searchQuery =
      geoBias && geoBias.trim()
        ? `${query} near ${geoBias.trim()}`
        : query
    const resp = await fetchWithRetry(() => fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery, limit: Math.min(maxCandidates, 10) }),
    }), RETRY_DEPS)
    if (!resp.ok) {
      const transient = resp.status === 429 || resp.status >= 500
      edgeLog('warn', 'discover.search.failed', { status: resp.status })
      return { result: null, rateLimited: transient, providerError: !transient }
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
    return { result: { resources, forms: [], via: 'search' }, rateLimited: false, providerError: false }
  } catch (e) {
    edgeLog('warn', 'discover.search.error', { error: e instanceof Error ? e.message : String(e) })
    return { result: null, rateLimited: false, providerError: true }
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
 * Result of address-first geocoding, always carrying a stamped
 * geocode_accuracy tier (never null) so every written resource is tagged —
 * see THE INVARIANT in the resource-discover-v6 task: a strong Mapbox v6
 * match writes its precise tier, any weaker outcome (coarser tier, medium/low
 * confidence) or the ZIP-centroid fallback writes 'approximate'.
 */
interface GeocodeCandidateResult {
  lat: number
  lng: number
  accuracy: GeocodeAccuracyTier
  confidence: string | null
}

/**
 * Precise street-level geocode via the Mapbox Geocoding API v6 (server-side).
 * Returns null when no MAPBOX_TOKEN is configured, the address is unusable, or
 * Mapbox returns no result. Never throws — failures degrade to the
 * ZIP-centroid path. The move-only-on-strong-match gate (classifyGeocodeWrite)
 * stamps 'approximate' on any result weaker than rooftop/parcel/point +
 * exact/high confidence — the v6 coordinates are still returned as the
 * best-effort location either way.
 */
async function geocodeByAddressMapbox(
  parts: { address_line1?: string | null; city?: string | null; state?: string | null; zip_code?: string | null },
): Promise<GeocodeCandidateResult | null> {
  if (!MAPBOX_TOKEN) return null
  const segments = [parts.address_line1, parts.city, parts.state, parts.zip_code]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
  // Require at least a street line plus one locality component for a meaningful
  // forward geocode; otherwise let the ZIP-centroid fallback handle it.
  if (!parts.address_line1?.trim() || segments.length < 2) return null
  const queryStr = segments.join(', ')
  const result = await geocodeForwardV6(queryStr, MAPBOX_TOKEN)
  if (!result) {
    edgeLog('warn', 'discover.geocode.mapbox_no_result', {})
    return null
  }
  const { accuracy } = classifyGeocodeWrite(result.tier, result.confidence)
  return { lat: result.lat, lng: result.lng, accuracy, confidence: result.confidence }
}

/**
 * Address-first geocoding: precise Mapbox v6 street geocode when an address +
 * MAPBOX_TOKEN are available, falling back to the ZIP centroid otherwise.
 * Returns null only when neither path resolves any coordinates at all
 * (location legitimately stays null); every non-null result carries a
 * geocode_accuracy tag — never left NULL, per THE INVARIANT.
 */
async function geocodeCandidate(
  service: SupabaseClient,
  parts: { address_line1?: string | null; city?: string | null; state?: string | null; zip_code?: string | null },
): Promise<GeocodeCandidateResult | null> {
  const byAddress = await geocodeByAddressMapbox(parts)
  if (byAddress) return byAddress
  if (parts.zip_code) {
    const centroid = await geocodeByZip(service, parts.zip_code)
    if (centroid) return { ...centroid, accuracy: 'approximate', confidence: 'low' }
  }
  return null
}

// ═══════════════════════════════════════════════════════════
// Region resolution + relevance filter — the geo-relevance core.
//
// The admin's map pin carries lat/lng (not just a text label). We resolve those
// coordinates to a concrete { city, state, zip } region (Mapbox reverse-geocode
// when MAPBOX_TOKEN is set; label parsing otherwise) and use it BOTH to bias the
// sourcing query AND to reject candidates proven to be outside the region.
// ═══════════════════════════════════════════════════════════

interface Region {
  city: string | null
  state: string | null // USPS 2-letter code
  zip: string | null
  lat: number | null
  lng: number | null
}

/** Normalize a state name or code to a validated USPS 2-letter code (else null). */
function normalizeStateAbbr(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^[A-Za-z]{2}$/.test(s)) {
    const up = s.toUpperCase()
    return VALID_STATE_CODES.has(up) ? up : null
  }
  return US_STATE_ABBR[s.toLowerCase()] ?? null
}

/** Extract { city, state, zip } from a free-text location label, e.g. "Burlington, VT 05401". */
function parseRegionFromLabel(label: string | null | undefined): { city: string | null; state: string | null; zip: string | null } {
  if (!label) return { city: null, state: null, zip: null }
  const zipMatch = label.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : null
  let state: string | null = null
  // A 2-letter token immediately before a zip or at end of string is the state.
  const abbrMatch = label.match(/\b([A-Za-z]{2})\b(?=[,\s]*\d{5}|\s*$)/)
  if (abbrMatch) state = normalizeStateAbbr(abbrMatch[1])
  if (!state) {
    const tail = label.slice(label.lastIndexOf(',') + 1).toLowerCase()
    const match = Object.keys(US_STATE_ABBR)
      .filter((name) => tail.includes(name))
      .sort((a, b) => b.length - a.length)[0]
    if (match) state = US_STATE_ABBR[match]
  }
  const city = label.split(',')[0]?.trim() || null
  return { city, state, zip }
}

/**
 * Reverse-geocode lat/lng to { city, state, zip } via the Mapbox Geocoding API
 * v6 (INV-0d — the legacy v5 geocoding/v5/mapbox.places endpoint 422s). Returns
 * null when no MAPBOX_TOKEN is configured or the lookup fails — callers degrade
 * to text-label parsing. Non-fatal by contract.
 */
async function reverseGeocodeRegion(lat: number, lng: number): Promise<{ city: string | null; state: string | null; zip: string | null } | null> {
  if (!MAPBOX_TOKEN) return null
  const rev = await reverseGeocodeV6(lat, lng, MAPBOX_TOKEN)
  if (!rev) {
    edgeLog('warn', 'discover.region.reverse_failed', {})
    return null
  }
  // v6 already returns an uppercased 2-letter region code; normalizeStateAbbr
  // validates it against the known USPS set (else null).
  return { city: rev.city, state: normalizeStateAbbr(rev.state), zip: rev.zip }
}

/**
 * Resolve the admin's nearLocation to a concrete Region using its lat/lng first
 * (Mapbox reverse-geocode) and the text label as a fallback. Returns the region
 * plus which path supplied the state/city/zip, for the run-summary log.
 */
async function resolveRegion(
  near: { label: string; lat: number | null; lng: number | null } | null,
): Promise<{ region: Region; fallbackUsed: string }> {
  if (!near) return { region: { city: null, state: null, zip: null, lat: null, lng: null }, fallbackUsed: 'none' }
  const fromLabel = parseRegionFromLabel(near.label)
  let { city, state, zip } = fromLabel
  let fallbackUsed = 'label'
  if (near.lat != null && near.lng != null) {
    const rev = await reverseGeocodeRegion(near.lat, near.lng)
    if (rev) {
      state = rev.state ?? state
      city = rev.city ?? city
      zip = rev.zip ?? zip
      fallbackUsed = 'mapbox_reverse'
    }
  }
  return { region: { city, state, zip, lat: near.lat, lng: near.lng }, fallbackUsed }
}

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Region-relevance decision. Rejects ONLY on positive out-of-region evidence:
 *   - candidate state is known AND differs from the region state, OR
 *   - candidate point is known AND lies beyond MAX_REGION_RADIUS_KM of the region.
 * When the region carries no constraint, or the candidate cannot be localized,
 * the candidate is kept (it is not provably out-of-region).
 */
function classifyRegion(region: Region, candState: string | null, geo: { lat: number; lng: number } | null): 'keep' | 'reject' {
  const hasStateConstraint = !!region.state
  const hasGeoConstraint = region.lat != null && region.lng != null
  if (!hasStateConstraint && !hasGeoConstraint) return 'keep'
  if (hasStateConstraint && candState && candState !== region.state) return 'reject'
  if (hasGeoConstraint && geo && haversineKm(region.lat!, region.lng!, geo.lat, geo.lng) > MAX_REGION_RADIUS_KM) return 'reject'
  return 'keep'
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

    // Safe parse of optional nearLocation — all fields optional; ignore if malformed.
    // Array.isArray guard prevents an array slipping past the typeof 'object' check.
    // label is capped at 120 chars and newlines collapsed to prevent prompt injection.
    const rawNear = body.nearLocation
    const nearLocation: { label: string; lat: number | null; lng: number | null } | null =
      rawNear && typeof rawNear === 'object' && !Array.isArray(rawNear)
        ? {
            label: typeof rawNear.label === 'string'
              ? String(rawNear.label).trim().slice(0, 120).replace(/[\r\n]+/g, ' ')
              : '',
            lat: typeof rawNear.lat === 'number' && Number.isFinite(rawNear.lat) ? rawNear.lat : null,
            lng: typeof rawNear.lng === 'number' && Number.isFinite(rawNear.lng) ? rawNear.lng : null,
          }
        : null

    if (!FIRECRAWL_API_KEY) {
      edgeLog('error', 'discover.no_firecrawl_key', {})
      return new Response(JSON.stringify({ error: 'Sourcing provider not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    edgeLog('info', 'discover.start', { userId: user.id, contentType, maxCandidates, queryLen: query.length, correlationId })

    // ── REGION RESOLUTION: resolve the admin's pin (lat/lng) to a concrete
    //    { city, state, zip } region used to BIAS the query and FILTER candidates. ──
    const { region, fallbackUsed } = await resolveRegion(nearLocation)
    const geoBias =
      region.city && region.state
        ? `${region.city}, ${region.state}${region.zip ? ' ' + region.zip : ''}`
        : region.state
          ? region.state
          : (nearLocation?.label || null)

    // ── SOURCING (INV-0a): /v2/search is the PRIMARY fast path and is fully
    //    awaited first (its Firecrawl concurrency slot releases); /v2/agent runs
    //    SEQUENTIALLY afterwards as best-effort enrichment, only when search
    //    under-delivered. The two endpoints never contend for the same slot, so
    //    an agent timeout no longer forces a colliding fallback into a 429. ──
    const outcome = await sourceCandidates({
      runSearch: () => sourceViaSearch(query, maxCandidates, geoBias),
      runAgent: () => sourceViaAgent(query, contentType, maxCandidates, geoBias),
    })
    const sourced = outcome.result

    // ── HONEST ADMIN SIGNAL (INV-0c): distinguish candidates / clean-empty /
    //    rate-limited / provider-error. No more raw {"error":"Sourcing failed"}. ──
    if (!sourced || (sourced.resources.length === 0 && sourced.forms.length === 0)) {
      const oc = classifyOutcome(outcome)
      const { status, body } = buildOutcomeResponse(oc)
      edgeLog('info', 'discover.outcome', { state: oc.state, rateLimited: outcome.rateLimited, providerError: outcome.providerError, correlationId })
      return new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const ctx: StageContext = { service, adminId: user.id, query }

    let stagedResources = 0
    let stagedForms = 0
    let deduped = 0
    let rejected = 0
    let rejectedDead = 0
    let geocodedCount = 0
    let inRegionKept = 0
    let rejectedOutOfRegion = 0
    const summaries: Array<{ kind: 'resource' | 'form'; name: string; confidence: string; sources: string[] }> = []

    // ── RESOURCES ──
    const rawResources = (sourced.resources ?? []).slice(0, maxCandidates)

    // ── URL DEDUP INDEX (INV-2d): bounded to the CANDIDATE URLs, not the whole
    //    ~19k-row table (the db-max-rows footgun). We probe `resources` with the
    //    small {raw, slash-toggled, http/https} key set for the ≤~25 candidate
    //    URLs via two O(candidates) `.in()` queries, then normalize-compare the
    //    small returned subset. Exact/near-exact dupes are caught table-wide;
    //    URLs staged during THIS run are added below for intra-run dedup. ──
    const candidateUrls = rawResources.flatMap((c) => [cleanUrl(c.website), cleanUrl(c.application_url)])
    const existingUrlSet = await buildExistingUrlIndex(candidateUrls, async (keys) => {
      const [byWeb, byApp] = await Promise.all([
        ctx.service.from('resources').select('website, application_url').in('website', keys),
        ctx.service.from('resources').select('website, application_url').in('application_url', keys),
      ])
      return [
        ...((byWeb.data ?? []) as Array<{ website: string | null; application_url: string | null }>),
        ...((byApp.data ?? []) as Array<{ website: string | null; application_url: string | null }>),
      ]
    })
    for (const cand of rawResources) {
      const name = (cand.name ?? '').trim()
      if (!name || name.length < 2) { rejected++; continue }

      // ── LIVENESS (INV-2a): keep only citation URLs that resolve 200 on the
      //    same host; a candidate whose every source is dead/404/cross-host is
      //    dropped before it can be staged. ──
      const liveSources = await pruneDeadSources(collectSources(cand))
      const cleanWebsite = cleanUrl(cand.website)
      const liveWebsite = cleanWebsite && (await isUrlLive(cleanWebsite)) ? cleanWebsite : null
      if (liveSources.length === 0 && !liveWebsite) {
        edgeLog('info', 'discover.resource.dead_sources', { name, correlationId })
        rejectedDead++; rejected++; continue
      }

      const prov = verify(query, liveSources, liveWebsite)
      if (!prov) { rejected++; continue }

      // URL-based dedup (INV-2d) — attribute match against existing + this run.
      if (isDuplicateUrl(liveWebsite, existingUrlSet) || isDuplicateUrl(cleanUrl(cand.application_url), existingUrlSet)) {
        deduped++; continue
      }

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
      if (geo) geocodedCount++

      // ── REGION FILTER: drop candidates proven to be outside the admin's region
      //    (state mismatch, or point beyond the radius of the resolved lat/lng).
      const candState = normalizeStateAbbr(cand.state)
      if (classifyRegion(region, candState, geo) === 'reject') {
        edgeLog('info', 'discover.resource.out_of_region', { name, candState, regionState: region.state, correlationId })
        rejectedOutOfRegion++
        rejected++
        continue
      }
      inRegionKept++

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

      // Atomically stamp PostGIS location + geocode_accuracy + geocode_confidence
      // when geocoding resolved a point. set_resource_geocode never leaves the
      // row untagged — geo.accuracy is always non-null (see THE INVARIANT).
      if (geo) {
        await ctx.service.rpc('set_resource_geocode', {
          p_id: inserted.id,
          p_lat: geo.lat,
          p_lng: geo.lng,
          p_accuracy: geo.accuracy,
          p_confidence: geo.confidence,
        })
      }

      // Register this run's staged URLs so a later candidate with the same site
      // is deduped within the same request (INV-2d, intra-run).
      for (const u of [liveWebsite, cleanUrl(cand.application_url)]) {
        const n = normalizeUrlForDedup(u)
        if (n) existingUrlSet.add(n)
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

    // ── RUN SUMMARY: single structured line capturing the geo-relevance outcome. ──
    edgeLog('info', 'discover.geo.summary', {
      region: geoBias ?? region.state ?? 'unspecified',
      candidates_returned: rawResources.length,
      geocoded_count: geocodedCount,
      in_region_kept: inRegionKept,
      rejected_out_of_region: rejectedOutOfRegion,
      rejected_dead_url: rejectedDead,
      fallback_used: fallbackUsed,
      correlationId,
    })

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
