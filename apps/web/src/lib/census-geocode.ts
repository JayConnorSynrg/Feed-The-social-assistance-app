// apps/web/src/lib/census-geocode.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Server-only helpers for the US Census Geocoder one-row `addressbatch` call (benchmark
// Public_AR_Current). The Census service has no CORS, so it is only called from /api/geocode.
// FEED stores no third-party geocoder output: the result is a DRAFT pin that a person confirms
// or drags before anything is saved.
//
// Response row (CSV, one line per input row):
//   "1","<input>","Match","Exact","<matched address>","-72.57,44.26","<tiger id>","L"
//   "1","<input>","Match","Non_Exact","<matched address>","-72.57,44.26","<tiger id>","R"
//   "1","<input>","No_Match"          (or "Tie")

export const CENSUS_BATCH_URL = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'
export const CENSUS_BENCHMARK = 'Public_AR_Current'

export interface GeocodeInput {
  street: string
  city: string
  state: string
  zip: string
}

export type GeocodeMatch = 'exact' | 'non_exact' | 'none'

export interface GeocodeResult {
  match: GeocodeMatch
  lat: number | null
  lng: number | null
  matched_address: string | null
}

const NONE: GeocodeResult = { match: 'none', lat: null, lng: null, matched_address: null }

/** One CSV field: quote it and double any embedded quotes; strip line breaks. */
function csvField(v: string): string {
  return `"${v.replace(/[\r\n]+/g, ' ').replace(/"/g, '""').trim()}"`
}

/** The one-row batch file: Unique ID, Street address, City, State, ZIP. */
export function buildBatchCsv(input: GeocodeInput): string {
  return [ '1', input.street, input.city, input.state, input.zip ].map(csvField).join(',') + '\n'
}

/** Minimal CSV line parser (quoted fields with "" escapes). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/** Map the Census batch response body to {match, lat, lng, matched_address}. */
export function parseBatchResponse(body: string): GeocodeResult {
  const line = body.split(/\r?\n/).find((l) => l.trim().length > 0)
  if (!line) return NONE
  const f = parseCsvLine(line)
  if (f[2] !== 'Match') return NONE
  const kind = f[3] === 'Exact' ? 'exact' : f[3] === 'Non_Exact' ? 'non_exact' : null
  const coords = (f[5] ?? '').split(',').map((n) => Number(n))
  const [lng, lat] = coords
  if (!kind || coords.length !== 2 || !Number.isFinite(lng) || !Number.isFinite(lat)) return NONE
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return NONE
  return { match: kind, lng, lat, matched_address: f[4] ? f[4] : null }
}

/** Validate + trim the request body. Street is required; each field is capped. */
export function parseGeocodeBody(body: unknown): GeocodeInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  const field = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, 200) : '')
  const input = { street: field('street'), city: field('city'), state: field('state'), zip: field('zip') }
  if (!input.street) return null
  return input
}
