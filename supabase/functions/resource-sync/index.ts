/**
 * resource-sync Edge Function
 *
 * Syncs community resources from OpenStreetMap Overpass API into the FEED
 * resources table. Accepts any lat/lng/radius so it works for every location.
 *
 * POST /resource-sync
 * Body: {
 *   lat: number,          // Center latitude  (required)
 *   lng: number,          // Center longitude (required)
 *   radius_km?: number,   // Search radius in km (default 50)
 *   source_types?: string[] // e.g. ['osm'] — only 'osm' implemented here
 * }
 *
 * Authentication: x-sync-secret header matching RESOURCE_SYNC_SECRET env var,
 * OR a valid Supabase service-role JWT in Authorization header.
 *
 * Environment variables:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 *   RESOURCE_SYNC_SECRET      — optional shared secret for admin triggers
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-sync-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'FEED-Platform/1.0 (mutual-aid resource sync; contact via GitHub)'
const UPSERT_CHUNK_SIZE = 100

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncRequest {
  lat: number
  lng: number
  radius_km?: number
  source_types?: string[]
}

interface OsmNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags: Record<string, string>
}

interface OverpassResponse {
  elements: OsmNode[]
}

interface ResourceRow {
  external_id: string
  source: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null
  hours_of_operation: null
  // Raw lat/lon stored alongside; location geography computed via SQL
  status: string
  is_verified: boolean
  last_verified_at: string
}

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

/**
 * Converts a lat/lng + radius (km) to a bounding box [south, west, north, east].
 * Uses a simple flat-earth approximation — accurate enough for radii up to ~200 km.
 */
function toBbox(lat: number, lng: number, radiusKm: number): [number, number, number, number] {
  const latDelta = radiusKm / 111.0
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180))
  return [lat - latDelta, lng - lngDelta, lat + latDelta, lng + lngDelta]
}

// ---------------------------------------------------------------------------
// OSM → category mapping
// ---------------------------------------------------------------------------

function osmTagsToCategory(tags: Record<string, string>): string {
  const amenity = tags['amenity'] ?? ''
  const office = tags['office'] ?? ''
  const socialFacility = tags['social_facility'] ?? tags['social_facility:for'] ?? ''

  if (amenity === 'library') return 'education'
  if (amenity === 'school' || amenity === 'college' || amenity === 'university') return 'education'
  if (amenity === 'fire_station' || amenity === 'police') return 'emergency'
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') return 'healthcare'
  if (amenity === 'pharmacy') return 'healthcare'
  if (amenity === 'dentist') return 'healthcare'
  if (amenity === 'veterinary') return 'other'
  if (amenity === 'community_centre') return 'community'
  if (amenity === 'place_of_worship') return 'community'

  if (amenity === 'social_facility') {
    if (socialFacility.includes('food') || socialFacility === 'food_bank') return 'food'
    if (socialFacility.includes('shelter') || socialFacility === 'homeless_shelter') return 'housing'
    if (socialFacility.includes('housing')) return 'housing'
    if (socialFacility.includes('mental') || socialFacility === 'outreach') return 'mental_health'
    if (socialFacility.includes('employ')) return 'employment'
    if (socialFacility.includes('child') || socialFacility === 'childcare') return 'childcare'
    if (socialFacility.includes('senior') || socialFacility === 'nursing_home') return 'senior_services'
    if (socialFacility.includes('disab')) return 'disability_services'
    return 'other'
  }

  if (office === 'government') return 'government' as string  // category enum includes 'other' as fallback
  if (office === 'employment_agency') return 'employment'
  if (office === 'ngo' || office === 'nonprofit') return 'community'

  return 'other'
}

// Map OSM category strings to what the resource_category enum actually accepts.
// Any value not in the enum defaults to 'other'.
const VALID_CATEGORIES = new Set([
  'food', 'housing', 'healthcare', 'employment', 'education', 'legal',
  'transportation', 'utilities', 'clothing', 'financial', 'mental_health',
  'substance_abuse', 'domestic_violence', 'childcare', 'senior_services',
  'disability_services', 'veteran_services', 'immigration', 'other',
])

function safeCategory(raw: string): string {
  return VALID_CATEGORIES.has(raw) ? raw : 'other'
}

// ---------------------------------------------------------------------------
// Phone normalisation
// ---------------------------------------------------------------------------

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return raw  // return as-is if we can't normalise
}

// ---------------------------------------------------------------------------
// Transform OSM node → resource row
// ---------------------------------------------------------------------------

function transformNode(node: OsmNode): ResourceRow | null {
  const tags = node.tags ?? {}

  // Skip unnamed nodes — not useful as resources
  const name = tags['name']?.trim()
  if (!name) return null

  const rawCategory = osmTagsToCategory(tags)

  return {
    external_id: `osm_${node.id}`,
    source: 'osm',
    name,
    description: tags['description'] ?? null,
    category: safeCategory(rawCategory),
    address_line1: tags['addr:street']
      ? `${tags['addr:housenumber'] ? tags['addr:housenumber'] + ' ' : ''}${tags['addr:street']}`
      : null,
    city: tags['addr:city'] ?? null,
    state: tags['addr:state'] ?? null,
    zip_code: tags['addr:postcode'] ?? null,
    country: tags['addr:country'] ?? 'US',
    phone: normalizePhone(tags['phone'] ?? tags['contact:phone']),
    email: tags['email'] ?? tags['contact:email'] ?? null,
    website: tags['website'] ?? tags['contact:website'] ?? tags['url'] ?? null,
    hours_of_operation: null,  // OSM opening_hours is a complex format; store raw as description suffix
    status: 'approved',
    is_verified: true,
    last_verified_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Overpass fetch
// ---------------------------------------------------------------------------

async function fetchOsmNodes(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<OsmNode[]> {
  const bbox = `${south},${west},${north},${east}`

  const query = `
[out:json][timeout:45];
(
  node["amenity"="library"](${bbox});
  node["amenity"="fire_station"](${bbox});
  node["amenity"="police"](${bbox});
  node["amenity"="hospital"](${bbox});
  node["amenity"="clinic"](${bbox});
  node["amenity"="doctors"](${bbox});
  node["amenity"="dentist"](${bbox});
  node["amenity"="pharmacy"](${bbox});
  node["amenity"="social_facility"](${bbox});
  node["amenity"="community_centre"](${bbox});
  node["amenity"="place_of_worship"](${bbox});
  node["office"="government"](${bbox});
  node["office"="employment_agency"](${bbox});
  node["office"="ngo"](${bbox});
  node["office"="nonprofit"](${bbox});
  node["social_facility"="food_bank"](${bbox});
  node["social_facility"="shelter"](${bbox});
  node["social_facility"="homeless_shelter"](${bbox});
);
out body;
`.trim()

  // Overpass requires the query in a form-encoded `data` parameter.
  const body = new URLSearchParams({ data: query }).toString()

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Overpass API error ${response.status}: ${text.slice(0, 200)}`)
  }

  const json: OverpassResponse = await response.json()
  return (json.elements ?? []).filter((e): e is OsmNode => e.type === 'node')
}

// ---------------------------------------------------------------------------
// Chunk helper
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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
    // Auth: accept either a matching sync secret or the service-role JWT
    const syncSecret = Deno.env.get('RESOURCE_SYNC_SECRET')
    const requestSecret = req.headers.get('x-sync-secret')
    const authHeader = req.headers.get('authorization') ?? ''
    const isServiceRole = authHeader.startsWith('Bearer ') && authHeader.includes('service_role')

    if (syncSecret && requestSecret !== syncSecret && !isServiceRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    let params: SyncRequest
    try {
      params = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { lat, lng, radius_km = 50, source_types = ['osm'] } = params

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'lat and lng are required numeric fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(
        JSON.stringify({ error: 'lat must be -90..90, lng must be -180..180' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured')
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    const results: Record<string, { synced: number; skipped: number; errors: number }> = {}

    // ---- OSM sync ----
    if (source_types.includes('osm')) {
      const [south, west, north, east] = toBbox(lat, lng, radius_km)
      console.log(`OSM sync: bbox [${south.toFixed(4)}, ${west.toFixed(4)}, ${north.toFixed(4)}, ${east.toFixed(4)}]`)

      const nodes = await fetchOsmNodes(south, west, north, east)
      console.log(`OSM: fetched ${nodes.length} nodes`)

      const rows = nodes
        .map(transformNode)
        .filter((r): r is ResourceRow => r !== null)

      console.log(`OSM: ${rows.length} named nodes to upsert (${nodes.length - rows.length} unnamed skipped)`)

      let synced = 0
      let errors = 0

      for (const batch of chunk(rows, UPSERT_CHUNK_SIZE)) {
        // Build the rows with the PostGIS geography point computed inline.
        // Supabase JS upsert doesn't support raw SQL expressions, so we use
        // a stored procedure / RPC approach: insert the base fields then
        // UPDATE location via a raw SQL call. However, the simpler path is
        // to use supabase.rpc or execute the upsert via the REST API.
        //
        // We carry lat/lon from OSM and store them so the DB trigger or a
        // subsequent call can set the geography column. For now we upsert
        // the base row and then patch the location using a Postgres function.
        const baseRows = batch.map((r) => ({
          external_id: r.external_id,
          source: r.source,
          name: r.name,
          description: r.description,
          category: r.category,
          address_line1: r.address_line1,
          city: r.city,
          state: r.state,
          zip_code: r.zip_code,
          country: r.country,
          phone: r.phone,
          email: r.email,
          website: r.website,
          hours_of_operation: r.hours_of_operation,
          status: r.status,
          is_verified: r.is_verified,
          last_verified_at: r.last_verified_at,
        }))

        const { error: upsertErr } = await supabase
          .from('resources')
          .upsert(baseRows, {
            onConflict: 'external_id,source',
            ignoreDuplicates: false,
          })

        if (upsertErr) {
          console.error('Upsert error:', upsertErr)
          errors += batch.length
          continue
        }

        // Patch PostGIS location for each row individually using rpc
        // (Supabase upsert can't express ST_MakePoint inline).
        const nodeMap = new Map(nodes.map((n) => [`osm_${n.id}`, n]))
        for (const row of batch) {
          const node = nodeMap.get(row.external_id)
          if (!node) continue

          const { error: locationErr } = await supabase.rpc('set_resource_location', {
            p_external_id: row.external_id,
            p_source: row.source,
            p_lat: node.lat,
            p_lng: node.lon,
          })

          if (locationErr) {
            // Non-fatal: base row is inserted, location just won't be set
            console.warn(`Location patch failed for ${row.external_id}: ${locationErr.message}`)
          }
        }

        synced += batch.length
      }

      results['osm'] = { synced, skipped: nodes.length - rows.length, errors }
    }

    // ---- other source_types: placeholder for future providers ----
    for (const src of source_types.filter((s) => s !== 'osm')) {
      console.warn(`source_type '${src}' is not implemented in this function`)
      results[src] = { synced: 0, skipped: 0, errors: 0 }
    }

    const response = {
      success: true,
      location: { lat, lng, radius_km },
      results,
      timestamp: new Date().toISOString(),
    }

    console.log('resource-sync complete:', response)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('resource-sync fatal error:', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
