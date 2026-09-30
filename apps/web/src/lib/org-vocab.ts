// apps/web/src/lib/org-vocab.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The single source of truth for the NON-business organization vocabulary. An "organization" is a
// row in the same `organizations` table as a business, but with a non-'business' org_type. The live
// prod CHECK admits ten org_type values; exactly one ('business') is the member-submitted path, and
// the other nine are the platform-admin org-directory types enumerated here.
//
// Pure, dependency-free data — safe to import from server (public page / map) and client (admin
// intake form) alike. Both the admin intake Select and the org data-layer readers import this list
// so the set of admissible types is defined in exactly one place (no drift between the form's options
// and the readers' filter). 'business' is deliberately ABSENT: the admin org-create path can never
// offer or emit it (INV-B), because it is not a member of this vocabulary.

/**
 * The nine non-business org_type values, in the order the admin Select renders them. This is the
 * source of truth: the union type, the label map, the options list, and the membership set all
 * derive from it. Mirrors the live prod org_type CHECK minus 'business'.
 */
export const NON_BUSINESS_ORG_TYPES = [
  'food_bank',
  'pantry',
  'shelter',
  'clinic',
  'mutual_aid',
  'other',
  'community',
  'nonprofit',
  'government',
] as const

/** A valid non-business org_type (the string stored in organizations.org_type). */
export type NonBusinessOrgType = (typeof NON_BUSINESS_ORG_TYPES)[number]

/** O(1) membership set over the nine values. 'business' is not a member — that is INV-B's floor. */
export const NON_BUSINESS_ORG_TYPE_SET: ReadonlySet<string> = new Set(NON_BUSINESS_ORG_TYPES)

/** Type-guard: true only for one of the nine non-business org types (never 'business'/unknown). */
export function isNonBusinessOrgType(value: string): value is NonBusinessOrgType {
  return NON_BUSINESS_ORG_TYPE_SET.has(value)
}

/** Human-facing labels, keyed by org_type. Every non-business type has exactly one label. */
export const ORG_TYPE_LABELS: Record<NonBusinessOrgType, string> = {
  food_bank: 'Food Bank',
  pantry: 'Pantry',
  shelter: 'Shelter',
  clinic: 'Clinic',
  mutual_aid: 'Mutual Aid',
  other: 'Other',
  community: 'Community',
  nonprofit: 'Nonprofit',
  government: 'Government',
}

/** {value,label} options for the admin intake Select — exactly the nine non-business types. */
export const ORG_TYPE_OPTIONS: { value: NonBusinessOrgType; label: string }[] =
  NON_BUSINESS_ORG_TYPES.map((value) => ({ value, label: ORG_TYPE_LABELS[value] }))
