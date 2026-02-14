/**
 * Conflict Detector Module
 *
 * Detects and classifies conflicts when resources sync from multiple federation partners.
 * Handles duplicate detection, divergent data, deletions, and schema mismatches.
 */

export type ConflictType = 'duplicate' | 'divergent_data' | 'deleted' | 'schema_mismatch'
export type ConflictSeverity = 'low' | 'medium' | 'high'

export interface ConflictField {
  field: string
  localValue: unknown
  remoteValue: unknown
}

export interface DetectedConflict {
  type: ConflictType
  severity: ConflictSeverity
  localResourceId: string
  remoteResourceId: string
  sourceInstanceId: string
  conflictingFields: ConflictField[]
  detectedAt: string
  autoResolvable: boolean
  suggestedResolution?: 'keep_local' | 'keep_remote' | 'merge' | 'manual_review'
}

/**
 * Critical fields that require manual review when conflicts occur
 */
const CRITICAL_FIELDS = new Set([
  'name',
  'title',
  'address',
  'street_address',
  'phone',
  'phone_number',
  'contact_phone',
  'email',
  'contact_email',
  'latitude',
  'longitude',
  'location',
  'coordinates'
])

/**
 * Important fields that need careful handling but may be auto-resolved
 */
const IMPORTANT_FIELDS = new Set([
  'description',
  'hours',
  'operating_hours',
  'services',
  'eligibility',
  'website',
  'url',
  'status',
  'availability'
])

/**
 * Metadata fields that are typically safe to auto-resolve
 */
const METADATA_FIELDS = new Set([
  'created_at',
  'updated_at',
  'last_modified',
  'source',
  'tags',
  'categories',
  'notes',
  'metadata'
])

/**
 * Detects conflicts between local and remote resources
 *
 * @param localResource - The local version of the resource
 * @param remoteResource - The remote version of the resource
 * @param sourceInstanceId - The federation instance providing the remote resource
 * @param sourceTrustScore - Trust score of the source instance (0-1)
 * @returns Array of detected conflicts
 */
export function detectConflicts(
  localResource: Record<string, unknown>,
  remoteResource: Record<string, unknown>,
  sourceInstanceId: string,
  sourceTrustScore: number
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = []
  const conflictingFields: ConflictField[] = []

  // Get all unique field keys from both resources
  const allFields = new Set([
    ...Object.keys(localResource),
    ...Object.keys(remoteResource)
  ])

  // Check for schema mismatches (fields present in one but not the other)
  const localOnlyFields = Object.keys(localResource).filter(
    key => !(key in remoteResource)
  )
  const remoteOnlyFields = Object.keys(remoteResource).filter(
    key => !(key in localResource)
  )

  if (localOnlyFields.length > 0 || remoteOnlyFields.length > 0) {
    const schemaMismatchFields: ConflictField[] = []

    localOnlyFields.forEach(field => {
      schemaMismatchFields.push({
        field,
        localValue: localResource[field],
        remoteValue: undefined
      })
    })

    remoteOnlyFields.forEach(field => {
      schemaMismatchFields.push({
        field,
        localValue: undefined,
        remoteValue: remoteResource[field]
      })
    })

    const severity = classifyConflictSeverity(
      schemaMismatchFields[0]?.field || 'unknown',
      schemaMismatchFields[0]?.localValue,
      schemaMismatchFields[0]?.remoteValue
    )

    const conflict: DetectedConflict = {
      type: 'schema_mismatch',
      severity,
      localResourceId: (localResource.id as string) || 'unknown',
      remoteResourceId: (remoteResource.id as string) || 'unknown',
      sourceInstanceId,
      conflictingFields: schemaMismatchFields,
      detectedAt: new Date().toISOString(),
      autoResolvable: false
    }

    conflict.autoResolvable = isAutoResolvable(conflict, sourceTrustScore)
    conflicts.push(conflict)
  }

  // Check for divergent data in shared fields
  for (const field of allFields) {
    // Skip if field doesn't exist in both
    if (!(field in localResource) || !(field in remoteResource)) {
      continue
    }

    const localValue = localResource[field]
    const remoteValue = remoteResource[field]

    // Compare values (deep equality for objects/arrays)
    if (!areValuesEqual(localValue, remoteValue)) {
      conflictingFields.push({
        field,
        localValue,
        remoteValue
      })
    }
  }

  // If there are divergent fields, create a divergent_data conflict
  if (conflictingFields.length > 0) {
    // Determine overall severity based on most severe field
    let maxSeverity: ConflictSeverity = 'low'
    for (const cf of conflictingFields) {
      const fieldSeverity = classifyConflictSeverity(
        cf.field,
        cf.localValue,
        cf.remoteValue
      )
      if (fieldSeverity === 'high') {
        maxSeverity = 'high'
        break
      } else if (fieldSeverity === 'medium' && maxSeverity === 'low') {
        maxSeverity = 'medium'
      }
    }

    const conflict: DetectedConflict = {
      type: 'divergent_data',
      severity: maxSeverity,
      localResourceId: (localResource.id as string) || 'unknown',
      remoteResourceId: (remoteResource.id as string) || 'unknown',
      sourceInstanceId,
      conflictingFields,
      detectedAt: new Date().toISOString(),
      autoResolvable: false
    }

    conflict.autoResolvable = isAutoResolvable(conflict, sourceTrustScore)
    conflict.suggestedResolution = suggestResolution(
      conflict,
      0.5, // Default local trust score (can be parameterized later)
      sourceTrustScore
    )

    conflicts.push(conflict)
  }

  return conflicts
}

/**
 * Classifies the severity of a conflict based on the field and values
 *
 * @param field - The field name with conflicting values
 * @param localValue - The local value
 * @param remoteValue - The remote value
 * @returns Conflict severity level
 */
export function classifyConflictSeverity(
  field: string,
  localValue: unknown,
  remoteValue: unknown
): ConflictSeverity {
  // Critical fields always get high severity
  if (CRITICAL_FIELDS.has(field)) {
    return 'high'
  }

  // Important fields get medium severity
  if (IMPORTANT_FIELDS.has(field)) {
    return 'medium'
  }

  // Metadata fields get low severity
  if (METADATA_FIELDS.has(field)) {
    return 'low'
  }

  // For unknown fields, check if one value is null/undefined
  if (localValue === null || localValue === undefined ||
      remoteValue === null || remoteValue === undefined) {
    return 'low'
  }

  // Default to medium for unknown fields with actual values
  return 'medium'
}

/**
 * Determines if a conflict can be automatically resolved
 *
 * @param conflict - The detected conflict
 * @param sourceTrustScore - Trust score of the source instance (0-1)
 * @returns True if the conflict can be auto-resolved
 */
export function isAutoResolvable(
  conflict: DetectedConflict,
  sourceTrustScore: number
): boolean {
  // Low severity conflicts are always auto-resolvable
  if (conflict.severity === 'low') {
    return true
  }

  // Medium severity conflicts are auto-resolvable if trust score is high
  if (conflict.severity === 'medium') {
    return sourceTrustScore > 0.7
  }

  // High severity conflicts always need manual review
  if (conflict.severity === 'high') {
    return false
  }

  return false
}

/**
 * Suggests a resolution strategy for a detected conflict
 *
 * @param conflict - The detected conflict
 * @param localTrustScore - Trust score of the local instance (0-1)
 * @param remoteTrustScore - Trust score of the remote instance (0-1)
 * @returns Suggested resolution strategy
 */
export function suggestResolution(
  conflict: DetectedConflict,
  localTrustScore: number,
  remoteTrustScore: number
): 'keep_local' | 'keep_remote' | 'merge' | 'manual_review' {
  // High severity always needs manual review
  if (conflict.severity === 'high') {
    return 'manual_review'
  }

  // Calculate trust score difference (significant if > 0.2)
  const trustDifference = Math.abs(localTrustScore - remoteTrustScore)
  const significantDifference = trustDifference > 0.2

  // If one source has significantly higher trust, prefer it
  if (significantDifference) {
    return localTrustScore > remoteTrustScore ? 'keep_local' : 'keep_remote'
  }

  // For medium severity with similar trust scores, suggest manual review
  if (conflict.severity === 'medium') {
    return 'manual_review'
  }

  // For low severity with similar trust scores, attempt merge
  // Check if conflicting fields are compatible for merging
  const canMerge = conflict.conflictingFields.every(cf => {
    const localType = typeof cf.localValue
    const remoteType = typeof cf.remoteValue

    // Arrays and objects can be merged
    if (Array.isArray(cf.localValue) && Array.isArray(cf.remoteValue)) {
      return true
    }

    // Strings can be merged (concatenated)
    if (localType === 'string' && remoteType === 'string') {
      return true
    }

    // Numbers and booleans cannot be easily merged
    return false
  })

  return canMerge ? 'merge' : 'keep_remote'
}

/**
 * Detects if a resource has been deleted at the source
 *
 * @param localResourceId - ID of the local resource
 * @param remoteResources - Array of remote resources
 * @param sourceInstanceId - The federation instance ID
 * @returns Detected deletion conflict or null
 */
export function detectDeletion(
  localResourceId: string,
  remoteResources: Array<{ id: string }>,
  sourceInstanceId: string
): DetectedConflict | null {
  // Check if the local resource ID appears in the remote list
  const existsInRemote = remoteResources.some(
    resource => resource.id === localResourceId
  )

  // If not found, it may have been deleted
  if (!existsInRemote) {
    return {
      type: 'deleted',
      severity: 'medium',
      localResourceId,
      remoteResourceId: localResourceId,
      sourceInstanceId,
      conflictingFields: [],
      detectedAt: new Date().toISOString(),
      autoResolvable: false,
      suggestedResolution: 'manual_review'
    }
  }

  return null
}

/**
 * Deep equality check for values
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if values are equal
 */
function areValuesEqual(a: unknown, b: unknown): boolean {
  // Handle primitive types and null/undefined
  if (a === b) {
    return true
  }

  // Handle null/undefined mismatches
  if (a === null || b === null || a === undefined || b === undefined) {
    return false
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((val, index) => areValuesEqual(val, b[index]))
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)

    if (aKeys.length !== bKeys.length) {
      return false
    }

    return aKeys.every(key =>
      areValuesEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    )
  }

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // Different types or values
  return false
}
