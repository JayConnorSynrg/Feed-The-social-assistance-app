#!/usr/bin/env npx ts-node
// scripts/seed-rutland-resources.ts
// Fetches Rutland VT community resources from OpenStreetMap (Overpass API)
// and inserts them into the hosted Supabase resources table.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... \
//   npx ts-node --project tsconfig.scripts.json apps/web/scripts/seed-rutland-resources.ts
//
// Or from apps/web/:
//   npx ts-node --project tsconfig.scripts.json scripts/seed-rutland-resources.ts

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Rutland VT wider bounding box: 43.4 N, -73.2 W, 43.8 N, -72.7 E
const BBOX = '43.4,-73.2,43.8,-72.7'

const OVERPASS_QUERY = `[out:json][timeout:45];(
  node["amenity"="library"](${BBOX});
  node["amenity"="fire_station"](${BBOX});
  node["amenity"="police"](${BBOX});
  node["amenity"="hospital"](${BBOX});
  node["amenity"="clinic"](${BBOX});
  node["amenity"="pharmacy"](${BBOX});
  node["amenity"="social_facility"](${BBOX});
  node["amenity"="community_centre"](${BBOX});
  node["office"="government"](${BBOX});
  node["shop"="supermarket"](${BBOX});
  node["shop"="grocery"](${BBOX});
  node["amenity"="food_bank"](${BBOX});
  node["amenity"="shelter"](${BBOX});
  node["amenity"="dentist"](${BBOX});
  node["amenity"="doctors"](${BBOX});
);out body;`

// Valid resource_category enum values in production DB
type ResourceCategory =
  | 'food'
  | 'healthcare'
  | 'housing'
  | 'employment'
  | 'financial'
  | 'legal'
  | 'mental_health'
  | 'utilities'
  | 'other'

function osmToCategory(tags: Record<string, string>): ResourceCategory {
  const amenity = tags.amenity
  const office = tags.office
  const shop = tags.shop
  const socialFacility = tags.social_facility

  if (amenity === 'library') return 'other'
  if (amenity === 'fire_station' || amenity === 'police') return 'other'
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors' || amenity === 'dentist') return 'healthcare'
  if (amenity === 'pharmacy') return 'healthcare'
  if (amenity === 'food_bank') return 'food'
  if (amenity === 'shelter') return 'housing'
  if (amenity === 'social_facility') {
    if (socialFacility === 'food_bank' || socialFacility === 'soup_kitchen' || socialFacility === 'meals_on_wheels') return 'food'
    if (socialFacility === 'shelter' || socialFacility === 'assisted_living') return 'housing'
    if (socialFacility === 'employment_agency') return 'employment'
    return 'other'
  }
  if (amenity === 'community_centre') return 'other'
  if (office === 'government') return 'other'
  if (shop === 'supermarket' || shop === 'grocery') return 'food'

  return 'other'
}

function buildDescription(tags: Record<string, string>, category: ResourceCategory): string {
  const city = tags['addr:city'] || 'Rutland area'
  const amenity = tags.amenity || tags.office || tags.shop
  if (amenity === 'library') return `Public library serving ${city}`
  if (amenity === 'fire_station') return `Fire station serving ${city}`
  if (amenity === 'police') return `Police department serving ${city}`
  if (amenity === 'hospital') return `Hospital providing medical care in ${city}`
  if (amenity === 'clinic' || amenity === 'doctors') return `Medical clinic in ${city}`
  if (amenity === 'dentist') return `Dental care provider in ${city}`
  if (amenity === 'pharmacy') return `Pharmacy in ${city}`
  if (amenity === 'social_facility') return `Social services facility in ${city}`
  if (amenity === 'community_centre') return `Community center in ${city}`
  if (amenity === 'food_bank') return `Food bank serving ${city}`
  if (amenity === 'shelter') return `Emergency shelter in ${city}`
  if (tags.office === 'government') return `Government office in ${city}`
  if (tags.shop === 'supermarket' || tags.shop === 'grocery') return `Grocery store in ${city}`
  return `${category} resource in ${city}`
}

interface OsmElement {
  id: number
  lat: number
  lon: number
  tags: Record<string, string>
}

async function fetchOsmData(): Promise<OsmElement[]> {
  console.log('Fetching OSM data for Rutland VT area...')
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FEED-Platform/1.0 (mutual-aid resource seeder)',
    },
  })

  if (!resp.ok) {
    throw new Error(`Overpass API error: ${resp.status} ${resp.statusText}`)
  }

  const data = await resp.json() as { elements: OsmElement[] }
  return data.elements || []
}

async function main() {
  const elements = await fetchOsmData()
  console.log(`Found ${elements.length} OSM elements`)

  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const el of elements) {
    const tags = el.tags || {}
    const rawName = tags.name
    if (!rawName) {
      // Skip unnamed nodes — not useful for a resource directory
      skipped++
      continue
    }

    const externalId = `osm_${el.id}`
    const category = osmToCategory(tags)
    const description = tags.description || buildDescription(tags, category)

    // Check if already exists (idempotent)
    const { data: existing } = await supabase
      .from('resources')
      .select('id')
      .eq('external_id', externalId)
      .eq('source', 'osm')
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    // Build address from OSM tags
    const houseNum = tags['addr:housenumber'] || ''
    const street = tags['addr:street'] || ''
    const addressLine1 = houseNum && street ? `${houseNum} ${street}` : (street || null)

    // Insert resource row (without location — set via RPC after)
    const { error: insertError } = await supabase.from('resources').insert({
      name: rawName,
      description,
      category,
      address_line1: addressLine1,
      city: tags['addr:city'] || 'Rutland',
      state: tags['addr:state'] || 'VT',
      zip_code: tags['addr:postcode'] || null,
      country: 'US',
      phone: tags.phone || tags['contact:phone'] || null,
      email: tags.email || tags['contact:email'] || null,
      website: tags.website || tags['contact:website'] || tags['url'] || null,
      hours_of_operation: tags.opening_hours ? { raw: tags.opening_hours } : null,
      source: 'osm',
      external_id: externalId,
      status: 'approved',
      is_verified: false,
    })

    if (insertError) {
      console.error(`  FAIL insert "${rawName}": ${insertError.message}`)
      failed++
      continue
    }

    // Set PostGIS location via RPC
    const { error: locError } = await supabase.rpc('set_resource_location', {
      p_external_id: externalId,
      p_source: 'osm',
      p_lat: el.lat,
      p_lng: el.lon,
    })

    if (locError) {
      console.warn(`  WARN location not set for "${rawName}": ${locError.message}`)
    }

    inserted++
    console.log(`  + ${rawName} [${category}] (${el.lat.toFixed(4)}, ${el.lon.toFixed(4)})`)
  }

  console.log(`\nComplete: ${inserted} inserted, ${skipped} skipped (unnamed or duplicate), ${failed} failed`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
