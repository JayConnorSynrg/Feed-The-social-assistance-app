/**
 * Canonical USPS state/territory list + full-name → postal-abbreviation map.
 *
 * Single source of truth for state values across the app. The `resources.state`
 * column stores 2-letter postal codes (e.g. 'VT'), so any user-facing value
 * (profile, dropdowns) must be normalized to the abbreviation before it is used
 * in a `.eq('state', ...)` filter — otherwise the query matches zero rows.
 */

/** 50 states + DC + 5 inhabited territories, full canonical names. */
export const US_STATES: string[] = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  'Puerto Rico', 'Guam', 'US Virgin Islands', 'American Samoa',
  'Northern Mariana Islands',
]

/** Full canonical name → 2-letter USPS code (all 56). */
export const STATE_TO_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'Puerto Rico': 'PR', 'Guam': 'GU', 'US Virgin Islands': 'VI',
  'American Samoa': 'AS', 'Northern Mariana Islands': 'MP',
}

/** Set of valid 2-letter codes (uppercase) for fast membership checks. */
const VALID_ABBRS = new Set(Object.values(STATE_TO_ABBR))

/** Lowercased full-name → abbreviation, for case-insensitive name matching. */
const LOWER_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_TO_ABBR).map(([name, abbr]) => [name.toLowerCase(), abbr])
)

/**
 * Normalize any state input to its 2-letter USPS postal code.
 *
 * Idempotent, case-insensitive, fail-open:
 * - null / empty / whitespace-only → `null`
 * - already a valid 2-letter code (any case) → that code, UPPERCASED
 * - matches a full canonical name (any case) → its abbreviation
 * - anything else → the trimmed input unchanged (fail-open, so an unrecognized
 *   value still attempts to match downstream rather than being nulled out)
 */
export function normalizeState(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim()
  if (trimmed === '') return null

  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && VALID_ABBRS.has(upper)) return upper

  const byName = LOWER_NAME_TO_ABBR[trimmed.toLowerCase()]
  if (byName) return byName

  return trimmed
}
