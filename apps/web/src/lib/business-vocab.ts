// apps/web/src/lib/business-vocab.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The controlled vocabularies for the P4a rich business profile: the category list, the boolean
// attribute badges, and the social platforms. Pure, dependency-free data — safe to import from
// server (public page) and client (form/card) code alike. These lists are intentionally tight; a
// new entry is a deliberate product decision, not a speculative slot.

/** Controlled category list for a mutual-aid business directory. Value = the stored string. */
export const BUSINESS_CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'housing', label: 'Housing' },
  { value: 'health', label: 'Health' },
  { value: 'legal', label: 'Legal' },
  { value: 'employment', label: 'Employment' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'education', label: 'Education' },
  { value: 'financial', label: 'Financial' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' },
] as const

/** A valid category value (the string stored in organizations.business_category). */
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]['value']

/** The bare set of valid category values, for fast membership checks. */
export const BUSINESS_CATEGORY_VALUES: readonly string[] = BUSINESS_CATEGORIES.map((c) => c.value)

/**
 * Boolean attribute badges stored in organizations.attributes (jsonb) as { key: true }. `key` is
 * the jsonb key; `label` is the human-facing badge text.
 */
export const BUSINESS_ATTRIBUTES = [
  { key: 'wheelchair_accessible', label: 'Wheelchair accessible' },
  { key: 'wifi', label: 'Free Wi-Fi' },
  { key: 'parking', label: 'Parking available' },
  { key: 'accepts_ebt', label: 'Accepts EBT' },
  { key: 'multilingual', label: 'Multilingual staff' },
  { key: 'woman_owned', label: 'Woman-owned' },
  { key: 'veteran_owned', label: 'Veteran-owned' },
  { key: 'lgbtq_friendly', label: 'LGBTQ+ friendly' },
  { key: 'black_owned', label: 'Black-owned' },
] as const

/** A valid attribute key (a jsonb key in organizations.attributes). */
export type BusinessAttributeKey = (typeof BUSINESS_ATTRIBUTES)[number]['key']

/** The bare set of valid attribute keys, for fast membership checks. */
export const BUSINESS_ATTRIBUTE_KEYS: readonly string[] = BUSINESS_ATTRIBUTES.map((a) => a.key)

/**
 * Social platforms stored in organizations.social_links (jsonb) as { key: absoluteUrl }. `key` is
 * the jsonb key; `label` is the human-facing name; `base` (when present) is the platform's profile
 * URL prefix, useful for the form to prefill/hint. The stored value is always a full normalized URL
 * (normalizeUrl runs at write), never a bare handle.
 */
export const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', base: 'https://facebook.com/' },
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/' },
  { key: 'x', label: 'X', base: 'https://x.com/' },
  { key: 'linkedin', label: 'LinkedIn', base: 'https://linkedin.com/' },
  { key: 'youtube', label: 'YouTube', base: 'https://youtube.com/' },
  { key: 'tiktok', label: 'TikTok', base: 'https://tiktok.com/@' },
] as const

/** A valid social platform key (a jsonb key in organizations.social_links). */
export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]['key']

/** The bare set of valid social platform keys, for fast membership checks. */
export const SOCIAL_PLATFORM_KEYS: readonly string[] = SOCIAL_PLATFORMS.map((p) => p.key)
