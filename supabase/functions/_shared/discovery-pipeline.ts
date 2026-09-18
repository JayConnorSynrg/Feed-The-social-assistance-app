// supabase/functions/_shared/discovery-pipeline.ts
//
// Pure, dependency-free pipeline logic for resource-discover.
//
// Deliberately free of Deno-only imports (no serve, no Supabase client, no
// top-level Deno.env reads, no module-level side effects) so every unit here
// is importable and testable in isolation — mirroring `_shared/mapbox-v6.ts`.
// The edge handler in resource-discover/index.ts wires these pure units to the
// live Firecrawl / Mapbox / Supabase I/O.
//
// The invariants each unit satisfies (see PR):
//   INV-0a  no self-collision  → sourceCandidates() runs search + agent
//                                 SEQUENTIALLY; they never contend for the
//                                 Firecrawl maxConcurrency=2 slot at once.
//   INV-0b  transient retry     → isRetryableStatus / parseRetryAfterMs +
//                                 fetchWithRetry: 429/5xx retried with
//                                 backoff+jitter honoring Retry-After; 4xx-other
//                                 never retried.
//   INV-0c  honest admin signal → classifyOutcome(): candidates | empty |
//                                 rate_limited, each with an admin-facing
//                                 message + HTTP status. No "Sourcing failed".
//   INV-2a  liveness            → checkUrlLiveness(): HEAD (GET-range fallback),
//                                 same-host redirects only; 404 / cross-host drop.
//   INV-2b  authoritative rank  → scoreHost(): .gov / state / 211 / unitedway /
//                                 .org outrank generic domains.
//   INV-2c  corroboration       → verify(): authoritative OR >=2 sources →
//                                 credible; single generic → staged low+flagged
//                                 (visible, not credible); zero hosts → drop.
//   INV-2d  dedup               → normalizeUrlForDedup(): lowercase host, strip
//                                 www + trailing slash + utm/tracking query noise.

// ═══════════════════════════════════════════════════════════
// Candidate + provenance types (shared with the handler)
// ═══════════════════════════════════════════════════════════

export interface ResourceCandidate {
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

export interface FormCandidate {
  name?: string
  form_type?: string
  description?: string
  agency_name?: string
  agency_website?: string
  application_url?: string
  sources?: string[]
}

export interface AgentResult {
  resources: ResourceCandidate[]
  forms: FormCandidate[]
  via: 'agent' | 'search' | 'agent+search'
}

export type Confidence = 'high' | 'medium' | 'low'

export interface Provenance {
  source_url: string | null
  confidence: Confidence
  corroborating_count: number
  authoritative_domain: boolean
  /** Priority rank of the best source host (see scoreHost). */
  domain_priority: number
  /** true when a single generic-domain source needs closer manual review. */
  flagged_for_review: boolean
  query: string
  discovered_at: string
  sources: string[]
}

// ═══════════════════════════════════════════════════════════
// Host classification + authoritative-domain scoring  (INV-2b)
// ═══════════════════════════════════════════════════════════

/** Parse a URL's registrable host, lowercased and www-stripped. null if unparseable. */
export function hostOf(url: string): string | null {
  try {
    const h = new URL(url.trim()).hostname.toLowerCase()
    return h.startsWith('www.') ? h.slice(4) : h
  } catch {
    return null
  }
}

/** A host is "authoritative" when it is a government or nonprofit domain. */
export function isAuthoritativeHost(host: string): boolean {
  return host.endsWith('.gov') || host.endsWith('.org')
}

// Known high-trust community-resource portals (scored, never hard-whitelisted).
const STATE_PORTAL_RE = /(^|\.)(vermont|state)\.gov$|\.vermont\.gov$|humanservices\.vermont\.gov$/
const CIVIC_211_RE = /(^|\.)(vermont211|search\.vermont211)\.org$|(^|\.)211\./
const UNITED_WAY_RE = /(^|\.)unitedway/

/**
 * Score a host for staging priority. Higher = more authoritative. The score
 * ranks candidates and drives the confidence tier — it does NOT hard-whitelist.
 *   .gov / state portal          → 100
 *   211 / United Way civic hub    → 90
 *   nonprofit .org                → 60
 *   generic (.com/.net/other)     → 10
 */
export function scoreHost(host: string): number {
  if (host.endsWith('.gov') || STATE_PORTAL_RE.test(host)) return 100
  if (CIVIC_211_RE.test(host) || UNITED_WAY_RE.test(host)) return 90
  if (host.endsWith('.org')) return 60
  return 10
}

/** Best (highest) host priority across a set of URLs. 0 when none parse. */
export function bestDomainPriority(urls: string[]): number {
  let best = 0
  for (const u of urls) {
    const h = hostOf(u)
    if (h) best = Math.max(best, scoreHost(h))
  }
  return best
}

// ═══════════════════════════════════════════════════════════
// Provenance verification + corroboration gate  (INV-2c)
//
//   ACCEPT (stage) when at least one source host parses. Confidence:
//     high   — authoritative AND >=2 distinct hosts
//     medium — exactly one of {authoritative, >=2 hosts}
//     low    — single generic-domain source (flagged_for_review=true)
//   DROP (null) only when NO source URL parses at all (candidate unusable).
//
// Both directions hold: a real authoritative single-source is never dropped
// (it is 'medium'); a generic single-source is never marked credible (it is
// 'low' + flagged), yet stays visible to the admin.
// ═══════════════════════════════════════════════════════════

export function verify(query: string, sources: string[], website?: string | null): Provenance | null {
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
  if (corroborating_count === 0) return null // no citable source → unusable

  const corroborated = corroborating_count >= 2
  let confidence: Confidence
  let flagged_for_review = false
  if (authoritative && corroborated) {
    confidence = 'high'
  } else if (authoritative || corroborated) {
    confidence = 'medium'
  } else {
    confidence = 'low'
    flagged_for_review = true
  }

  const cleanSources = urls.filter((u) => hostOf(u) !== null)
  return {
    source_url: cleanSources[0] ?? null,
    confidence,
    corroborating_count,
    authoritative_domain: authoritative,
    domain_priority: bestDomainPriority(cleanSources),
    flagged_for_review,
    query,
    discovered_at: new Date().toISOString(),
    sources: cleanSources,
  }
}

// ═══════════════════════════════════════════════════════════
// URL dedup normalization  (INV-2d)
// ═══════════════════════════════════════════════════════════

const TRACKING_PARAM_RE = /^(utm_|fbclid$|gclid$|mc_|ref$|source$)/i

/**
 * Canonicalize a URL for duplicate detection: lowercase scheme+host, strip a
 * leading www, drop utm-prefixed and tracking query noise (keeping meaningful
 * params sorted), and remove a trailing slash. Returns null when unparseable.
 */
export function normalizeUrlForDedup(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  let host = u.hostname.toLowerCase()
  if (host.startsWith('www.')) host = host.slice(4)

  const kept: string[] = []
  for (const [k, v] of [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (TRACKING_PARAM_RE.test(k)) continue
    kept.push(`${k}=${v}`)
  }
  let path = u.pathname.replace(/\/+$/, '') // strip trailing slash(es)
  if (path === '') path = ''
  const query = kept.length ? `?${kept.join('&')}` : ''
  return `${u.protocol}//${host}${path}${query}`.toLowerCase()
}

/** true when candidate's URL normalizes to one already present in `existing`. */
export function isDuplicateUrl(url: string | null | undefined, existing: Set<string>): boolean {
  const norm = normalizeUrlForDedup(url)
  return norm !== null && existing.has(norm)
}

// ═══════════════════════════════════════════════════════════
// Transient-failure retry  (INV-0b)
// ═══════════════════════════════════════════════════════════

/** Retry ONLY on rate-limit (429) or server error (5xx). 4xx-other is terminal. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599)
}

/**
 * Resolve the backoff delay for a retry. Honors a numeric Retry-After header
 * (seconds) when present and larger than the computed exponential backoff;
 * otherwise exponential base*2^attempt plus bounded jitter.
 */
export function parseRetryAfterMs(
  header: string | null | undefined,
  attempt: number,
  baseDelayMs: number,
  jitter = 0,
): number {
  const expo = baseDelayMs * Math.pow(2, attempt) + Math.floor(jitter * baseDelayMs)
  if (header) {
    const secs = Number(header.trim())
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.max(expo, Math.round(secs * 1000))
    }
  }
  return expo
}

export interface RetryDeps {
  /** Injected async wait — real code passes setTimeout; tests pass a stub. */
  sleep: (ms: number) => Promise<void>
  /** Injected jitter in [0,1) — tests pass 0 for determinism. */
  jitter?: () => number
  maxRetries?: number
  baseDelayMs?: number
  /** Overall retry budget; once exceeded, the last Response is returned as-is. */
  maxBudgetMs?: number
  now?: () => number
}

/**
 * Execute `doFetch`, retrying transient (429/5xx) responses with exponential
 * backoff + jitter honoring Retry-After, bounded by maxRetries and maxBudgetMs.
 * A single transient 429 therefore never empties a run. Non-retryable responses
 * (2xx, 3xx, 4xx-other) and thrown network errors return/propagate immediately
 * after the retry budget is honored. Returns the final Response.
 */
export async function fetchWithRetry(
  doFetch: () => Promise<Response>,
  deps: RetryDeps,
): Promise<Response> {
  const maxRetries = deps.maxRetries ?? 3
  const baseDelayMs = deps.baseDelayMs ?? 500
  const maxBudgetMs = deps.maxBudgetMs ?? 20_000
  const now = deps.now ?? Date.now
  const jitter = deps.jitter ?? (() => 0)
  const start = now()

  let resp = await doFetch()
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!isRetryableStatus(resp.status)) return resp
    const delay = parseRetryAfterMs(resp.headers.get('retry-after'), attempt, baseDelayMs, jitter())
    if (now() - start + delay > maxBudgetMs) return resp // out of budget → surface transient status
    await deps.sleep(delay)
    resp = await doFetch()
  }
  return resp
}

// ═══════════════════════════════════════════════════════════
// Sourcing orchestration — no self-collision  (INV-0a)
//
// Firecrawl's plan caps maxConcurrency=2. /v2/agent holds a slot while polling
// up to ~30s; firing /v2/search while that slot is still held collides → 429.
// The fix is ORDERING, not a shorter poll: run /v2/search PRIMARY and fully
// await it (its slot releases), THEN — only when search under-delivered — run
// /v2/agent SEQUENTIALLY as best-effort enrichment. The two calls are never in
// flight at the same instant, so they cannot contend for the same slot.
// ═══════════════════════════════════════════════════════════

export const DEFAULT_ENRICH_THRESHOLD = 3

/** Merge search + agent results, deduping resources/forms by normalized name. */
export function mergeResults(a: AgentResult | null, b: AgentResult | null): AgentResult | null {
  if (!a && !b) return null
  const seenR = new Set<string>()
  const resources: ResourceCandidate[] = []
  const seenF = new Set<string>()
  const forms: FormCandidate[] = []
  const nameKey = (n: string | undefined) => (n ?? '').trim().toLowerCase()
  for (const src of [a, b]) {
    if (!src) continue
    for (const r of src.resources ?? []) {
      const k = nameKey(r.name)
      if (!k || seenR.has(k)) continue
      seenR.add(k)
      resources.push(r)
    }
    for (const f of src.forms ?? []) {
      const k = nameKey(f.name)
      if (!k || seenF.has(k)) continue
      seenF.add(k)
      forms.push(f)
    }
  }
  const via: AgentResult['via'] = a && b ? 'agent+search' : (a ? a.via : b!.via)
  return { resources, forms, via }
}

export interface SourcingOutcome {
  result: AgentResult | null
  searchCount: number
  agentRan: boolean
  /** true when either provider signalled a transient rate-limit/unavailability. */
  rateLimited: boolean
}

/**
 * Source candidates without self-collision. `runSearch` is the PRIMARY fast
 * path and is fully awaited first. `runAgent` runs SEQUENTIALLY afterwards —
 * and only when search returned fewer than `enrichThreshold` candidates — so
 * the two Firecrawl endpoints are never concurrently in flight. Each callback
 * returns null on hard failure; a `true` from the paired `*RateLimited` probe
 * marks a transient rate-limit so the handler can emit the honest signal.
 */
export async function sourceCandidates(opts: {
  runSearch: () => Promise<{ result: AgentResult | null; rateLimited: boolean }>
  runAgent: () => Promise<{ result: AgentResult | null; rateLimited: boolean }>
  enrichThreshold?: number
}): Promise<SourcingOutcome> {
  const threshold = opts.enrichThreshold ?? DEFAULT_ENRICH_THRESHOLD

  const search = await opts.runSearch() // PRIMARY — slot released on resolve
  const searchCount = search.result?.resources.length ?? 0

  let agentRan = false
  let agentRateLimited = false
  let agentResult: AgentResult | null = null
  if (searchCount < threshold) {
    agentRan = true
    const agent = await opts.runAgent() // SEQUENTIAL — never overlaps search
    agentResult = agent.result
    agentRateLimited = agent.rateLimited
  }

  const merged = mergeResults(search.result, agentResult)
  return {
    result: merged,
    searchCount,
    agentRan,
    rateLimited: search.rateLimited || agentRateLimited,
  }
}

// ═══════════════════════════════════════════════════════════
// Honest admin-facing outcome classification  (INV-0c)
// ═══════════════════════════════════════════════════════════

export type OutcomeState = 'candidates' | 'empty' | 'rate_limited'

export interface OutcomeClassification {
  state: OutcomeState
  status: number
  message: string
}

/**
 * Map a sourcing outcome to the three admin-facing states. Replaces the raw
 * {"error":"Sourcing failed"} blob:
 *   candidates   — >=1 sourced (200)
 *   empty        — providers responded cleanly with zero matches (200); this
 *                  is a real "no results", NOT an error
 *   rate_limited — provider was transiently rate-limited/unavailable AND we
 *                  have no candidates (503); NOT "no results"
 */
export function classifyOutcome(o: { result: AgentResult | null; rateLimited: boolean }): OutcomeClassification {
  const count = (o.result?.resources.length ?? 0) + (o.result?.forms.length ?? 0)
  if (count > 0) {
    return { state: 'candidates', status: 200, message: 'Candidates sourced.' }
  }
  if (o.rateLimited) {
    return {
      state: 'rate_limited',
      status: 503,
      message: 'The discovery provider is temporarily rate-limited. Please retry in a moment.',
    }
  }
  return { state: 'empty', status: 200, message: 'No results found for this query.' }
}

// ═══════════════════════════════════════════════════════════
// Candidate URL liveness  (INV-2a)
// ═══════════════════════════════════════════════════════════

export interface LivenessResult {
  url: string
  ok: boolean
  status: number | null
  /** Host of the final resolved URL, lowercased/www-stripped. */
  finalHost: string | null
  /** true when the final URL is on the same host as the input. */
  sameHost: boolean
  reason: 'ok' | 'not_found' | 'cross_host_redirect' | 'error' | 'bad_url'
}

/** Minimal Response shape the liveness check reads (real fetch Response satisfies it). */
export interface FetchLike {
  (input: string, init?: { method?: string; redirect?: 'follow' | 'manual'; headers?: Record<string, string>; signal?: AbortSignal }): Promise<{
    ok: boolean
    status: number
    url: string
  }>
}

/**
 * Verify a candidate URL resolves live: HEAD first, falling back to a ranged
 * GET when HEAD is unsupported (405/501). Redirects are followed, but a final
 * URL on a DIFFERENT host fails the check (cross-host redirect = drop/flag). A
 * 404 (or any non-2xx) fails. Never throws — a network error resolves to
 * ok:false, reason:'error'. `doFetch` carries the per-URL timeout in real use.
 */
export async function checkUrlLiveness(url: string, doFetch: FetchLike): Promise<LivenessResult> {
  const originHost = hostOf(url)
  if (!originHost) {
    return { url, ok: false, status: null, finalHost: null, sameHost: false, reason: 'bad_url' }
  }
  const evaluate = (status: number, finalUrl: string): LivenessResult => {
    const finalHost = hostOf(finalUrl) ?? originHost
    const sameHost = finalHost === originHost
    if (status >= 200 && status < 300 && sameHost) {
      return { url, ok: true, status, finalHost, sameHost, reason: 'ok' }
    }
    if (status >= 200 && status < 300 && !sameHost) {
      return { url, ok: false, status, finalHost, sameHost, reason: 'cross_host_redirect' }
    }
    return { url, ok: false, status, finalHost, sameHost, reason: 'not_found' }
  }
  try {
    let resp = await doFetch(url, { method: 'HEAD', redirect: 'follow' })
    if (resp.status === 405 || resp.status === 501) {
      // HEAD unsupported → ranged GET (cheap: first byte only).
      resp = await doFetch(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-0' } })
    }
    return evaluate(resp.status, resp.url || url)
  } catch {
    return { url, ok: false, status: null, finalHost: null, sameHost: false, reason: 'error' }
  }
}
