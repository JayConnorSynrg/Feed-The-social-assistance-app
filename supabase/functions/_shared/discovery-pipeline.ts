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

function toggleTrailingSlash(u: string): string {
  try {
    const url = new URL(u)
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    } else if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/'
    } else {
      url.pathname = url.pathname + '/'
    }
    return url.toString()
  } catch {
    return u
  }
}

function swapScheme(u: string): string {
  if (u.startsWith('https://')) return 'http://' + u.slice(8)
  if (u.startsWith('http://')) return 'https://' + u.slice(7)
  return u
}

/**
 * Build the small exact-match key set to probe `resources` with for dedup —
 * for each candidate URL: {raw, trailing-slash toggled, http/https variant}
 * and their combinations. Lets the handler dedup table-wide with an O(candidates)
 * `.in()` query instead of scanning the whole (~19k-row) table into memory.
 */
export function buildDedupLookupKeys(urls: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const raw of urls) {
    if (!raw) continue
    const u = raw.trim()
    if (!u) continue
    const base = [u, toggleTrailingSlash(u)]
    for (const v of [...base]) base.push(swapScheme(v))
    for (const v of base) set.add(v)
  }
  return [...set]
}

/**
 * Build the normalized existing-URL index for dedup, bounded to the candidate
 * URLs (NOT the whole table). `fetchRows` receives the exact-match key set from
 * buildDedupLookupKeys and returns the matching resource rows; each row's
 * website/application_url is normalized into the returned Set. A candidate whose
 * canonical URL matches an existing row is then caught table-wide via
 * isDuplicateUrl, regardless of table size.
 */
export async function buildExistingUrlIndex(
  candidateUrls: (string | null | undefined)[],
  fetchRows: (keys: string[]) => Promise<Array<{ website?: string | null; application_url?: string | null }>>,
): Promise<Set<string>> {
  const set = new Set<string>()
  const keys = buildDedupLookupKeys(candidateUrls)
  if (keys.length === 0) return set
  const rows = await fetchRows(keys)
  for (const r of rows) {
    for (const u of [r.website, r.application_url]) {
      const n = normalizeUrlForDedup(u)
      if (n) set.add(n)
    }
  }
  return set
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
    const trimmed = header.trim()
    // delta-seconds form: `Retry-After: 120`
    const secs = Number(trimmed)
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.max(expo, Math.round(secs * 1000))
    }
    // HTTP-date form: `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`
    const dateMs = Date.parse(trimmed)
    if (Number.isFinite(dateMs)) {
      return Math.max(expo, Math.max(0, dateMs - Date.now()))
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

export interface ProviderOutcome {
  result: AgentResult | null
  /** true on a transient rate-limit (429) or server error (5xx). */
  rateLimited: boolean
  /** true on a hard, non-retryable, non-empty failure (auth 4xx, malformed body). */
  providerError: boolean
}

export interface SourcingOutcome {
  result: AgentResult | null
  searchCount: number
  agentRan: boolean
  /** true when either provider signalled a transient rate-limit/unavailability. */
  rateLimited: boolean
  /** true when either provider hard-failed for a non-retryable, non-empty reason. */
  providerError: boolean
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
  runSearch: () => Promise<ProviderOutcome>
  runAgent: () => Promise<ProviderOutcome>
  enrichThreshold?: number
}): Promise<SourcingOutcome> {
  const threshold = opts.enrichThreshold ?? DEFAULT_ENRICH_THRESHOLD

  const search = await opts.runSearch() // PRIMARY — slot released on resolve
  const searchCount = search.result?.resources.length ?? 0

  let agentRan = false
  let agentRateLimited = false
  let agentProviderError = false
  let agentResult: AgentResult | null = null
  if (searchCount < threshold) {
    agentRan = true
    const agent = await opts.runAgent() // SEQUENTIAL — never overlaps search
    agentResult = agent.result
    agentRateLimited = agent.rateLimited
    agentProviderError = agent.providerError
  }

  const merged = mergeResults(search.result, agentResult)
  return {
    result: merged,
    searchCount,
    agentRan,
    rateLimited: search.rateLimited || agentRateLimited,
    providerError: search.providerError || agentProviderError,
  }
}

// ═══════════════════════════════════════════════════════════
// Honest admin-facing outcome classification  (INV-0c)
// ═══════════════════════════════════════════════════════════

export type OutcomeState = 'candidates' | 'empty' | 'rate_limited' | 'provider_error'

export interface OutcomeClassification {
  state: OutcomeState
  status: number
  message: string
}

/**
 * Map a sourcing outcome to the admin-facing states. Replaces the raw
 * {"error":"Sourcing failed"} blob:
 *   candidates     — >=1 sourced (200)
 *   empty          — providers responded cleanly with zero matches (200); a
 *                    real "no results", NOT an error
 *   rate_limited   — provider transiently rate-limited/unavailable AND no
 *                    candidates (503); NOT "no results"
 *   provider_error — provider hard-failed (auth 4xx / malformed body) AND no
 *                    candidates (502); NOT "no results", NOT rate-limited
 * Precedence when count == 0: provider_error > rate_limited > empty, so an
 * auth/parse failure is never misreported as a clean empty result.
 */
export function classifyOutcome(
  o: { result: AgentResult | null; rateLimited: boolean; providerError?: boolean },
): OutcomeClassification {
  const count = (o.result?.resources.length ?? 0) + (o.result?.forms.length ?? 0)
  if (count > 0) {
    return { state: 'candidates', status: 200, message: 'Candidates sourced.' }
  }
  if (o.providerError) {
    return {
      state: 'provider_error',
      status: 502,
      message: 'Resource sourcing is temporarily unavailable — please retry.',
    }
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

/** The zero-staged response body an admin sees for a non-candidates outcome. */
export interface OutcomeResponse {
  status: number
  body: {
    state: OutcomeState
    message: string
    staged: { resources: number; forms: number }
    deduped: number
    rejected: number
    candidates: never[]
  }
}

/**
 * Build the actual HTTP response (status + JSON body) the handler returns for a
 * non-candidates outcome. Pure, so the handler's response contract is unit
 * tested directly (empty / rate_limited / provider_error).
 */
export function buildOutcomeResponse(oc: OutcomeClassification): OutcomeResponse {
  return {
    status: oc.status,
    body: {
      state: oc.state,
      message: oc.message,
      staged: { resources: 0, forms: 0 },
      deduped: 0,
      rejected: 0,
      candidates: [],
    },
  }
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
  reason: 'ok' | 'not_found' | 'cross_host_redirect' | 'error' | 'bad_url' | 'private_or_invalid'
}

// ── SSRF guard (INV-2a hardening): only public http(s) targets may be probed
//    server-side. Blocks loopback, link-local (incl. the cloud metadata IP
//    169.254.169.254), RFC1918, ULA, localhost/*.local/metadata hostnames. ──

function isPublicIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = nums
  if (a === 0) return false // "this network"
  if (a === 127) return false // loopback 127.0.0.0/8
  if (a === 10) return false // RFC1918 10/8
  if (a === 172 && b >= 16 && b <= 31) return false // RFC1918 172.16/12
  if (a === 192 && b === 168) return false // RFC1918 192.168/16
  if (a === 169 && b === 254) return false // link-local 169.254/16 (metadata)
  return true
}

function isPublicIpv6(host: string): boolean {
  const h = host.toLowerCase()
  if (h === '::1' || h === '::') return false // loopback / unspecified
  // link-local fe80::/10  → fe8x .. febx
  if (/^fe[89ab]/.test(h)) return false
  // unique-local fc00::/7 → fc.. / fd..
  if (/^f[cd]/.test(h)) return false
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4
  const m = h.match(/(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (m) return isPublicIpv4(m[1])
  return true
}

/**
 * true only for a public http(s) URL. Rejects non-http(s) schemes,
 * localhost/*.local/metadata hostnames, and IP literals in loopback,
 * link-local, RFC1918, or ULA ranges. A DNS name (not an IP literal) is
 * allowed — its resolved address is outside this synchronous check's scope.
 */
export function isPublicHttpUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl) return false
  let u: URL
  try {
    u = new URL(rawUrl.trim())
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  let host = u.hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1) // ipv6 literal
  if (!host) return false
  if (host === 'localhost' || host === 'localhost.localdomain') return false
  if (host.endsWith('.local') || host.endsWith('.localhost')) return false
  if (host === 'metadata' || host === 'metadata.google.internal') return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPublicIpv4(host)
  if (host.includes(':')) return isPublicIpv6(host)
  return true
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
  // SSRF guard: never issue the probe for a private/invalid target.
  if (!isPublicHttpUrl(url)) {
    return { url, ok: false, status: null, finalHost: originHost, sameHost: false, reason: 'private_or_invalid' }
  }
  const evaluate = (status: number, finalUrl: string): LivenessResult => {
    const finalHost = hostOf(finalUrl) ?? originHost
    const sameHost = finalHost === originHost
    // Re-check the resolved target: a redirect that landed on a private/invalid
    // host fails even if it reported 2xx.
    if (!isPublicHttpUrl(finalUrl)) {
      return { url, ok: false, status, finalHost, sameHost, reason: 'private_or_invalid' }
    }
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
