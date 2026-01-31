/**
 * 211 Data Transformation Layer
 *
 * Transforms data from the 211 API format to our internal resource schema.
 * Handles mapping categories, normalizing location data, and filling defaults.
 */

import type { API211Location } from './211-client'

/**
 * Our internal resource schema (matches Supabase table)
 */
export interface TransformedResource {
  external_id: string
  external_source: '211'
  name: string
  description: string | null
  category: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  county: string | null
  phone: string | null
  website: string | null
  email: string | null
  hours_of_operation: Record<string, string> | null
  latitude: number | null
  longitude: number | null
  organization_name: string | null
  services: string[] | null
  last_synced_at: string
  status: 'approved' // 211 data is pre-vetted
}

/**
 * Maps 211 taxonomy/service types to our category system
 */
const TAXONOMY_TO_CATEGORY: Record<string, string> = {
  // Food and Nutrition
  'BD': 'food',
  'BD-1800': 'food', // Food Pantries
  'BD-5000': 'food', // Meal Programs
  'BD-1800.2000': 'food', // Food Banks
  'food': 'food',
  'food_pantry': 'food',
  'meal': 'food',
  'nutrition': 'food',
  'snap': 'food',

  // Housing and Shelter
  'BH': 'housing',
  'BH-1800': 'housing', // Emergency Shelter
  'BH-3000': 'housing', // Transitional Housing
  'BH-8600': 'housing', // Rent Assistance
  'housing': 'housing',
  'shelter': 'housing',
  'homeless': 'housing',
  'rent': 'housing',

  // Healthcare
  'LF': 'healthcare',
  'LF-1100': 'healthcare', // Clinics
  'LF-4000': 'healthcare', // Mental Health
  'LF-4900': 'healthcare', // Dental
  'health': 'healthcare',
  'medical': 'healthcare',
  'clinic': 'healthcare',
  'hospital': 'healthcare',

  // Mental Health
  'RF': 'mental_health',
  'RF-6500': 'mental_health', // Counseling
  'mental_health': 'mental_health',
  'counseling': 'mental_health',
  'therapy': 'mental_health',

  // Substance Abuse
  'RX': 'substance_abuse',
  'RX-8000': 'substance_abuse', // Treatment
  'substance_abuse': 'substance_abuse',
  'addiction': 'substance_abuse',
  'recovery': 'substance_abuse',

  // Employment
  'ND': 'employment',
  'ND-2000': 'employment', // Job Training
  'ND-5000': 'employment', // Job Search
  'employment': 'employment',
  'job': 'employment',
  'career': 'employment',
  'workforce': 'employment',

  // Education
  'HH': 'education',
  'HH-3000': 'education', // Adult Education
  'HH-8000': 'education', // Tutoring
  'education': 'education',
  'school': 'education',
  'ged': 'education',
  'literacy': 'education',

  // Legal
  'FT': 'legal',
  'FT-4500': 'legal', // Legal Aid
  'legal': 'legal',
  'lawyer': 'legal',
  'court': 'legal',

  // Transportation
  'BT': 'transportation',
  'BT-4500': 'transportation', // Transit
  'transportation': 'transportation',
  'transit': 'transportation',
  'bus': 'transportation',

  // Utilities
  'BV': 'utilities',
  'BV-8200': 'utilities', // Utility Assistance
  'utilities': 'utilities',
  'energy': 'utilities',
  'electric': 'utilities',
  'water': 'utilities',

  // Clothing
  'BM': 'clothing',
  'BM-3000': 'clothing', // Clothing Donation
  'clothing': 'clothing',
  'clothes': 'clothing',

  // Financial
  'NT': 'financial',
  'NT-8400': 'financial', // Tax Assistance
  'financial': 'financial',
  'money': 'financial',
  'tax': 'financial',
  'budget': 'financial',

  // Childcare
  'PH': 'childcare',
  'PH-1400': 'childcare', // Day Care
  'childcare': 'childcare',
  'daycare': 'childcare',
  'child_care': 'childcare',

  // Senior Services
  'PS': 'senior_services',
  'PS-8200': 'senior_services', // Senior Centers
  'senior': 'senior_services',
  'elderly': 'senior_services',
  'aging': 'senior_services',

  // Disability Services
  'LD': 'disability_services',
  'LD-1500': 'disability_services', // Disability Support
  'disability': 'disability_services',
  'disabled': 'disability_services',
  'ada': 'disability_services',

  // Veteran Services
  'TD': 'veteran_services',
  'TD-1800': 'veteran_services', // VA Services
  'veteran': 'veteran_services',
  'military': 'veteran_services',

  // Domestic Violence
  'FN': 'domestic_violence',
  'FN-1500': 'domestic_violence', // DV Shelters
  'domestic_violence': 'domestic_violence',
  'abuse': 'domestic_violence',

  // Immigration
  'FJ': 'immigration',
  'FJ-3000': 'immigration', // Immigration Services
  'immigration': 'immigration',
  'immigrant': 'immigration',
  'refugee': 'immigration',
}

/**
 * Determines the best category for a 211 location based on its services
 */
function determineCategory(location: API211Location): string {
  // Check services/taxonomies first
  if (location.services) {
    for (const service of location.services) {
      if (service.taxonomies) {
        for (const taxonomy of service.taxonomies) {
          // Try exact ID match
          const byId = TAXONOMY_TO_CATEGORY[taxonomy.id]
          if (byId) return byId

          // Try name match (lowercase)
          const nameKey = taxonomy.name.toLowerCase()
          const byName = TAXONOMY_TO_CATEGORY[nameKey]
          if (byName) return byName

          // Try parent category
          if (taxonomy.parent) {
            const byParent = TAXONOMY_TO_CATEGORY[taxonomy.parent]
            if (byParent) return byParent
          }
        }
      }

      // Try service name
      const serviceKey = service.name.toLowerCase()
      for (const [key, category] of Object.entries(TAXONOMY_TO_CATEGORY)) {
        if (serviceKey.includes(key)) {
          return category
        }
      }
    }
  }

  // Try description keyword matching
  const description = (location.description || '').toLowerCase()
  const name = (location.name || '').toLowerCase()
  const searchText = `${name} ${description}`

  for (const [keyword, category] of Object.entries(TAXONOMY_TO_CATEGORY)) {
    if (searchText.includes(keyword)) {
      return category
    }
  }

  return 'other'
}

/**
 * Normalizes phone number format
 */
function normalizePhone(phones?: Array<{ number: string; type?: string }>): string | null {
  if (!phones || phones.length === 0) return null

  // Prefer main/primary phone
  const mainPhone = phones.find(
    (p) => p.type?.toLowerCase().includes('main') || p.type?.toLowerCase().includes('primary')
  )
  const phoneNumber = mainPhone?.number || phones[0].number

  // Clean up the phone number
  const cleaned = phoneNumber.replace(/\D/g, '')

  // Format as (XXX) XXX-XXXX for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }

  return phoneNumber
}

/**
 * Parses hours string into structured format
 */
function parseHours(
  hours?: string | Record<string, string>
): Record<string, string> | null {
  if (!hours) return null

  if (typeof hours === 'object') {
    return hours
  }

  // Try to parse common formats
  // "Mon-Fri 9am-5pm" or "Monday: 9:00 AM - 5:00 PM, Tuesday: ..."
  const result: Record<string, string> = {}

  // Simple case: single range for all days
  const simpleMatch = hours.match(/^([\w-]+)\s+(.+)$/i)
  if (simpleMatch) {
    const [, days, timeRange] = simpleMatch
    result[days] = timeRange
    return result
  }

  // Complex case: day-specific hours
  const dayPatterns = hours.split(/[,;]/).filter(Boolean)
  for (const pattern of dayPatterns) {
    const match = pattern.trim().match(/^(\w+):?\s*(.+)$/i)
    if (match) {
      const [, day, time] = match
      result[day] = time.trim()
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

/**
 * Transforms a single 211 location to our resource format
 */
export function transformLocation(location: API211Location): TransformedResource {
  const services = location.services?.map((s) => s.name).filter(Boolean) || null

  return {
    external_id: location.id,
    external_source: '211',
    name: location.name,
    description: location.description || null,
    category: determineCategory(location),
    address_line1: location.address?.address1 || null,
    address_line2: location.address?.address2 || null,
    city: location.address?.city || null,
    state: location.address?.state || null,
    zip_code: location.address?.zip || null,
    county: location.address?.county || null,
    phone: normalizePhone(location.phones),
    website: location.website || null,
    email: location.email || null,
    hours_of_operation: parseHours(location.hours),
    latitude: location.location?.latitude || null,
    longitude: location.location?.longitude || null,
    organization_name: location.organization?.name || null,
    services: services && services.length > 0 ? services : null,
    last_synced_at: new Date().toISOString(),
    status: 'approved',
  }
}

/**
 * Transforms an array of 211 locations
 */
export function transformLocations(
  locations: API211Location[]
): TransformedResource[] {
  return locations.map(transformLocation)
}

/**
 * Filters out invalid resources (missing required fields)
 */
export function filterValidResources(
  resources: TransformedResource[]
): TransformedResource[] {
  return resources.filter((r) => {
    // Must have name
    if (!r.name || r.name.trim().length === 0) return false

    // Must have location or address
    const hasLocation = r.latitude !== null && r.longitude !== null
    const hasAddress = r.city !== null || r.address_line1 !== null
    if (!hasLocation && !hasAddress) return false

    return true
  })
}

/**
 * Full transformation pipeline: transform and filter
 */
export function transform211Data(
  locations: API211Location[]
): TransformedResource[] {
  const transformed = transformLocations(locations)
  return filterValidResources(transformed)
}
