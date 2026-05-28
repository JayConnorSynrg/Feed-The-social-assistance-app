#!/usr/bin/env npx tsx
/**
 * program-discovery.ts
 *
 * Discovers benefit programs for a US state using Ollama + SearXNG,
 * then pushes verified results to the resource-ingest webhook.
 *
 * Usage:
 *   npx tsx apps/web/scripts/program-discovery.ts --state VT [--dry-run] [--skip-verify] [--webhook-url URL]
 */

import { findFederalForm } from './federal-forms'
import { getStatePortal } from './state-portals'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgramCandidate {
  name: string
  category: string
  description: string
  eligibility: string
  phone?: string
  website?: string
  address?: string
}

interface VerifiedProgram extends ProgramCandidate {
  sourceUrl: string
  applicationUrl?: string
  applicationFormUrl?: string
  email?: string
}

interface IngestPayload {
  name: string
  category?: string
  description?: string
  address_line1?: string
  state?: string
  phone?: string
  email?: string
  website?: string
  eligibility_requirements?: string
  source_url?: string
  application_url?: string
  application_form_url?: string
  confidence?: 'high' | 'medium' | 'low'
  source?: string
  status?: string
  is_verified?: boolean
  external_id?: string
}

interface OllamaResponse {
  response: string
}

interface SearXNGResult {
  url: string
  title: string
  content?: string
}

interface SearXNGResponse {
  results: SearXNGResult[]
}

interface StepLog {
  step: string
  state: string
  durationMs: number
  [key: string]: unknown
}

// ─── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs(): {
  state: string
  dryRun: boolean
  skipVerify: boolean
  skipNormalize: boolean
  webhookUrl: string
} {
  const args = process.argv.slice(2)
  let state = ''
  let dryRun = false
  let skipVerify = false
  let skipNormalize = false
  let webhookUrl =
    process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL}/functions/v1/resource-ingest`
      : 'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/resource-ingest'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--state' && args[i + 1]) {
      state = args[++i].toUpperCase()
    } else if (args[i] === '--dry-run') {
      dryRun = true
    } else if (args[i] === '--skip-verify') {
      skipVerify = true
    } else if (args[i] === '--skip-normalize') {
      skipNormalize = true
    } else if (args[i] === '--webhook-url' && args[i + 1]) {
      webhookUrl = args[++i]
    }
  }

  if (!state) {
    console.error('Error: --state <code> is required (e.g. --state VT)')
    process.exit(1)
  }

  if (!/^[A-Z]{2}$/.test(state)) {
    console.error(`Error: --state must be a 2-letter US state code, got "${state}"`)
    process.exit(1)
  }

  return { state, dryRun, skipVerify, skipNormalize, webhookUrl }
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function logStep(entry: StepLog): void {
  process.stderr.write(JSON.stringify(entry) + '\n')
}

// ─── URL Validation ───────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url)
}

// ─── Slug Helper ──────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ─── Delay Helper ────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Step 1: Generate Candidates via Ollama ───────────────────────────────────

async function generateCandidates(state: string): Promise<ProgramCandidate[]> {
  const start = Date.now()
  const categories = [
    'food', 'housing', 'healthcare', 'employment', 'financial',
    'utilities', 'childcare', 'legal', 'disability', 'veteran', 'senior', 'transportation',
  ]

  const prompt = `You are a benefit program researcher. List real government and nonprofit benefit programs available in ${state} (US state).

Return a JSON object with a single key "programs" whose value is an array of objects. Each object must have these fields:
- name: string (official program name)
- category: one of [${categories.join(', ')}]
- description: string (1-2 sentences)
- eligibility: string (brief eligibility criteria)
- phone: string or null (US phone number if known)
- website: string or null (official .gov or .org URL if known)
- address: string or null (city and state at minimum)

Example:
{
  "programs": [
    {
      "name": "3SquaresVT (SNAP)",
      "category": "food",
      "description": "Vermont's SNAP program providing monthly food assistance benefits.",
      "eligibility": "Income at or below 130% federal poverty level",
      "phone": "800-479-6151",
      "website": "https://dcf.vermont.gov/benefits/3squaresVT",
      "address": "Burlington, VT"
    }
  ]
}

Include both federal programs administered by ${state} and state-specific programs.
Cover all 12 categories. Return 6-8 programs per category. Return ONLY the JSON object described above, no other text.`

  // Use 127.0.0.1 directly to avoid IPv6 (::1) connection-refused retry latency.
  // qwen3:8b on CPU: 6-8 programs × 12 categories takes ~5-8 min depending on hardware.
  // 10 min (600s) timeout provides headroom without hanging indefinitely.
  const GENERATE_TIMEOUT_MS = 600_000
  let response: Response
  try {
    response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt,
        format: 'json',
        stream: false,
      }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    })
  } catch (err) {
    const name = err instanceof Error ? (err as Error & { name: string }).name : ''
    const msg = err instanceof Error ? err.message : String(err)
    // Node 22 DOMException for AbortSignal.timeout is named "TimeoutError"
    const isTimeout = name === 'TimeoutError' || name === 'AbortError' || msg.toLowerCase().includes('timeout')
    if (isTimeout) {
      console.error(`Ollama timed out after ${GENERATE_TIMEOUT_MS / 60_000} minutes. Reduce the prompt size or use a GPU-backed model.`)
    } else {
      console.error(`Ollama connection failed: ${msg}`)
      console.error('Ensure Ollama is running: ollama serve')
    }
    process.exit(1)
  }

  if (!response.ok) {
    console.error(`Ollama returned HTTP ${response.status}: ${await response.text()}`)
    process.exit(1)
  }

  const data = (await response.json()) as OllamaResponse
  let candidates: ProgramCandidate[] = []

  // qwen3:8b is a "thinking" model — it sometimes wraps output in <think>…</think>
  // before the JSON body even when format:json is set. Strip any such prefix/suffix.
  const rawResponse = data.response
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()

  try {
    const parsed = JSON.parse(rawResponse)
    candidates = Array.isArray(parsed) ? parsed : (parsed.programs ?? parsed.results ?? [])
  } catch {
    console.error('Failed to parse Ollama JSON response')
    console.error('Raw response:', rawResponse.slice(0, 500))
    process.exit(1)
  }

  // Filter to objects with at least a name field
  candidates = candidates.filter(
    (c): c is ProgramCandidate => typeof c === 'object' && c !== null && typeof c.name === 'string' && c.name.length > 1
  )

  logStep({ step: 'generate', state, candidates: candidates.length, durationMs: Date.now() - start })
  return candidates
}

// ─── Step 2: Verify via SearXNG ───────────────────────────────────────────────

/**
 * Fetch SearXNG results for a query string. Returns an empty array on any error.
 * On HTTP success with zero results, retries once without the site: filter if
 * `fallbackQuery` is provided and differs from `query`.
 */
async function searxngSearch(query: string, fallbackQuery?: string): Promise<SearXNGResult[]> {
  const searchUrl = `http://localhost:8080/search?q=${encodeURIComponent(query)}&format=json`
  let results: SearXNGResult[] = []
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) })
    if (res.ok) {
      const data = (await res.json()) as SearXNGResponse
      results = data.results ?? []
    }
  } catch {
    // Network error — caller decides how to handle
    return []
  }

  // Retry without site filter if no results and a fallback query is available
  if (results.length === 0 && fallbackQuery && fallbackQuery !== query) {
    await delay(500)
    const fallbackUrl = `http://localhost:8080/search?q=${encodeURIComponent(fallbackQuery)}&format=json`
    try {
      const res = await fetch(fallbackUrl, { signal: AbortSignal.timeout(15_000) })
      if (res.ok) {
        const data = (await res.json()) as SearXNGResponse
        results = data.results ?? []
      }
    } catch {
      // Fall through with empty results
    }
  }

  return results
}

/**
 * Check whether a candidate name is corroborated by a set of SearXNG results.
 *
 * Match criteria (any one sufficient):
 *   1. A result URL is a .gov or .org domain (credible source, name is plausible)
 *   2. Any significant word from the program name (>3 chars) appears in a result
 *      title, URL, or content snippet within the top 10 results
 */
function isCorroborated(candidate: ProgramCandidate, results: SearXNGResult[]): SearXNGResult | null {
  const top10 = results.slice(0, 10)

  // Significant words: strip parentheses/punctuation, keep tokens longer than 3 chars
  const nameTokens = candidate.name
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3)

  for (const result of top10) {
    const urlLower = (result.url ?? '').toLowerCase()
    const titleLower = (result.title ?? '').toLowerCase()
    const contentLower = (result.content ?? '').toLowerCase()

    // Criterion 1: .gov or .org result URL — any result from a credible source
    // corroborates that the query topic is real
    if (/\.gov(\/|$)/.test(urlLower) || /\.org(\/|$)/.test(urlLower)) {
      return result
    }

    // Criterion 2: any significant name token found in title, URL, or content
    const haystack = `${titleLower} ${urlLower} ${contentLower}`
    if (nameTokens.some(token => haystack.includes(token))) {
      return result
    }
  }

  return null
}

async function verifyCandidates(
  candidates: ProgramCandidate[],
  state: string,
  skipVerify: boolean
): Promise<VerifiedProgram[]> {
  const start = Date.now()

  if (skipVerify) {
    const programs: VerifiedProgram[] = candidates.map(c => ({
      ...c,
      sourceUrl: c.website ?? `https://www.google.com/search?q=${encodeURIComponent(c.name + ' ' + state)}`,
    }))
    logStep({ step: 'verify', state, verified: programs.length, discarded: 0, skipped: true, durationMs: Date.now() - start })
    return programs
  }

  const verified: VerifiedProgram[] = []
  let discarded = 0
  let searxngDown = false

  for (const candidate of candidates) {
    await delay(500) // 2 req/sec — fast enough for a local instance

    // Primary query: name + state, no site: filter (site: filters cause zero results
    // when the rate-limited engines like Google/Brave are the only ones that support it)
    const primaryQuery = `${candidate.name} ${state} benefits`
    // Fallback: just name + state, even more permissive
    const fallbackQuery = `${candidate.name} ${state}`

    let results: SearXNGResult[] = []
    try {
      results = await searxngSearch(primaryQuery, fallbackQuery)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        JSON.stringify({ step: 'verify_warn', state, candidate: candidate.name, message: `SearXNG error: ${msg}` }) + '\n'
      )
      // If we get a network-level error (SearXNG itself is down), stop verifying
      searxngDown = true
      discarded += candidates.length - verified.length
      break
    }

    if (results.length === 0) {
      // SearXNG returned nothing — engines may all be suspended right now.
      // Accept the candidate if it already has a .gov/.org website from Ollama,
      // otherwise discard.
      if (candidate.website && /\.(gov|org)(\/|$)/.test(candidate.website.toLowerCase())) {
        verified.push({
          ...candidate,
          sourceUrl: candidate.website,
        })
      } else {
        process.stderr.write(
          JSON.stringify({ step: 'verify_discard', state, candidate: candidate.name, reason: 'no_results' }) + '\n'
        )
        discarded++
      }
      continue
    }

    const match = isCorroborated(candidate, results)
    if (match) {
      // Prefer a .gov/.org URL as source; fall back to the matching result's URL
      const govOrgResult = results.slice(0, 10).find(r =>
        /\.(gov|org)(\/|$)/.test((r.url ?? '').toLowerCase())
      )
      verified.push({
        ...candidate,
        sourceUrl: govOrgResult?.url ?? match.url,
      })
    } else {
      process.stderr.write(
        JSON.stringify({ step: 'verify_discard', state, candidate: candidate.name, reason: 'no_match' }) + '\n'
      )
      discarded++
    }
  }

  logStep({ step: 'verify', state, verified: verified.length, discarded, searxngDown, durationMs: Date.now() - start })
  return verified
}

// ─── Step 3: Extract Details from Verified Pages ──────────────────────────────

interface ExtractedDetails {
  phone?: string
  email?: string
  applicationUrl?: string
  applicationFormUrl?: string
  address?: string
}

function extractDetailsFromHtml(html: string): ExtractedDetails {
  const details: ExtractedDetails = {}

  // Phone: common US patterns
  const phoneMatch = html.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/)
  if (phoneMatch) details.phone = phoneMatch[0]

  // Email
  const emailMatch = html.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/)
  if (emailMatch) details.email = emailMatch[0]

  // PDF form links
  const pdfMatch = html.match(/href=["']([^"']*\.pdf[^"']*?)["']/i)
  if (pdfMatch && isValidUrl(pdfMatch[1])) {
    details.applicationFormUrl = pdfMatch[1]
  }

  // Application links: look for href containing apply/application/enrollment
  const appLinkMatch = html.match(/href=["']([^"']*(?:apply|application|enrollment|enroll|register)[^"']*?)["']/i)
  if (appLinkMatch) {
    const candidate = appLinkMatch[1]
    if (isValidUrl(candidate)) {
      details.applicationUrl = candidate
    }
  }

  // Address: street number + street name pattern
  const addrMatch = html.match(/\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Pl|Suite|Ste)\.?(?:\s+\d+)?,?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s+[A-Z]{2}\s+\d{5}/)
  if (addrMatch) details.address = addrMatch[0]

  return details
}

async function extractProgramDetails(
  programs: VerifiedProgram[],
  state: string
): Promise<VerifiedProgram[]> {
  const start = Date.now()
  let withFormUrl = 0
  let withAppUrl = 0

  const enriched: VerifiedProgram[] = []

  for (const program of programs) {
    await delay(500) // 500ms between fetches

    if (!isValidUrl(program.sourceUrl)) {
      enriched.push(program)
      continue
    }

    try {
      const res = await fetch(program.sourceUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FEEDBot/1.0; +https://feed.app)' },
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) {
        enriched.push(program)
        continue
      }

      const html = await res.text()
      const extracted = extractDetailsFromHtml(html)

      const updated: VerifiedProgram = {
        ...program,
        phone: program.phone ?? extracted.phone,
        email: program.email ?? extracted.email,
        address: program.address ?? extracted.address,
        applicationUrl: program.applicationUrl ?? extracted.applicationUrl,
        applicationFormUrl: program.applicationFormUrl ?? extracted.applicationFormUrl,
      }

      if (updated.applicationFormUrl) withFormUrl++
      if (updated.applicationUrl) withAppUrl++

      enriched.push(updated)
    } catch {
      enriched.push(program)
    }
  }

  logStep({ step: 'extract', state, withFormUrl, withAppUrl, durationMs: Date.now() - start })
  return enriched
}

// ─── Step 4: Normalize via Ollama ─────────────────────────────────────────────

async function normalizeProgram(program: VerifiedProgram, state: string): Promise<IngestPayload | null> {
  const prompt = `Given this raw benefit program data, produce a clean JSON object matching the schema below.

Raw data:
${JSON.stringify(program, null, 2)}

Output schema (all fields optional except name):
{
  "name": string,
  "category": string,
  "description": string,
  "address_line1": string or null,
  "state": "${state}",
  "phone": string or null (format: XXX-XXX-XXXX),
  "email": string or null,
  "website": string or null,
  "eligibility_requirements": string or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- name: official program name, title-cased
- phone: digits only in XXX-XXX-XXXX format, null if invalid
- website: must start with http:// or https://, null otherwise
- description: 1-3 clear sentences
- confidence: "high" if website is a .gov or .org domain, "medium" otherwise

Return ONLY the JSON object, no other text.`

  // 120s per-program — generous for CPU-bound qwen3:8b. On timeout or any error,
  // normalizePrograms() falls back to raw extracted data so no program is lost.
  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt,
        format: 'json',
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      process.stderr.write(
        JSON.stringify({ step: 'normalize_warn', program: program.name, reason: `HTTP ${res.status}` }) + '\n'
      )
      return null
    }

    const data = (await res.json()) as OllamaResponse
    // Strip qwen3 thinking-model prefix before parsing JSON
    const rawResponse = data.response
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim()
    const parsed = JSON.parse(rawResponse) as IngestPayload
    if (!parsed.name || parsed.name.trim().length < 2) return null
    return parsed
  } catch (err) {
    const name = err instanceof Error ? (err as Error & { name: string }).name : ''
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = name === 'TimeoutError' || name === 'AbortError' || msg.toLowerCase().includes('timeout')
    process.stderr.write(
      JSON.stringify({ step: 'normalize_warn', program: program.name, reason: isTimeout ? 'timeout' : msg }) + '\n'
    )
    return null
  }
}

function programToRawPayload(program: VerifiedProgram, state: string): IngestPayload {
  return {
    name: program.name,
    category: program.category,
    description: program.description,
    state,
    phone: program.phone,
    website: program.website,
    eligibility_requirements: program.eligibility,
    source_url: program.sourceUrl,
    application_url: program.applicationUrl,
    application_form_url: program.applicationFormUrl,
    confidence: program.website && /\.(gov|org)(\/|$)/.test(program.website.toLowerCase()) ? 'high' : 'medium',
  }
}

async function normalizePrograms(
  programs: VerifiedProgram[],
  state: string,
  skipNormalize: boolean
): Promise<IngestPayload[]> {
  const start = Date.now()
  const normalized: IngestPayload[] = []

  if (skipNormalize) {
    for (const program of programs) {
      normalized.push(programToRawPayload(program, state))
    }
    logStep({ step: 'normalize', state, normalized: normalized.length, skipped: true, durationMs: Date.now() - start })
    return normalized
  }

  let ollamaSuccesses = 0
  let ollamaFallbacks = 0

  for (const program of programs) {
    const result = await normalizeProgram(program, state)
    if (result) {
      ollamaSuccesses++
      normalized.push({
        ...result,
        source_url: program.sourceUrl,
        application_url: result.application_url ?? program.applicationUrl,
        application_form_url: result.application_form_url ?? program.applicationFormUrl,
      })
    } else {
      // Ollama timed out or failed — fall back to raw extracted data.
      // The program is NOT dropped; raw data from generate + extract is good enough.
      ollamaFallbacks++
      normalized.push(programToRawPayload(program, state))
    }
  }

  logStep({
    step: 'normalize',
    state,
    normalized: normalized.length,
    ollamaSuccesses,
    ollamaFallbacks,
    durationMs: Date.now() - start,
  })
  return normalized
}

// ─── Step 5: Match Federal Forms & State Portals ──────────────────────────────

function attachFormUrls(programs: IngestPayload[], state: string): IngestPayload[] {
  const statePortal = getStatePortal(state)
  const STATE_LEVEL_PROGRAMS = ['snap', 'medicaid', 'tanf', 'chip', '3squares', 'reach-up', 'reach ahead']

  return programs.map(program => {
    const updated = { ...program }

    // Federal form override
    const federalForm = findFederalForm(program.name ?? '')
    if (federalForm) {
      if (!updated.application_url && federalForm.applicationUrl) {
        updated.application_url = federalForm.applicationUrl
      }
      if (!updated.application_form_url && federalForm.formUrl) {
        updated.application_form_url = federalForm.formUrl
      }
    }

    // State portal attachment for state-administered programs
    if (statePortal) {
      const nameLower = (program.name ?? '').toLowerCase()
      const isStateLevelProgram = STATE_LEVEL_PROGRAMS.some(p => nameLower.includes(p))

      if (isStateLevelProgram) {
        if (!updated.application_url) {
          updated.application_url =
            statePortal.combinedAppUrl ??
            statePortal.snapAgencyUrl ??
            statePortal.medicaidUrl ??
            statePortal.dhsUrl
        }
        if (nameLower.includes('snap') || nameLower.includes('food') || nameLower.includes('3squares')) {
          updated.application_url = statePortal.snapAgencyUrl ?? statePortal.combinedAppUrl ?? updated.application_url
        }
        if (nameLower.includes('medicaid') || nameLower.includes('chip')) {
          updated.application_url = statePortal.medicaidUrl ?? statePortal.combinedAppUrl ?? updated.application_url
        }
        if (nameLower.includes('tanf') || nameLower.includes('reach')) {
          updated.application_url = statePortal.tanfUrl ?? statePortal.combinedAppUrl ?? updated.application_url
        }
      }
    }

    return updated
  })
}

// ─── Step 6: Push to Resource-Ingest Webhook ──────────────────────────────────

interface WebhookResult {
  accepted: number
  duplicates: number
  rejected: number
  errors: string[]
}

async function pushToWebhook(
  programs: IngestPayload[],
  state: string,
  webhookUrl: string
): Promise<WebhookResult> {
  const start = Date.now()

  // Attach ingest metadata and build external_id
  const payload: IngestPayload[] = programs.map(p => ({
    ...p,
    state: p.state ?? state,
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    external_id: `discovery-${state.toLowerCase()}-${toSlug(p.name ?? 'unknown')}`,
    confidence: p.confidence ?? 'medium',
  }))

  let pushed = 0
  let duplicates = 0
  let errors = 0
  const errorMessages: string[] = []

  // Push in batches of 20 to avoid oversized requests
  const BATCH_SIZE = 20
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AGENT_SYNC_SECRET
            ? { 'x-agent-key': process.env.AGENT_SYNC_SECRET }
            : {}),
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(30_000),
      })

      const result = await res.json() as { accepted?: number; duplicates?: number; rejected?: number; errors?: string[] }
      pushed += result.accepted ?? 0
      duplicates += result.duplicates ?? 0
      errors += result.rejected ?? 0
      if (result.errors?.length) errorMessages.push(...result.errors)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors += batch.length
      errorMessages.push(`Batch ${i / BATCH_SIZE + 1}: ${msg}`)
    }
  }

  logStep({ step: 'push', state, pushed, duplicates, errors, durationMs: Date.now() - start })
  return { accepted: pushed, duplicates, rejected: errors, errors: errorMessages }
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { state, dryRun, skipVerify, skipNormalize, webhookUrl } = parseArgs()

  console.error(JSON.stringify({ step: 'start', state, dryRun, skipVerify, skipNormalize, webhookUrl: dryRun ? '(dry-run)' : webhookUrl }))

  // Step 1: Generate
  const candidates = await generateCandidates(state)
  if (candidates.length === 0) {
    console.error('No candidates generated — check Ollama model and prompt')
    process.exit(1)
  }

  // Step 2: Verify
  const verified = await verifyCandidates(candidates, state, skipVerify)
  if (verified.length === 0) {
    console.error('No programs survived verification — use --skip-verify to bypass SearXNG check')
    process.exit(1)
  }

  // Step 3: Extract details
  const enriched = await extractProgramDetails(verified, state)

  // Step 4: Normalize
  const normalized = await normalizePrograms(enriched, state, skipNormalize)

  // Step 5: Attach form/portal URLs
  const withForms = attachFormUrls(normalized, state)

  // Step 6: Push or dry-run
  if (dryRun) {
    process.stdout.write(JSON.stringify(withForms, null, 2) + '\n')
    console.error(JSON.stringify({ step: 'dry-run', state, total: withForms.length }))
    return
  }

  const result = await pushToWebhook(withForms, state, webhookUrl)

  console.error(
    JSON.stringify({
      step: 'done',
      state,
      total: withForms.length,
      accepted: result.accepted,
      duplicates: result.duplicates,
      rejected: result.rejected,
    })
  )

  if (result.errors.length > 0) {
    console.error('Errors:')
    result.errors.forEach(e => console.error(' ', e))
  }
}

main().catch(err => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
