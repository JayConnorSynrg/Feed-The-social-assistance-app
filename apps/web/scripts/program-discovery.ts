#!/usr/bin/env npx tsx
/**
 * program-discovery.ts
 *
 * Discovers benefit programs for a US state using OpenRouter + duck-duck-scrape,
 * then pushes verified results to the resource-ingest webhook.
 *
 * No local infrastructure required — zero Docker, zero Ollama, zero SearXNG.
 *
 * Usage:
 *   npx tsx apps/web/scripts/program-discovery.ts --state VT [--dry-run] [--skip-verify] [--skip-normalize] [--model MODEL] [--webhook-url URL]
 *
 * Environment:
 *   OPENROUTER_API_KEY  (required) — get one at https://openrouter.ai/keys
 */

import { search, SafeSearchType } from 'duck-duck-scrape'
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

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
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
  model: string
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
  let model = 'qwen/qwen3-8b'

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
    } else if (args[i] === '--model' && args[i + 1]) {
      model = args[++i]
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

  // Validate API key presence early
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: Set OPENROUTER_API_KEY environment variable. Get one at https://openrouter.ai/keys')
    process.exit(1)
  }

  return { state, dryRun, skipVerify, skipNormalize, webhookUrl, model }
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

// ─── Delay Helper ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── OpenRouter LLM call ──────────────────────────────────────────────────────

async function callOpenRouter(
  messages: OpenRouterMessage[],
  model: string,
  timeoutMs = 60_000
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY!

  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://feed.app',
        'X-Title': 'FEED Program Discovery',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const name = err instanceof Error ? (err as Error & { name: string }).name : ''
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = name === 'TimeoutError' || name === 'AbortError' || msg.toLowerCase().includes('timeout')
    if (isTimeout) {
      throw new Error(`OpenRouter request timed out after ${timeoutMs / 1000}s`)
    }
    throw new Error(`Network error calling OpenRouter: ${msg}`)
  }

  if (response.status === 401) {
    console.error('Error: Invalid OPENROUTER_API_KEY. Verify your key at https://openrouter.ai/keys')
    process.exit(1)
  }

  if (response.status === 429) {
    throw new Error('Rate limited by OpenRouter. Wait a moment and retry.')
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenRouter returned HTTP ${response.status}: ${body}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const content = data.choices?.[0]?.message?.content ?? ''

  // qwen3 is a reasoning model — strip <think>…</think> blocks before returning
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

// ─── Step 1: Generate Candidates via OpenRouter ───────────────────────────────

async function generateCandidates(state: string, model: string): Promise<ProgramCandidate[]> {
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

  const MAX_GENERATE_ATTEMPTS = 3
  const RETRY_DELAY_MS = [1_000, 2_000] // delays before attempt 2 and 3

  let rawContent: string = ''
  for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
    try {
      rawContent = await callOpenRouter(
        [{ role: 'user', content: prompt }],
        model,
        90_000 // 90s — cloud inference is fast (5-15s typically)
      )
      break // success — exit retry loop
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt < MAX_GENERATE_ATTEMPTS) {
        const delay = RETRY_DELAY_MS[attempt - 1] ?? 2_000
        console.warn(`OpenRouter generate attempt ${attempt}/${MAX_GENERATE_ATTEMPTS} failed (${msg}). Retrying in ${delay}ms…`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw new Error(`OpenRouter generate step failed: ${msg}`)
      }
    }
  }

  let candidates: ProgramCandidate[] = []
  try {
    const parsed = JSON.parse(rawContent)
    candidates = Array.isArray(parsed) ? parsed : (parsed.programs ?? parsed.results ?? [])
  } catch {
    console.error('Failed to parse OpenRouter JSON response')
    console.error('Raw content:', rawContent.slice(0, 500))
    throw new Error('Failed to parse OpenRouter JSON response')
  }

  // Filter to objects with at least a name field
  candidates = candidates.filter(
    (c): c is ProgramCandidate =>
      typeof c === 'object' && c !== null && typeof c.name === 'string' && c.name.length > 1
  )

  logStep({ step: 'generate', state, candidates: candidates.length, model, durationMs: Date.now() - start })
  return candidates
}

// ─── Step 2: Verify via duck-duck-scrape ──────────────────────────────────────

/**
 * Check whether a candidate name is corroborated by a DDG search result.
 *
 * Match criteria (any one sufficient):
 *   1. A result URL is a .gov or .org domain
 *   2. Any significant word from the program name (>3 chars) appears in
 *      a result title, URL, or snippet within the top 10 results
 */
function isCorroborated(
  name: string,
  title: string,
  url: string,
  description: string
): boolean {
  const urlLower = (url ?? '').toLowerCase()
  const titleLower = (title ?? '').toLowerCase()
  const descLower = (description ?? '').toLowerCase()

  // Criterion 1: credible domain
  if (/\.gov(\/|$)/.test(urlLower) || /\.org(\/|$)/.test(urlLower)) {
    return true
  }

  // Criterion 2: significant name token found anywhere
  const nameTokens = name
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3)

  const haystack = `${titleLower} ${urlLower} ${descLower}`
  return nameTokens.some(token => haystack.includes(token))
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

  for (const candidate of candidates) {
    // 1500ms between searches — DDG rate-limits bursts; 1.5s keeps under threshold
    await delay(1500)

    const query = `${candidate.name} ${state} benefits`

    let ddgResults: Awaited<ReturnType<typeof search>> | null = null
    try {
      ddgResults = await search(query, { safeSearch: SafeSearchType.OFF })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        JSON.stringify({ step: 'verify_warn', state, candidate: candidate.name, message: `DDG search error: ${msg}` }) + '\n'
      )
      // On DDG error, fall back: accept if already has a .gov/.org website, else discard
      if (candidate.website && /\.(gov|org)(\/|$)/.test(candidate.website.toLowerCase())) {
        verified.push({ ...candidate, sourceUrl: candidate.website })
      } else {
        discarded++
      }
      continue
    }

    const results = ddgResults?.results ?? []

    if (results.length === 0) {
      // No results — accept if candidate already provided a credible website
      if (candidate.website && /\.(gov|org)(\/|$)/.test(candidate.website.toLowerCase())) {
        verified.push({ ...candidate, sourceUrl: candidate.website })
      } else {
        process.stderr.write(
          JSON.stringify({ step: 'verify_discard', state, candidate: candidate.name, reason: 'no_results' }) + '\n'
        )
        discarded++
      }
      continue
    }

    // Check top 10 results for corroboration
    const top10 = results.slice(0, 10)
    let matched = false
    let sourceUrl: string | null = null

    for (const r of top10) {
      if (isCorroborated(candidate.name, r.title ?? '', r.url ?? '', r.description ?? '')) {
        matched = true
        // Prefer a .gov/.org source URL
        const urlLower = (r.url ?? '').toLowerCase()
        if (!sourceUrl || /\.(gov|org)(\/|$)/.test(urlLower)) {
          sourceUrl = r.url ?? null
        }
        if (/\.(gov|org)(\/|$)/.test(urlLower)) break // take first credible hit
      }
    }

    if (matched && sourceUrl) {
      verified.push({ ...candidate, sourceUrl })
    } else {
      process.stderr.write(
        JSON.stringify({ step: 'verify_discard', state, candidate: candidate.name, reason: 'no_match' }) + '\n'
      )
      discarded++
    }
  }

  logStep({ step: 'verify', state, verified: verified.length, discarded, durationMs: Date.now() - start })
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
    await delay(750) // 750ms between page fetches

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

// ─── Step 4: Normalize via OpenRouter ────────────────────────────────────────

async function normalizeProgram(
  program: VerifiedProgram,
  state: string,
  model: string
): Promise<IngestPayload | null> {
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

  try {
    const rawContent = await callOpenRouter(
      [{ role: 'user', content: prompt }],
      model,
      60_000 // 60s per program — cloud inference is fast
    )
    const parsed = JSON.parse(rawContent) as IngestPayload
    if (!parsed.name || parsed.name.trim().length < 2) return null
    return parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(
      JSON.stringify({ step: 'normalize_warn', program: program.name, reason: msg }) + '\n'
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
  skipNormalize: boolean,
  model: string
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

  let openRouterSuccesses = 0
  let openRouterFallbacks = 0

  for (const program of programs) {
    const result = await normalizeProgram(program, state, model)
    if (result) {
      openRouterSuccesses++
      normalized.push({
        ...result,
        source_url: program.sourceUrl,
        application_url: result.application_url ?? program.applicationUrl,
        application_form_url: result.application_form_url ?? program.applicationFormUrl,
      })
    } else {
      // OpenRouter failed — fall back to raw extracted data. Program is not dropped.
      openRouterFallbacks++
      normalized.push(programToRawPayload(program, state))
    }
  }

  logStep({
    step: 'normalize',
    state,
    normalized: normalized.length,
    openRouterSuccesses,
    openRouterFallbacks,
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
  const { state, dryRun, skipVerify, skipNormalize, webhookUrl, model } = parseArgs()

  console.error(JSON.stringify({
    step: 'start',
    state,
    dryRun,
    skipVerify,
    skipNormalize,
    model,
    webhookUrl: dryRun ? '(dry-run)' : webhookUrl,
  }))

  // Step 1: Generate
  const candidates = await generateCandidates(state, model)
  if (candidates.length === 0) {
    console.error('No candidates generated — check OpenRouter API key and model name')
    process.exit(1)
  }

  // Step 2: Verify
  const verified = await verifyCandidates(candidates, state, skipVerify)
  if (verified.length === 0) {
    console.error('No programs survived verification — use --skip-verify to bypass DDG check')
    process.exit(1)
  }

  // Step 3: Extract details
  const enriched = await extractProgramDetails(verified, state)

  // Step 4: Normalize
  const normalized = await normalizePrograms(enriched, state, skipNormalize, model)

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
