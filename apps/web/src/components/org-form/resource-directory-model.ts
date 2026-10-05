// apps/web/src/components/org-form/resource-directory-model.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure state transitions behind <ResourceDirectory>: the ordered selection (add/remove/reorder),
// page merging for "Load more", the zero-result clear actions, and the category chips. Kept free of
// React so resource-directory-model.test.ts exercises the exact logic the component runs.

import type { DirectoryResource, ResourceCategory } from '@/lib/resource-directory'
import { ALL_CATEGORIES } from './org-labels'

/** A resource linked to the organization. Array order is the curator-set display order. */
export interface SelectedResource {
  id: string
  name: string
  category: ResourceCategory
  city: string | null
  state: string | null
}

export function toSelected(row: DirectoryResource): SelectedResource {
  return { id: row.id, name: row.name, category: row.category, city: row.city, state: row.state }
}

/** Adds the row at the end when absent; removes it when present. */
export function toggleSelected(value: SelectedResource[], row: DirectoryResource): SelectedResource[] {
  return value.some((s) => s.id === row.id)
    ? value.filter((s) => s.id !== row.id)
    : [...value, toSelected(row)]
}

export function removeSelected(value: SelectedResource[], id: string): SelectedResource[] {
  return value.filter((s) => s.id !== id)
}

/** Swaps the item with its neighbor; a move past either end returns the same array. */
export function moveSelected(value: SelectedResource[], id: string, delta: -1 | 1): SelectedResource[] {
  const from = value.findIndex((s) => s.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= value.length) return value
  const next = [...value]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** Appends a "Load more" page, skipping ids already shown. */
export function mergePage(rows: DirectoryResource[], page: DirectoryResource[]): DirectoryResource[] {
  const seen = new Set(rows.map((r) => r.id))
  return [...rows, ...page.filter((r) => !seen.has(r.id))]
}

export interface DirectoryUiFilters {
  q: string
  state: string
  city: string
  category: ResourceCategory | null
}

export type ClearAction = 'search' | 'category' | 'location'

/** The clear buttons a zero-result view offers — one per active filter group. */
export function zeroResultActions(filters: DirectoryUiFilters): ClearAction[] {
  const actions: ClearAction[] = []
  if (filters.q.trim()) actions.push('search')
  if (filters.category) actions.push('category')
  if (filters.state || filters.city.trim()) actions.push('location')
  return actions
}

export function applyClear(filters: DirectoryUiFilters, action: ClearAction): DirectoryUiFilters {
  switch (action) {
    case 'search':
      return { ...filters, q: '' }
    case 'category':
      return { ...filters, category: null }
    case 'location':
      return { ...filters, state: '', city: '' }
  }
}

/**
 * Category chips: EVERY resource category, sorted by its (translated) label. A category with no
 * matching resources still shows; choosing it simply lands on the zero-result state.
 */
export function chipCategories(labelOf: (c: ResourceCategory) => string, locale?: string): ResourceCategory[] {
  return [...ALL_CATEGORIES].sort((a, b) => labelOf(a).localeCompare(labelOf(b), locale))
}

/** "Rutland, VT" / "VT" / onlineLabel for an online resource with no city / "" when unknown. */
export function locationText(
  row: Pick<DirectoryResource, 'city' | 'state'> & { service_mode?: DirectoryResource['service_mode'] },
  onlineLabel: string
): string {
  const parts = [row.city, row.state].filter((p): p is string => Boolean(p && p.trim()))
  if (parts.length) return parts.join(', ')
  return row.service_mode === 'online' ? onlineLabel : ''
}
