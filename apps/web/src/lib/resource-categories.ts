// apps/web/src/lib/resource-categories.ts
// Single source of truth for resource category metadata used across the app.
// Import from here rather than defining inline in map-panel, resource-marker,
// volunteer-resource-detail, and volunteer-resource-fab.

export interface CategoryMeta {
  /** Human-readable label shown in UI. */
  label: string
  /** Hex color for map markers (resource-marker.tsx). */
  hex: string
  /** Tailwind bg+text class pair for badges/chips (map-panel, volunteer-resource-detail). */
  tailwind: string
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  food: {
    label: 'Food',
    hex: '#22c55e',
    tailwind: 'bg-orange-100 text-orange-700',
  },
  housing: {
    label: 'Housing',
    hex: '#3b82f6',
    tailwind: 'bg-blue-100 text-blue-700',
  },
  healthcare: {
    label: 'Healthcare',
    hex: '#ef4444',
    tailwind: 'bg-red-100 text-red-700',
  },
  employment: {
    label: 'Jobs',
    hex: '#8b5cf6',
    tailwind: 'bg-green-100 text-green-700',
  },
  education: {
    label: 'Education',
    hex: '#f59e0b',
    tailwind: 'bg-purple-100 text-purple-700',
  },
  legal: {
    label: 'Legal',
    hex: '#6366f1',
    tailwind: 'bg-yellow-100 text-yellow-700',
  },
  transportation: {
    label: 'Transportation',
    hex: '#14b8a6',
    tailwind: 'bg-teal-100 text-teal-700',
  },
  utilities: {
    label: 'Utilities',
    hex: '#ec4899',
    tailwind: 'bg-pink-100 text-pink-700',
  },
  clothing: {
    label: 'Clothing',
    hex: '#f97316',
    tailwind: 'bg-orange-100 text-orange-800',
  },
  financial: {
    label: 'Financial',
    hex: '#10b981',
    tailwind: 'bg-emerald-100 text-emerald-700',
  },
  mental_health: {
    label: 'Mental Health',
    hex: '#06b6d4',
    tailwind: 'bg-cyan-100 text-cyan-700',
  },
  substance_abuse: {
    label: 'Substance Abuse',
    hex: '#84cc16',
    tailwind: 'bg-lime-100 text-lime-700',
  },
  domestic_violence: {
    label: 'Domestic Violence',
    hex: '#dc2626',
    tailwind: 'bg-red-100 text-red-800',
  },
  childcare: {
    label: 'Childcare',
    hex: '#a855f7',
    tailwind: 'bg-purple-100 text-purple-800',
  },
  senior_services: {
    label: 'Senior Services',
    hex: '#0ea5e9',
    tailwind: 'bg-sky-100 text-sky-700',
  },
  disability_services: {
    label: 'Disability Services',
    hex: '#7c3aed',
    tailwind: 'bg-violet-100 text-violet-700',
  },
  veteran_services: {
    label: 'Veteran Services',
    hex: '#059669',
    tailwind: 'bg-emerald-100 text-emerald-800',
  },
  immigration: {
    label: 'Immigration',
    hex: '#d946ef',
    tailwind: 'bg-fuchsia-100 text-fuchsia-700',
  },
  eitc_tax_filing: {
    label: 'Tax Filing & EITC',
    hex: '#0ea5e9',
    tailwind: 'bg-sky-100 text-sky-700',
  },
  free_legal: {
    label: 'Free Legal Help',
    hex: '#6366f1',
    tailwind: 'bg-indigo-100 text-indigo-700',
  },
  prenatal_natal_care: {
    label: 'Prenatal & Newborn Care',
    hex: '#ec4899',
    tailwind: 'bg-pink-100 text-pink-700',
  },
  waste_disposal: {
    label: 'Waste & Disposal',
    hex: '#84cc16',
    tailwind: 'bg-lime-100 text-lime-700',
  },
  free_camping: {
    label: 'Free Camping',
    hex: '#16a34a',
    tailwind: 'bg-green-100 text-green-800',
  },
  free_goods_donation: {
    label: 'Free Goods & Donations',
    hex: '#f43f5e',
    tailwind: 'bg-rose-100 text-rose-700',
  },
  other: {
    label: 'General',
    hex: '#6b7280',
    tailwind: 'bg-stone-100 text-stone-700',
  },
}

/** Hex color for a map marker. Falls back to gray for unknown categories. */
export function getCategoryHex(category: string): string {
  return CATEGORY_META[category]?.hex ?? CATEGORY_META.other.hex
}

/** Tailwind badge classes for a category chip. */
export function getCategoryTailwind(category: string): string {
  return CATEGORY_META[category]?.tailwind ?? CATEGORY_META.other.tailwind
}

/** Human-readable label for a category. */
export function getCategoryLabel(category: string): string {
  return CATEGORY_META[category]?.label ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Categories a volunteer provider can self-report — the full 12 categories
 * that include the 6 new ones added in Phase 8.
 */
export const VOLUNTEER_CATEGORIES = [
  'food',
  'housing',
  'employment',
  'transportation',
  'legal',
  'eitc_tax_filing',
  'free_legal',
  'prenatal_natal_care',
  'waste_disposal',
  'free_camping',
  'free_goods_donation',
  'other',
] as const

export type VolunteerCategory = (typeof VOLUNTEER_CATEGORIES)[number]
