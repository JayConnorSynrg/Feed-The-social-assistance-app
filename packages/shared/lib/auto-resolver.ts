/**
 * Auto-Resolution Rules for Federation Conflicts
 *
 * Implements automatic conflict resolution for low-severity conflicts
 * between local and remote federated resources.
 */

export type ResolutionStrategy =
  | 'keep_local'
  | 'keep_remote'
  | 'merge'
  | 'most_recent'
  | 'highest_trust'
  | 'manual_review';

export interface ConflictForResolution {
  type: 'duplicate' | 'divergent_data' | 'deleted' | 'schema_mismatch';
  severity: 'low' | 'medium' | 'high';
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localTrustScore: number;
  remoteTrustScore: number;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
}

export interface ResolutionResult {
  resolved: boolean;
  strategy: ResolutionStrategy;
  resolvedValue: unknown;
  reason: string;
  confidence: number; // 0-1
}

/**
 * Automatically resolve a conflict using predefined rules
 */
export function autoResolveConflict(conflict: ConflictForResolution): ResolutionResult {
  // Rule 1: High severity conflicts always require manual review
  if (conflict.severity === 'high') {
    return {
      resolved: false,
      strategy: 'manual_review',
      resolvedValue: null,
      reason: 'High severity conflict requires manual review',
      confidence: 0
    };
  }

  // Rule 2: Schema mismatches require manual review
  if (conflict.type === 'schema_mismatch') {
    return {
      resolved: false,
      strategy: 'manual_review',
      resolvedValue: null,
      reason: 'Schema mismatch requires manual intervention',
      confidence: 0
    };
  }

  // Rule 3: Handle deleted resources
  if (conflict.type === 'deleted') {
    return resolveDeletedResource(
      conflict.localValue !== null,
      conflict.remoteValue === null,
      conflict.remoteTrustScore
    );
  }

  // Get field-specific resolution strategy
  const fieldStrategy = getFieldResolutionRule(conflict.field);

  // Rule 4: Timestamp fields - always take most recent
  if (conflict.field.includes('_at') || conflict.field.includes('timestamp')) {
    const result = resolveByTimestamp(
      conflict.localValue,
      conflict.remoteValue,
      conflict.localUpdatedAt,
      conflict.remoteUpdatedAt
    );
    return {
      resolved: true,
      strategy: result.strategy,
      resolvedValue: result.value,
      reason: 'Timestamp field resolved to most recent value',
      confidence: 0.95
    };
  }

  // Rule 5: Enum fields (resource_type, status) - prefer canonical/valid value
  if (conflict.field === 'resource_type' || conflict.field === 'status') {
    // Prefer higher trust source for canonical fields
    const result = resolveByTrust(
      conflict.localValue,
      conflict.remoteValue,
      conflict.localTrustScore,
      conflict.remoteTrustScore
    );
    return {
      resolved: true,
      strategy: result.strategy,
      resolvedValue: result.value,
      reason: `Enum field resolved to higher trust source`,
      confidence: 0.85
    };
  }

  // Rule 6: Contact info (phone, email) - merge if different
  if (conflict.field === 'phone' || conflict.field === 'email') {
    const mergedValue = mergeContactInfo(conflict.localValue, conflict.remoteValue);
    return {
      resolved: true,
      strategy: 'merge',
      resolvedValue: mergedValue,
      reason: 'Contact information merged from both sources',
      confidence: 0.9
    };
  }

  // Rule 7: Apply field-specific strategy
  switch (fieldStrategy) {
    case 'manual_review':
      return {
        resolved: false,
        strategy: 'manual_review',
        resolvedValue: null,
        reason: `Field '${conflict.field}' requires manual review`,
        confidence: 0
      };

    case 'merge':
      const mergedValue = mergeContactInfo(conflict.localValue, conflict.remoteValue);
      return {
        resolved: true,
        strategy: 'merge',
        resolvedValue: mergedValue,
        reason: `Field '${conflict.field}' values merged`,
        confidence: 0.8
      };

    case 'highest_trust':
      const trustResult = resolveByTrust(
        conflict.localValue,
        conflict.remoteValue,
        conflict.localTrustScore,
        conflict.remoteTrustScore
      );

      // If trust scores are within 0.1, fall through to timestamp
      if (Math.abs(conflict.localTrustScore - conflict.remoteTrustScore) < 0.1) {
        const timeResult = resolveByTimestamp(
          conflict.localValue,
          conflict.remoteValue,
          conflict.localUpdatedAt,
          conflict.remoteUpdatedAt
        );
        return {
          resolved: timeResult.strategy !== 'manual_review',
          strategy: timeResult.strategy,
          resolvedValue: timeResult.value,
          reason: 'Trust scores similar, resolved by most recent timestamp',
          confidence: 0.75
        };
      }

      return {
        resolved: true,
        strategy: trustResult.strategy,
        resolvedValue: trustResult.value,
        reason: `Resolved to higher trust source (local: ${conflict.localTrustScore.toFixed(2)}, remote: ${conflict.remoteTrustScore.toFixed(2)})`,
        confidence: 0.85
      };

    case 'most_recent':
      const timeResult = resolveByTimestamp(
        conflict.localValue,
        conflict.remoteValue,
        conflict.localUpdatedAt,
        conflict.remoteUpdatedAt
      );
      return {
        resolved: timeResult.strategy !== 'manual_review',
        strategy: timeResult.strategy,
        resolvedValue: timeResult.value,
        reason: 'Resolved to most recent value',
        confidence: 0.9
      };

    default:
      // Default to trust-based resolution
      const defaultResult = resolveByTrust(
        conflict.localValue,
        conflict.remoteValue,
        conflict.localTrustScore,
        conflict.remoteTrustScore
      );
      return {
        resolved: true,
        strategy: defaultResult.strategy,
        resolvedValue: defaultResult.value,
        reason: 'Resolved using default trust-based strategy',
        confidence: 0.7
      };
  }
}

/**
 * Resolve conflict by trust score
 * Higher trust wins. If within 0.1, fall through to caller.
 */
export function resolveByTrust(
  localValue: unknown,
  remoteValue: unknown,
  localTrust: number,
  remoteTrust: number
): { value: unknown; strategy: ResolutionStrategy } {
  // Trust scores within 0.1 are considered equivalent
  if (Math.abs(localTrust - remoteTrust) < 0.1) {
    return { value: null, strategy: 'manual_review' };
  }

  if (localTrust > remoteTrust) {
    return { value: localValue, strategy: 'keep_local' };
  } else {
    return { value: remoteValue, strategy: 'keep_remote' };
  }
}

/**
 * Resolve conflict by timestamp
 * More recent wins. If no timestamps, return manual_review.
 */
export function resolveByTimestamp(
  localValue: unknown,
  remoteValue: unknown,
  localUpdatedAt?: string,
  remoteUpdatedAt?: string
): { value: unknown; strategy: ResolutionStrategy } {
  // If no timestamps available, cannot auto-resolve
  if (!localUpdatedAt || !remoteUpdatedAt) {
    return { value: null, strategy: 'manual_review' };
  }

  const localTime = new Date(localUpdatedAt).getTime();
  const remoteTime = new Date(remoteUpdatedAt).getTime();

  // Invalid timestamps
  if (isNaN(localTime) || isNaN(remoteTime)) {
    return { value: null, strategy: 'manual_review' };
  }

  if (localTime > remoteTime) {
    return { value: localValue, strategy: 'keep_local' };
  } else if (remoteTime > localTime) {
    return { value: remoteValue, strategy: 'keep_remote' };
  } else {
    // Exact same timestamp - keep local by default
    return { value: localValue, strategy: 'keep_local' };
  }
}

/**
 * Merge contact information
 * For phone/email: if both exist and different, return array of both
 * If one is null, return the other
 */
export function mergeContactInfo(local: unknown, remote: unknown): unknown {
  // Handle null/undefined cases
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;

  // If values are the same, return single value
  if (local === remote) return local;

  // Convert to strings for comparison
  const localStr = String(local).trim();
  const remoteStr = String(remote).trim();

  if (localStr === remoteStr) return localStr;

  // Both exist and are different - return array
  // Ensure unique values
  const values = [localStr, remoteStr].filter((v, i, arr) => arr.indexOf(v) === i);
  return values.length === 1 ? values[0] : values;
}

/**
 * Resolve deleted resource conflicts
 * If remote trust > 0.7 and remote deleted: mark local as removed
 * Otherwise: keep local, flag for review
 */
export function resolveDeletedResource(
  localExists: boolean,
  remoteDeleted: boolean,
  remoteTrustScore: number
): ResolutionResult {
  // Remote source deleted the resource
  if (remoteDeleted && remoteTrustScore > 0.7) {
    return {
      resolved: true,
      strategy: 'keep_remote',
      resolvedValue: null,
      reason: `Remote source (trust: ${remoteTrustScore.toFixed(2)}) indicates resource is deleted`,
      confidence: 0.85
    };
  }

  // Remote source has low trust or local doesn't exist
  if (remoteDeleted && localExists) {
    return {
      resolved: false,
      strategy: 'manual_review',
      resolvedValue: null,
      reason: 'Deletion conflict requires manual review - remote trust score too low',
      confidence: 0
    };
  }

  // Keep local by default
  return {
    resolved: true,
    strategy: 'keep_local',
    resolvedValue: localExists,
    reason: 'Keeping local resource state',
    confidence: 0.7
  };
}

/**
 * Get field-specific resolution strategy
 * Map field names to default resolution strategies
 */
export function getFieldResolutionRule(field: string): ResolutionStrategy {
  // High importance fields - require manual review
  if (field === 'name' || field === 'address' || field === 'location') {
    return 'manual_review';
  }

  // Contact fields - merge
  if (field === 'phone' || field === 'email' || field === 'contact_info') {
    return 'merge';
  }

  // Description and text fields - use highest trust
  if (field === 'description' || field === 'notes' || field === 'details') {
    return 'highest_trust';
  }

  // Time-sensitive fields - use most recent
  if (field === 'hours_of_operation' || field === 'schedule' || field === 'availability') {
    return 'most_recent';
  }

  // Metadata and flexible fields - merge
  if (field === 'metadata' || field === 'tags' || field === 'categories') {
    return 'merge';
  }

  // Location data - use highest trust
  if (field === 'coordinates' || field === 'latitude' || field === 'longitude' || field === 'geom') {
    return 'highest_trust';
  }

  // Default to highest trust for unknown fields
  return 'highest_trust';
}
