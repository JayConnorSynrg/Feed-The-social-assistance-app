// apps/web/src/lib/eligibility-screening.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Check Eligibility flow's answers as the benefits-screening edge function's request
// (supabase/functions/benefits-screening). The state is the one the member means, or none: a
// 2-letter code or an English state name is read as that state; anything else (a name in another
// language, a typo) is NOT a state, and buildScreeningRequest says so instead of guessing one. The
// chat panel then tells the member, in their language, to enter the 2-letter code — the screening
// never runs against a state the member did not choose.

/** The 2-letter codes the screening function accepts (the same set as its US_STATES). */
export const US_STATE_CODES: ReadonlySet<string> = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
])

export interface ScreeningRequest {
  household_size: number
  annual_income: number
  state: string
  age: number
  has_children: boolean
  is_disabled: boolean
}

export type ScreeningBuild = { ok: true; request: ScreeningRequest } | { ok: false; reason: 'unknown_state' }

/** Map guided-flow answers to the benefits-screening edge function request shape. */
export function buildScreeningRequest(answers: Record<string, string>): ScreeningBuild {
  // household-size: '1' | '2' | '3' | '4' | '5' | '6+'
  const householdSize = answers['household-size'] === '6+' ? 6 : parseInt(answers['household-size'] ?? '1', 10)

  // income: bucket string → midpoint annual income
  const incomeMap: Record<string, number> = {
    '0': 0,
    'under-1000': 6000,
    '1000-2000': 18000,
    '2000-3000': 30000,
    '3000-4000': 42000,
    '4000-5000': 54000,
    'over-5000': 72000,
  }
  const annualIncome = incomeMap[answers['income'] ?? '0'] ?? 0

  // state: text field — normalize to 2-letter abbreviation
  const stateRaw = (answers['state'] ?? '').trim().toUpperCase()
  // If already 2 chars, use as-is; otherwise try to match name → abbr via common map
  const STATE_ABBR: Record<string, string> = {
    VERMONT: 'VT', 'NEW YORK': 'NY', CALIFORNIA: 'CA', TEXAS: 'TX',
    FLORIDA: 'FL', ILLINOIS: 'IL', PENNSYLVANIA: 'PA', OHIO: 'OH',
    GEORGIA: 'GA', 'NORTH CAROLINA': 'NC', MICHIGAN: 'MI', 'NEW JERSEY': 'NJ',
    VIRGINIA: 'VA', WASHINGTON: 'WA', ARIZONA: 'AZ', MASSACHUSETTS: 'MA',
    TENNESSEE: 'TN', INDIANA: 'IN', MISSOURI: 'MO', MARYLAND: 'MD',
    WISCONSIN: 'WI', COLORADO: 'CO', MINNESOTA: 'MN', 'SOUTH CAROLINA': 'SC',
    ALABAMA: 'AL', LOUISIANA: 'LA', KENTUCKY: 'KY', OREGON: 'OR',
    OKLAHOMA: 'OK', CONNECTICUT: 'CT', UTAH: 'UT', NEVADA: 'NV',
    IOWA: 'IA', ARKANSAS: 'AR', MISSISSIPPI: 'MS', KANSAS: 'KS',
    'NEW MEXICO': 'NM', NEBRASKA: 'NE', 'WEST VIRGINIA': 'WV', IDAHO: 'ID',
    HAWAII: 'HI', 'NEW HAMPSHIRE': 'NH', MAINE: 'ME', MONTANA: 'MT',
    'RHODE ISLAND': 'RI', DELAWARE: 'DE', 'SOUTH DAKOTA': 'SD',
    'NORTH DAKOTA': 'ND', ALASKA: 'AK', 'DISTRICT OF COLUMBIA': 'DC',
    DC: 'DC', WYOMING: 'WY',
  }
  // An unknown value stays as typed and is refused below: never another state in its place.
  const state = stateRaw.length === 2 ? stateRaw : (STATE_ABBR[stateRaw] ?? stateRaw)
  if (!US_STATE_CODES.has(state)) return { ok: false, reason: 'unknown_state' }

  const hasChildren = answers['children'] === 'yes'
  const isDisabled = (answers['employment'] ?? '') === 'disability'

  // Default age to 35 — the flow doesn't collect age directly
  return {
    ok: true,
    request: {
      household_size: isNaN(householdSize) || householdSize < 1 ? 1 : householdSize,
      annual_income: annualIncome,
      state,
      age: 35,
      has_children: hasChildren,
      is_disabled: isDisabled,
    },
  }
}
