// supabase/functions/benefits-screening/index.ts
// Benefits Eligibility Screening via PolicyEngine API
// Maps household data to PolicyEngine format, returns eligible programs
// POST /benefits-screening with { household_size, annual_income, state, age, has_children, is_disabled }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const POLICYENGINE_API_URL = 'https://household.api.policyengine.org/us/calculate'
const POLICYENGINE_TOKEN_URL = Deno.env.get('POLICYENGINE_TOKEN_URL') || ''
const POLICYENGINE_CLIENT_ID = Deno.env.get('POLICYENGINE_CLIENT_ID') || ''
const POLICYENGINE_CLIENT_SECRET = Deno.env.get('POLICYENGINE_CLIENT_SECRET') || ''

// CORS configuration - matches existing Edge Function pattern
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'https://www.sourcetofeed.com', // Canonical prod origin (apex 307→www)
  'http://localhost:3000',
  'http://localhost:3001',
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(JSON.stringify({ level: 'warn', event: 'cors.origin.rejected', origin, fn: 'benefits-screening', allowedCount: ALLOWED_ORIGINS.length, timestamp: new Date().toISOString() }))
  }

  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// --- Types ---

interface ScreeningRequest {
  household_size: number
  annual_income: number
  state: string
  age: number
  has_children: boolean
  is_disabled: boolean
}

interface ProgramResult {
  name: string
  eligible: boolean
  estimated_monthly_amount: number
  description: string
}

interface ScreeningResponse {
  programs: ProgramResult[]
}

// Valid US state codes
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
])

// PolicyEngine uses full state names
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
}

// Program descriptions for the response
const PROGRAM_INFO: Record<string, { name: string; description: string }> = {
  snap: {
    name: 'SNAP (Food Stamps)',
    description: 'Supplemental Nutrition Assistance Program provides monthly funds for purchasing food at authorized retailers.',
  },
  medicaid: {
    name: 'Medicaid',
    description: 'Federal-state health coverage program for low-income individuals and families.',
  },
  tanf: {
    name: 'TANF (Cash Assistance)',
    description: 'Temporary Assistance for Needy Families provides cash benefits and support services to families with children.',
  },
  wic: {
    name: 'WIC',
    description: 'Special Supplemental Nutrition Program for Women, Infants, and Children provides food, nutrition education, and healthcare referrals.',
  },
  ssi: {
    name: 'SSI',
    description: 'Supplemental Security Income provides monthly payments to people with limited income who are aged 65+, blind, or disabled.',
  },
  eitc: {
    name: 'EITC (Earned Income Tax Credit)',
    description: 'Refundable tax credit for low-to-moderate income workers, especially those with children.',
  },
}

// --- Validation ---

function validateRequest(body: unknown): { valid: true; data: ScreeningRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' }
  }

  const b = body as Record<string, unknown>

  if (typeof b.household_size !== 'number' || !Number.isInteger(b.household_size) || b.household_size < 1 || b.household_size > 20) {
    return { valid: false, error: 'household_size must be an integer between 1 and 20' }
  }

  if (typeof b.annual_income !== 'number' || b.annual_income < 0 || b.annual_income > 10_000_000) {
    return { valid: false, error: 'annual_income must be a number between 0 and 10,000,000' }
  }

  if (typeof b.state !== 'string' || !US_STATES.has(b.state.toUpperCase())) {
    return { valid: false, error: `state must be a valid 2-letter US state code (e.g., "CA", "NY")` }
  }

  if (typeof b.age !== 'number' || !Number.isInteger(b.age) || b.age < 0 || b.age > 120) {
    return { valid: false, error: 'age must be an integer between 0 and 120' }
  }

  if (typeof b.has_children !== 'boolean') {
    return { valid: false, error: 'has_children must be a boolean' }
  }

  if (typeof b.is_disabled !== 'boolean') {
    return { valid: false, error: 'is_disabled must be a boolean' }
  }

  return {
    valid: true,
    data: {
      household_size: b.household_size,
      annual_income: b.annual_income,
      state: b.state.toUpperCase(),
      age: b.age,
      has_children: b.has_children,
      is_disabled: b.is_disabled,
    },
  }
}

// --- PolicyEngine integration ---

// Cache the bearer token to avoid re-fetching on every warm invocation
let cachedToken: { token: string; expiresAt: number } | null = null

async function getPolicyEngineToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  if (!POLICYENGINE_TOKEN_URL || !POLICYENGINE_CLIENT_ID || !POLICYENGINE_CLIENT_SECRET) {
    throw new Error('PolicyEngine credentials not configured')
  }

  const response = await fetch(POLICYENGINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: POLICYENGINE_CLIENT_ID,
      client_secret: POLICYENGINE_CLIENT_SECRET,
      audience: 'https://household.api.policyengine.org',
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  }
  return cachedToken.token
}

function buildPolicyEnginePayload(input: ScreeningRequest): Record<string, unknown> {
  const year = new Date().getFullYear().toString()
  const stateName = STATE_NAMES[input.state]

  // Build people — primary applicant plus additional household members
  const people: Record<string, Record<string, Record<string, unknown>>> = {
    you: {
      age: { [year]: input.age },
      employment_income: { [year]: input.annual_income },
      is_disabled: { [year]: input.is_disabled },
    },
  }

  const memberNames = ['you']

  // Add a child if has_children (age 5, conservative for WIC/SNAP calculations)
  if (input.has_children) {
    people['child'] = {
      age: { [year]: 5 },
      employment_income: { [year]: 0 },
    }
    memberNames.push('child')
  }

  // Add additional household members beyond primary + optional child
  const additionalCount = input.household_size - 1 - (input.has_children ? 1 : 0)
  for (let i = 0; i < additionalCount; i++) {
    const name = `member_${i + 1}`
    people[name] = {
      age: { [year]: 30 },
      employment_income: { [year]: 0 },
    }
    memberNames.push(name)
  }

  return {
    household: {
      people,
      households: {
        your_household: {
          members: memberNames,
          state_name: { [year]: stateName },
        },
      },
      families: {
        your_family: {
          members: memberNames,
        },
      },
      tax_units: {
        your_tax_unit: {
          members: memberNames,
        },
      },
      marital_units: {
        your_marital_unit: {
          members: ['you'],
        },
      },
      spm_units: {
        your_spm_unit: {
          members: memberNames,
        },
      },
    },
  }
}

function extractPrograms(result: Record<string, unknown>): ProgramResult[] {
  const programs: ProgramResult[] = []
  const r = result as Record<string, Record<string, Record<string, Record<string, number | boolean>>>>
  const year = new Date().getFullYear().toString()

  // SNAP — on spm_units, monthly value
  const snapMonthly = r?.spm_units?.your_spm_unit?.snap?.[year] ?? 0
  const snapEligible = r?.spm_units?.your_spm_unit?.is_snap_eligible?.[year] ?? false
  programs.push({
    ...PROGRAM_INFO.snap,
    eligible: Boolean(snapEligible) || snapMonthly > 0,
    estimated_monthly_amount: Math.round(Number(snapMonthly) * 100) / 100,
  })

  // Medicaid — on people (person-level), yearly cost value
  // Eligibility is the meaningful signal; medicaid variable is the cost value
  const medicaidEligible = r?.people?.you?.is_medicaid_eligible?.[year] ?? false
  const medicaidValue = r?.people?.you?.medicaid?.[year] ?? 0
  programs.push({
    ...PROGRAM_INFO.medicaid,
    eligible: Boolean(medicaidEligible),
    // Medicaid is coverage, not a cash benefit — report monthly equivalent of coverage value
    estimated_monthly_amount: Math.round((Number(medicaidValue) / 12) * 100) / 100,
  })

  // TANF — on spm_units, yearly value
  const tanfYearly = r?.spm_units?.your_spm_unit?.tanf?.[year] ?? 0
  programs.push({
    ...PROGRAM_INFO.tanf,
    eligible: Number(tanfYearly) > 0,
    estimated_monthly_amount: Math.round((Number(tanfYearly) / 12) * 100) / 100,
  })

  // WIC — on people (person-level), monthly value
  // Check primary applicant and child if present
  const wicYou = r?.people?.you?.wic?.[year] ?? 0
  const wicChild = r?.people?.child?.wic?.[year] ?? 0
  const totalWic = Number(wicYou) + Number(wicChild)
  programs.push({
    ...PROGRAM_INFO.wic,
    eligible: totalWic > 0,
    estimated_monthly_amount: Math.round(totalWic * 100) / 100,
  })

  // SSI — on people (person-level), monthly value
  const ssiMonthly = r?.people?.you?.ssi?.[year] ?? 0
  const ssiEligible = r?.people?.you?.is_ssi_eligible?.[year] ?? false
  programs.push({
    ...PROGRAM_INFO.ssi,
    eligible: Boolean(ssiEligible) || Number(ssiMonthly) > 0,
    estimated_monthly_amount: Math.round(Number(ssiMonthly) * 100) / 100,
  })

  // EITC — on tax_units, yearly value
  const eitcYearly = r?.tax_units?.your_tax_unit?.eitc?.[year] ?? 0
  programs.push({
    ...PROGRAM_INFO.eitc,
    eligible: Number(eitcYearly) > 0,
    // EITC is annual — show monthly equivalent
    estimated_monthly_amount: Math.round((Number(eitcYearly) / 12) * 100) / 100,
  })

  return programs
}

// --- Structured logging ---

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    function: 'benefits-screening',
    message,
    ...data,
  }
  console.log(JSON.stringify(entry))
}

// --- Main handler ---

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Parse and validate input
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validation = validateRequest(body)
    if (!validation.valid) {
      log('warn', 'Validation failed', { error: validation.error })
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const input = validation.data
    log('info', 'Screening request received', {
      state: input.state,
      household_size: input.household_size,
      has_children: input.has_children,
    })

    // Build PolicyEngine payload
    const payload = buildPolicyEnginePayload(input)

    // Get auth token
    let token: string
    try {
      token = await getPolicyEngineToken()
    } catch (err) {
      log('error', 'PolicyEngine token acquisition failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return new Response(
        JSON.stringify({
          error: 'Benefits screening service temporarily unavailable',
          detail: 'Unable to authenticate with eligibility calculation service',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call PolicyEngine
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    let peResponse: Response
    try {
      peResponse = await fetch(POLICYENGINE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      log('error', 'PolicyEngine API call failed', {
        error: err instanceof Error ? err.message : String(err),
        timeout: isTimeout,
      })
      return new Response(
        JSON.stringify({
          error: 'Benefits screening service temporarily unavailable',
          detail: isTimeout
            ? 'Eligibility calculation timed out — try again shortly'
            : 'Unable to reach eligibility calculation service',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    clearTimeout(timeoutId)

    if (!peResponse.ok) {
      const errorBody = await peResponse.text()
      log('error', 'PolicyEngine API returned error', {
        status: peResponse.status,
        body: errorBody.slice(0, 500),
      })
      return new Response(
        JSON.stringify({
          error: 'Benefits screening calculation failed',
          detail: `Eligibility service returned status ${peResponse.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse result
    const peResult = await peResponse.json()
    if (!peResult.result) {
      log('error', 'PolicyEngine response missing result field', {
        keys: Object.keys(peResult),
      })
      return new Response(
        JSON.stringify({
          error: 'Unexpected response from eligibility service',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract program eligibility
    const programs = extractPrograms(peResult.result)

    log('info', 'Screening complete', {
      state: input.state,
      eligible_count: programs.filter(p => p.eligible).length,
      total_programs: programs.length,
    })

    const response: ScreeningResponse = { programs }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    log('error', 'Unhandled error in benefits-screening', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
