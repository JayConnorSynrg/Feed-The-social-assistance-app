// apps/web/src/components/org-form/resource-directory-model.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Behavior of the directory picker's state transitions (the component runs exactly these functions):
// ordered selection add/remove/reorder, "Load more" page merging, the zero-result clear buttons, and
// the category chips. The repo's vitest runs in a node environment with no DOM test setup, so the
// component's logic is proven here at its pure boundary.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
import type { DirectoryResource } from '@/lib/resource-directory'
import {
  applyClear,
  chipCategories,
  locationText,
  mergePage,
  moveSelected,
  removeSelected,
  toggleSelected,
  zeroResultActions,
  type DirectoryUiFilters,
} from './resource-directory-model'
import { ALL_CATEGORIES, CATEGORY_KEYS } from './org-labels'
import { orgFormMessages } from '@/lib/i18n-org-forms'

const row = (id: string, over: Partial<DirectoryResource> = {}): DirectoryResource => ({
  id,
  name: `Resource ${id}`,
  category: 'other',
  city: 'Rutland',
  state: 'VT',
  address_line1: null,
  service_mode: 'physical',
  ...over,
})

const NO_FILTERS: DirectoryUiFilters = { q: '', state: '', city: '', category: null }

describe('selection', () => {
  it('toggle adds to the end in click order, then removes', () => {
    let v = toggleSelected([], row('a'))
    v = toggleSelected(v, row('b'))
    v = toggleSelected(v, row('c'))
    expect(v.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(v[0]).toEqual({ id: 'a', name: 'Resource a', category: 'other', city: 'Rutland', state: 'VT' })
    v = toggleSelected(v, row('b'))
    expect(v.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('never selects the same resource twice', () => {
    const v = toggleSelected(toggleSelected([], row('a')), row('b'))
    expect(toggleSelected(v, row('a')).map((s) => s.id)).toEqual(['b'])
  })

  it('remove drops only that id', () => {
    const v = [row('a'), row('b'), row('c')].reduce((acc, r) => toggleSelected(acc, r), [] as ReturnType<typeof toggleSelected>)
    expect(removeSelected(v, 'b').map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('move up/down swaps neighbors and is a no-op past either end', () => {
    const v = [row('a'), row('b'), row('c')].reduce((acc, r) => toggleSelected(acc, r), [] as ReturnType<typeof toggleSelected>)
    expect(moveSelected(v, 'c', -1).map((s) => s.id)).toEqual(['a', 'c', 'b'])
    expect(moveSelected(v, 'a', 1).map((s) => s.id)).toEqual(['b', 'a', 'c'])
    expect(moveSelected(v, 'a', -1)).toBe(v)
    expect(moveSelected(v, 'c', 1)).toBe(v)
    expect(moveSelected(v, 'missing', 1)).toBe(v)
  })
})

describe('load more', () => {
  it('appends the next page in order and skips ids already shown', () => {
    const merged = mergePage([row('a'), row('b')], [row('b'), row('c'), row('d')])
    expect(merged.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('zero-result clear buttons', () => {
  it('offers one clear button per active filter group', () => {
    expect(zeroResultActions(NO_FILTERS)).toEqual([])
    expect(zeroResultActions({ q: 'food', state: 'VT', city: '', category: 'housing' })).toEqual([
      'search',
      'category',
      'location',
    ])
    expect(zeroResultActions({ ...NO_FILTERS, city: 'Rut' })).toEqual(['location'])
    expect(zeroResultActions({ ...NO_FILTERS, q: '   ' })).toEqual([])
  })

  it('each clear resets exactly its group', () => {
    const f: DirectoryUiFilters = { q: 'food', state: 'VT', city: 'Rut', category: 'housing' }
    expect(applyClear(f, 'search')).toEqual({ ...f, q: '' })
    expect(applyClear(f, 'category')).toEqual({ ...f, category: null })
    expect(applyClear(f, 'location')).toEqual({ ...f, state: '', city: '' })
  })
})

describe('category chips', () => {
  it('always lists EVERY category (not only those in loaded rows), sorted by label', () => {
    const label = (c: string) => orgFormMessages.en[CATEGORY_KEYS[c as keyof typeof CATEGORY_KEYS]]
    const chips = chipCategories(label, 'en')
    expect(new Set(chips)).toEqual(new Set(ALL_CATEGORIES))
    expect(chips).toHaveLength(25)
    const labels = chips.map(label)
    expect(labels).toEqual([...labels].sort((x, y) => x.localeCompare(y, 'en')))
  })

  it('sorts by the translated label of the viewer locale', () => {
    const es = chipCategories((c) => orgFormMessages.es[CATEGORY_KEYS[c]], 'es')
    expect(es.map((c) => orgFormMessages.es[CATEGORY_KEYS[c]])).toEqual(
      es.map((c) => orgFormMessages.es[CATEGORY_KEYS[c]]).sort((x, y) => x.localeCompare(y, 'es'))
    )
  })
})

describe('location text', () => {
  it('city + state, state only, online, unknown', () => {
    expect(locationText(row('a'), 'Online')).toBe('Rutland, VT')
    expect(locationText(row('a', { city: null }), 'Online')).toBe('VT')
    expect(locationText(row('a', { city: null, state: '', service_mode: 'online' }), 'Online')).toBe('Online')
    expect(locationText(row('a', { city: null, state: null }), 'Online')).toBe('')
  })
})
