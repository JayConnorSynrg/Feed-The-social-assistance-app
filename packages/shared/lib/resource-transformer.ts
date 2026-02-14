/**
 * Resource Transformer Module
 *
 * Transforms resources received from remote federated instances into local format.
 * Handles validation, normalization, and attribution for federated resources.
 */

export interface RemoteResource {
  id: string
  name: string
  description?: string
  resource_type?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  email?: string
  website?: string
  latitude?: number
  longitude?: number
  hours_of_operation?: Record<string, unknown>
  metadata?: Record<string, unknown>
  updated_at?: string
  created_at?: string
}

export interface FederatedResourceInsert {
  source_instance_id: string
  original_resource_id: string
  resource_data: Record<string, unknown>
  resource_type: string
  trust_score: number
  sync_status: 'active' | 'stale' | 'removed'
  source_attribution: Record<string, unknown>
}

/**
 * Transforms a remote resource into the local federated_resources format
 */
export function transformFederatedResource(
  rawResource: RemoteResource,
  sourceInstanceId: string,
  sourceInstanceName: string,
  instanceTrustScore: number
): FederatedResourceInsert | null {
  // Validate the remote resource
  const validation = validateRemoteResource(rawResource)
  if (!validation.valid) {
    console.error('Resource validation failed:', validation.errors)
    return null
  }

  // Normalize the resource type
  const normalizedType = normalizeResourceType(rawResource.resource_type || 'other')

  // Build source attribution
  const sourceAttribution = {
    instance_name: sourceInstanceName,
    instance_id: sourceInstanceId,
    original_url: rawResource.website || null,
    synced_at: new Date().toISOString(),
    original_updated_at: rawResource.updated_at || null,
    original_created_at: rawResource.created_at || null,
  }

  // Map fields to local schema
  const resourceData: Record<string, unknown> = {
    name: rawResource.name,
    description: rawResource.description || null,
    resource_type: normalizedType,
    contact: {
      phone: rawResource.phone || null,
      email: rawResource.email || null,
      website: rawResource.website || null,
    },
    location: {
      address_line1: rawResource.address_line1 || null,
      city: rawResource.city || null,
      state: rawResource.state || null,
      zip_code: rawResource.zip_code || null,
      coordinates: rawResource.latitude && rawResource.longitude
        ? { latitude: rawResource.latitude, longitude: rawResource.longitude }
        : null,
    },
    hours_of_operation: rawResource.hours_of_operation || null,
    metadata: rawResource.metadata || {},
  }

  return {
    source_instance_id: sourceInstanceId,
    original_resource_id: rawResource.id,
    resource_data: resourceData,
    resource_type: normalizedType,
    trust_score: instanceTrustScore,
    sync_status: 'active',
    source_attribution: sourceAttribution,
  }
}

/**
 * Validates a remote resource for required fields and format correctness
 */
export function validateRemoteResource(resource: RemoteResource): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!resource.id || typeof resource.id !== 'string' || resource.id.trim() === '') {
    errors.push('Missing or invalid required field: id')
  }

  if (!resource.name || typeof resource.name !== 'string' || resource.name.trim() === '') {
    errors.push('Missing or invalid required field: name')
  }

  // Validate email format if provided
  if (resource.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(resource.email)) {
      errors.push('Invalid email format')
    }
  }

  // Validate phone format if provided (basic check for reasonable length and digits)
  if (resource.phone) {
    const digitsOnly = resource.phone.replace(/\D/g, '')
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      errors.push('Invalid phone format: must contain 10-15 digits')
    }
  }

  // Validate coordinates if provided
  if (resource.latitude !== undefined && resource.latitude !== null) {
    if (typeof resource.latitude !== 'number' || resource.latitude < -90 || resource.latitude > 90) {
      errors.push('Invalid latitude: must be between -90 and 90')
    }
  }

  if (resource.longitude !== undefined && resource.longitude !== null) {
    if (typeof resource.longitude !== 'number' || resource.longitude < -180 || resource.longitude > 180) {
      errors.push('Invalid longitude: must be between -180 and 180')
    }
  }

  // Ensure both coordinates are provided together
  const hasLat = resource.latitude !== undefined && resource.latitude !== null
  const hasLon = resource.longitude !== undefined && resource.longitude !== null
  if (hasLat !== hasLon) {
    errors.push('Both latitude and longitude must be provided together')
  }

  // Validate website URL format if provided
  if (resource.website) {
    try {
      new URL(resource.website)
    } catch {
      errors.push('Invalid website URL format')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Normalizes resource type strings to canonical types
 */
export function normalizeResourceType(type: string): string {
  const normalized = type.toLowerCase().trim()

  // Food-related resources
  if (normalized.includes('food') || normalized.includes('pantry') || normalized.includes('meal')) {
    return 'food'
  }

  // Housing-related resources
  if (normalized.includes('housing') || normalized.includes('shelter') || normalized.includes('home')) {
    return 'housing'
  }

  // Healthcare-related resources
  if (normalized.includes('health') || normalized.includes('medical') || normalized.includes('clinic')) {
    return 'healthcare'
  }

  // Employment-related resources
  if (normalized.includes('job') || normalized.includes('employ') || normalized.includes('career')) {
    return 'employment'
  }

  // Education-related resources
  if (normalized.includes('education') || normalized.includes('school') || normalized.includes('training')) {
    return 'education'
  }

  // Legal services
  if (normalized.includes('legal') || normalized.includes('law') || normalized.includes('attorney')) {
    return 'legal'
  }

  // Transportation
  if (normalized.includes('transport') || normalized.includes('transit') || normalized.includes('ride')) {
    return 'transportation'
  }

  // Financial assistance
  if (normalized.includes('financial') || normalized.includes('money') || normalized.includes('cash')) {
    return 'financial'
  }

  // Clothing
  if (normalized.includes('clothing') || normalized.includes('clothes') || normalized.includes('apparel')) {
    return 'clothing'
  }

  // Mental health
  if (normalized.includes('mental') || normalized.includes('counseling') || normalized.includes('therapy')) {
    return 'mental_health'
  }

  // Childcare
  if (normalized.includes('child') || normalized.includes('daycare') || normalized.includes('youth')) {
    return 'childcare'
  }

  // Veterans services
  if (normalized.includes('veteran') || normalized.includes('military')) {
    return 'veterans'
  }

  // Default to 'other' for unrecognized types
  return 'other'
}
