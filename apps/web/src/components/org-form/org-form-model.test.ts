// apps/web/src/components/org-form/org-form-model.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The admin_save_organization payload the panel sends: location keep/clear/set (a pin reaches the
// payload only once a person confirms it), website normalization, de-duplication, the photo cleanup
// set, edit-mode prefill, and the duplicate-name match.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))

import type { AdminOrgDetail } from '@/lib/org-data'
import {
  buildSavePayload,
  emptyFormValues,
  findSimilarOrgs,
  formValuesFromDetail,
  isValidWebsite,
  locationPayload,
  newPhotoItems,
  normalizeWebsite,
  orgFormSchema,
  photoCleanupPaths,
  type OrgFormValues,
  type PhotoItem,
} from './org-form-model'

const ORG = '11111111-2222-4333-8444-555555555555'
const base = (over: Partial<OrgFormValues> = {}): OrgFormValues => ({ ...emptyFormValues(), name: ' Rutland Food Shelf ', ...over })
const file = new File(['x'], 'a.png', { type: 'image/png' })
const newItem = (key: string): PhotoItem => ({ key, source: 'new', file, previewUrl: `blob:${key}` })
const existing = (path: string): PhotoItem => ({
  key: `existing:${path}`,
  source: 'existing',
  url: `https://x.supabase.co/storage/v1/object/public/org-photos/${path}`,
  storage_path: path,
  caption: null,
})

describe('location: keep / clear / set', () => {
  it('a confirmed pin sets {lng,lat}', () => {
    const p = buildSavePayload(base({ pin: { status: 'confirmed', lng: -72.97, lat: 43.61 } }), new Map(), false)
    expect(p.location).toEqual({ lng: -72.97, lat: 43.61 })
  })
  it('an untouched saved pin omits the key (keep)', () => {
    const p = buildSavePayload(base({ pin: { status: 'saved', lng: 1, lat: 2 } }), new Map(), true)
    expect('location' in p).toBe(false)
  })
  it('Remove pin clears an existing location (null) and is a no-op when there was none', () => {
    expect(buildSavePayload(base({ pin: { status: 'removed' } }), new Map(), true).location).toBeNull()
    expect('location' in buildSavePayload(base({ pin: { status: 'removed' } }), new Map(), false)).toBe(false)
  })
  it('an unconfirmed draft never reaches the payload and blocks the save', () => {
    const draft = { status: 'draft', lng: 1, lat: 2, source: 'exact' } as const
    expect(locationPayload(draft, true)).toBeUndefined()
    const parsed = orgFormSchema.safeParse(base({ pin: draft }))
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((i) => i.message)).toContain('locConfirmBeforeSave')
  })
})

describe('website normalization', () => {
  it('adds https:// to a bare domain, keeps an explicit scheme, empties to null', () => {
    expect(normalizeWebsite('rutlandfood.org')).toBe('https://rutlandfood.org')
    expect(normalizeWebsite('http://x.org')).toBe('http://x.org')
    expect(normalizeWebsite('  ')).toBeNull()
    expect(buildSavePayload(base({ website: 'example.org/help' }), new Map(), false).website).toBe('https://example.org/help')
  })
  it('rejects values that are not a web address', () => {
    expect(isValidWebsite('javascript:alert(1)')).toBe(false)
    expect(isValidWebsite('not a site')).toBe(false)
    expect(isValidWebsite('')).toBe(true)
    expect(isValidWebsite('food.org')).toBe(true)
  })
})

describe('payload shape', () => {
  it('trims text, nulls empties, dedupes hours / resource ids / photo paths', () => {
    const values = base({
      description: '  ',
      hours: [
        { day_of_week: 2, open_time: '09:00', close_time: '17:00' },
        { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
        { day_of_week: 2, open_time: '09:00', close_time: '17:00' },
      ],
      resources: [
        { id: 'r1', name: 'A', category: 'food', city: null, state: null },
        { id: 'r2', name: 'B', category: 'food', city: null, state: null },
        { id: 'r1', name: 'A', category: 'food', city: null, state: null },
      ],
      logo: existing(`${ORG}/a.webp`),
      gallery: [existing(`${ORG}/a.webp`), existing(`${ORG}/b.webp`)],
    })
    const p = buildSavePayload(values, new Map(), false)
    expect(p.name).toBe('Rutland Food Shelf')
    expect(p.description).toBeNull()
    expect(p.hours.map((h) => h.day_of_week)).toEqual([1, 2])
    expect(p.resource_ids).toEqual(['r1', 'r2'])
    expect(p.photos.map((ph) => [ph.kind, ph.storage_path])).toEqual([
      ['logo', `${ORG}/a.webp`],
      ['gallery', `${ORG}/b.webp`],
    ])
  })
  it('new photos use the uploaded url + path verbatim, in logo / cover / gallery order', () => {
    const values = base({ logo: newItem('L'), cover: null, gallery: [newItem('G1'), existing(`${ORG}/old.webp`)] })
    expect(newPhotoItems(values).map((i) => i.key)).toEqual(['L', 'G1'])
    const up = new Map([
      ['L', { url: 'https://h/storage/v1/object/public/org-photos/u/l.webp', path: `${ORG}/l.webp` }],
      ['G1', { url: 'https://h/storage/v1/object/public/org-photos/u/g.webp', path: `${ORG}/g.webp` }],
    ])
    const p = buildSavePayload(values, up, false)
    expect(p.photos).toEqual([
      { kind: 'logo', sort_order: 0, url: up.get('L')!.url, storage_path: `${ORG}/l.webp`, caption: null },
      { kind: 'gallery', sort_order: 0, url: up.get('G1')!.url, storage_path: `${ORG}/g.webp`, caption: null },
      { kind: 'gallery', sort_order: 1, url: `https://x.supabase.co/storage/v1/object/public/org-photos/${ORG}/old.webp`, storage_path: `${ORG}/old.webp`, caption: null },
    ])
  })
})

describe('photo cleanup set', () => {
  it('after success deletes exactly the removed paths inside the org folder', () => {
    expect(
      photoCleanupPaths(ORG, { ok: true, removed: [`${ORG}/old.webp`, `other-org/x.webp`, `${ORG}/../y.webp`, `${ORG}/old.webp`] })
    ).toEqual([`${ORG}/old.webp`])
  })
  it('after failure deletes this attempt’s uploads (and never another folder)', () => {
    expect(photoCleanupPaths(ORG, { ok: false, uploaded: [`${ORG}/n1.webp`, `${ORG}/n2.webp`, 'x/n3.webp'] })).toEqual([
      `${ORG}/n1.webp`,
      `${ORG}/n2.webp`,
    ])
  })
})

describe('edit-mode prefill', () => {
  const detail: AdminOrgDetail = {
    id: ORG,
    name: 'FEED',
    org_type: 'community',
    description: null,
    address: '1 Main St',
    city: 'Rutland',
    state: 'VT',
    zip_code: null,
    phone: null,
    email: null,
    website: null,
    is_active: false,
    location: { lng: -72.97, lat: 43.61 },
    hours: [
      { day_of_week: 1, open_time: '00:00:00', close_time: '00:00:00' },
      { day_of_week: 2, open_time: '00:01:00', close_time: '00:00:00' },
    ],
    photos: [
      { kind: 'logo', url: 'u1', storage_path: `${ORG}/l.webp`, sort_order: 0, caption: null },
      { kind: 'gallery', url: 'u2', storage_path: `${ORG}/g.webp`, sort_order: 0, caption: 'c' },
    ],
    resources: [{ id: 'r1', name: 'Pantry', category: 'food', city: 'Rutland', state: 'VT' }],
  }
  it('prefills every section and reports the dropped zero-length hours', () => {
    const { values, droppedZeroLength } = formValuesFromDetail(detail)
    expect(droppedZeroLength).toBe(1)
    expect(values.hours).toEqual([{ day_of_week: 2, open_time: '00:01', close_time: '00:00' }])
    expect(values.pin).toEqual({ status: 'saved', lng: -72.97, lat: 43.61 })
    expect(values.logo?.source).toBe('existing')
    expect(values.gallery).toHaveLength(1)
    expect(values.resources.map((r) => r.id)).toEqual(['r1'])
    // Re-saving an untouched edit keeps the location and passes validation.
    expect(orgFormSchema.safeParse(values).success).toBe(true)
    expect('location' in buildSavePayload(values, new Map(), true)).toBe(false)
  })
})

describe('create defaults', () => {
  it('start Mon–Fri 9–5 with no pin', () => {
    const v = emptyFormValues()
    expect(v.hours).toHaveLength(5)
    expect(v.pin).toEqual({ status: 'none' })
  })
})

describe('duplicate-name match', () => {
  const index = [
    { id: 'a', name: 'The Rutland Food Shelf, Inc.', org_type: 'food_bank', status: null },
    { id: 'b', name: 'Barre Mutual Aid', org_type: 'mutual_aid', status: null },
  ]
  it('matches normalized equal and near-equal names, not unrelated ones', () => {
    expect(findSimilarOrgs('rutland food shelf', index).map((r) => r.id)).toEqual(['a'])
    expect(findSimilarOrgs('Rutland Fod Shelf', index).map((r) => r.id)).toEqual(['a'])
    expect(findSimilarOrgs('Burlington Food Shelf', index)).toEqual([])
  })
  it('never matches the org being edited', () => {
    expect(findSimilarOrgs('Barre Mutual Aid', index, 'b')).toEqual([])
  })
})
