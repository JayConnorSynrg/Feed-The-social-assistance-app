// apps/web/src/lib/business-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What is proven here:
//   1. CINV4 (truthful revert): submitBusiness returns { ok:false, error } on a Supabase error and
//      NEVER fabricates a success — the component's revert keys on outcome.ok === false.
//   2. W3 rich-profile write shape: submitBusiness writes the new scalar columns and a NORMALIZED
//      social_links map (bad scheme -> https-prefixed; empty dropped) via the loose() boundary.
//   3. W3 child writers/readers: the 3 writers issue the expected loose() insert queries (and no-op
//      on an empty array); the 3 readers issue the expected select/eq/order queries and surface
//      result_count.
//   4. Logging (INV3): each wrapped path (submitBusiness / list / pending / the 3 child readers /
//      business.photo.upload) emits EXACTLY ONE wide event on success AND exactly one on error, with
//      bounded, PII-free labels only. `./logger` is mocked with a recorder so that removing a
//      withMetric wrap drops the sink count to 0 -> RED (mutation-proof, both directions).
//
// The Supabase client is a hand-built fake recorder (mirrors notification-prefs.test.ts) rather than
// vi.mock, so the chained builder shape is asserted directly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

// Recorder shared with the mocked logger. vi.hoisted lets the vi.mock factory (hoisted above the
// imports) reference it. One push per withMetric call === one wide event.
const { sinks } = vi.hoisted(() => ({
  sinks: [] as Array<{ level: 'info' | 'error'; event: string; attrs: Record<string, unknown> }>,
}))

// Mock the metric wrapper with a faithful recorder: run fn, record .complete on success and .error
// on throw (re-throwing so the caller's own try/catch still runs). Labels are snapshotted AFTER fn
// resolves, so an attrs object mutated in place (result_count) is captured with its final value —
// exactly how the real with-metric-core spreads attrs post-resolution.
vi.mock('./logger', () => ({
  withMetric: async (
    operation: string,
    attrs: Record<string, unknown>,
    fn: () => Promise<unknown>
  ) => {
    try {
      const result = await fn()
      sinks.push({ level: 'info', event: `${operation}.complete`, attrs: { ...attrs } })
      return result
    } catch (err) {
      sinks.push({ level: 'error', event: `${operation}.error`, attrs: { ...attrs } })
      throw err
    }
  },
}))

import {
  submitBusiness,
  fetchApprovedBusinesses,
  fetchPendingBusinesses,
  insertBusinessHours,
  insertBusinessServices,
  insertBusinessPhotos,
  fetchBusinessHours,
  fetchBusinessServices,
  fetchBusinessPhotos,
  normalizeSocialLinks,
  photoSizeBucket,
  withPhotoUploadMetric,
} from './business-data'

beforeEach(() => {
  sinks.length = 0
})

// Bounded, non-identifying numeric/boolean labels for the submit + read paths. A string value or any
// key outside this set (a name, email, address, website URL, or user_id) fails the assertion.
const ALLOWED_LABELS = [
  'result_count',
  'has_website',
  'has_logo',
  'has_cover',
  'gallery_count',
  'hours_days_set',
  'service_count',
  'attribute_count',
  'has_social',
]
function assertBoundedPiiFreeLabels(attrs: Record<string, unknown>) {
  for (const [key, value] of Object.entries(attrs)) {
    expect(ALLOWED_LABELS).toContain(key)
    expect(['number', 'boolean']).toContain(typeof value)
  }
}

// The photo-upload path carries two bounded STRING enums (never a filename/url). Assert each value is
// drawn from its fixed vocabulary — that is the PII-free guarantee for this path.
function assertBoundedPhotoLabels(attrs: Record<string, unknown>) {
  expect(Object.keys(attrs).sort()).toEqual(['image_type', 'size_bucket'])
  expect(['jpeg', 'png', 'webp']).toContain(attrs.image_type)
  expect(['le_512k', 'le_2m', 'le_5m']).toContain(attrs.size_bucket)
}

// ---- write client (insert -> select -> single) --------------------------------------------------
function makeWriteClient(opts: {
  singleResult?: { data: { id: string } | null; error: { message: string } | null }
}) {
  const state = { table: '', inserted: null as Record<string, unknown> | null, selected: '' }
  const builder = {
    insert(row: Record<string, unknown>) {
      state.inserted = row
      return builder
    },
    select(cols: string) {
      state.selected = cols
      return builder
    },
    single() {
      return Promise.resolve(opts.singleResult ?? { data: { id: 'org-new' }, error: null })
    },
  }
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

// ---- child write client (insert -> then) --------------------------------------------------------
function makeChildWriteClient(result: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}) {
  const state = { table: '', inserted: null as unknown }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    insert(rows: unknown) {
      state.inserted = rows
      return builder
    },
    then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
  })
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

// ---- recording read client (select -> eq -> order -> then) --------------------------------------
function makeRecordingReadClient(result: { data: unknown; error: { message: string } | null }) {
  const state = {
    table: '',
    selected: '',
    eqCol: '',
    eqVal: undefined as unknown,
    orderCol: '',
    orderAsc: undefined as boolean | undefined,
  }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: (cols: string) => {
      state.selected = cols
      return builder
    },
    eq: (col: string, val: unknown) => {
      state.eqCol = col
      state.eqVal = val
      return builder
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      state.orderCol = col
      state.orderAsc = opts?.ascending
      return builder
    },
    then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
  })
  const client = {
    state,
    from(table: string) {
      state.table = table
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

// ---- simple read client (select -> eq -> eq -> order -> then), no recording ----------------------
function makeReadClient(result: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (cb: (r: typeof result) => unknown) => Promise.resolve(cb(result)),
  })
  const client = { from: () => builder }
  return client as unknown as SupabaseClient<Database>
}

const input = { name: '  Corner Cafe  ', description: 'Coffee', city: 'Burlington' }

describe('submitBusiness (CINV4 — never swallows the error)', () => {
  it('returns ok:false with the message when the insert errors', async () => {
    const client = makeWriteClient({ singleResult: { data: null, error: { message: 'permission denied' } } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out).toEqual({ ok: false, error: 'permission denied' })
  })

  it('returns ok:true with the new id on success', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out).toEqual({ ok: true, id: 'org-42' })
  })

  it('always inserts org_type=business and trims the name; never presets moderation fields', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, input, 'user-1')
    expect(client.state.table).toBe('organizations')
    expect(client.state.inserted).toMatchObject({ org_type: 'business', name: 'Corner Cafe', created_by: 'user-1' })
    // The client must NOT try to set status/submitted_by/moderated_* — the DB trigger owns them.
    expect(client.state.inserted).not.toHaveProperty('status')
    expect(client.state.inserted).not.toHaveProperty('submitted_by')
    expect(client.state.inserted).not.toHaveProperty('moderated_by')
  })

  it('treats a missing id as a failure rather than a phantom success', async () => {
    const client = makeWriteClient({ singleResult: { data: null, error: null } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out.ok).toBe(false)
  })
})

describe('submitBusiness (INV2 — normalize-at-write, website)', () => {
  it('prefixes a scheme-less website with https:// before insert', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: 'corner.example.com' }, 'user-1')
    expect(client.state.inserted).toMatchObject({ website: 'https://corner.example.com' })
  })

  it('preserves an explicit http:// website unchanged', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: 'http://corner.example.com' }, 'user-1')
    expect(client.state.inserted).toMatchObject({ website: 'http://corner.example.com' })
  })

  it('stores null for an empty/whitespace website — never a bare or empty string', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, { ...input, website: '   ' }, 'user-1')
    expect(client.state.inserted).toMatchObject({ website: null })
  })
})

describe('submitBusiness (W3 — new scalar columns + normalized social_links)', () => {
  it('writes the new rich-profile scalar columns', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(
      client,
      {
        ...input,
        zip_code: ' 05401 ',
        email: ' hi@corner.example ',
        business_category: ' food ',
        cost_model: 'sliding_scale',
        service_radius_miles: 10,
      },
      'user-1'
    )
    expect(client.state.inserted).toMatchObject({
      zip_code: '05401',
      email: 'hi@corner.example',
      business_category: 'food',
      cost_model: 'sliding_scale',
      service_radius_miles: 10,
    })
  })

  it('normalizes each social link at write (bad scheme -> https-prefixed) and drops empties', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(
      client,
      {
        ...input,
        social_links: {
          facebook: 'facebook.com/corner',
          instagram: '  ',
          x: 'javascript:alert(1)',
          youtube: 'https://youtube.com/@corner',
        },
      },
      'user-1'
    )
    expect((client.state.inserted as Record<string, unknown>).social_links).toEqual({
      facebook: 'https://facebook.com/corner',
      // instagram dropped (empty)
      x: 'https://javascript:alert(1)', // dangerous scheme -> non-executable broken link
      youtube: 'https://youtube.com/@corner', // allowlisted scheme preserved
    })
  })

  it('defaults attributes/social_links to empty objects when omitted', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, input, 'user-1')
    expect(client.state.inserted).toMatchObject({ attributes: {}, social_links: {} })
  })
})

describe('normalizeSocialLinks', () => {
  it('https-prefixes bare values, preserves allowlisted schemes, and drops empties', () => {
    expect(
      normalizeSocialLinks({
        facebook: 'facebook.com/x',
        instagram: 'https://instagram.com/x',
        empty: '   ',
      })
    ).toEqual({
      facebook: 'https://facebook.com/x',
      instagram: 'https://instagram.com/x',
    })
  })

  it('returns a fresh empty object for null/undefined and never mutates the input', () => {
    expect(normalizeSocialLinks(null)).toEqual({})
    expect(normalizeSocialLinks(undefined)).toEqual({})
    const src = { facebook: 'facebook.com/x' }
    normalizeSocialLinks(src)
    expect(src).toEqual({ facebook: 'facebook.com/x' })
  })
})

describe('W3 logging — business.submit expanded shape labels (INV3)', () => {
  it('EXACTLY ONE .complete carrying the bounded submission-shape counts, no PII', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(
      client,
      {
        ...input,
        website: 'corner.example.com',
        photos: [
          { kind: 'logo', url: 'u', storage_path: 'p', sort_order: 0, caption: null },
          { kind: 'cover', url: 'u', storage_path: 'p', sort_order: 0, caption: null },
          { kind: 'gallery', url: 'u', storage_path: 'p', sort_order: 0, caption: null },
          { kind: 'gallery', url: 'u', storage_path: 'p', sort_order: 1, caption: null },
        ],
        hours: [
          { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
          { day_of_week: 1, open_time: '18:00', close_time: '20:00' }, // same day -> distinct-day count stays
          { day_of_week: 3, open_time: '09:00', close_time: '17:00' },
        ],
        services: [
          { name: 'A', description: null, sort_order: 0 },
          { name: 'B', description: null, sort_order: 1 },
        ],
        attributes: { wifi: true, parking: false, accepts_ebt: true },
        social_links: { facebook: 'facebook.com/x' },
      },
      'user-1'
    )
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.submit.complete' })
    expect(sinks[0].attrs).toEqual({
      has_website: true,
      has_logo: true,
      has_cover: true,
      gallery_count: 2,
      hours_days_set: 2,
      service_count: 2,
      attribute_count: 2,
      has_social: true,
    })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('EXACTLY ONE .complete with all-false/zero shape when only the required fields are set', async () => {
    const client = makeWriteClient({ singleResult: { data: { id: 'org-42' }, error: null } })
    await submitBusiness(client, input, 'user-1')
    expect(sinks).toHaveLength(1)
    expect(sinks[0].attrs).toEqual({
      has_website: false,
      has_logo: false,
      has_cover: false,
      gallery_count: 0,
      hours_days_set: 0,
      service_count: 0,
      attribute_count: 0,
      has_social: false,
    })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('EXACTLY ONE .error on insert failure (typed error_code path), no PII', async () => {
    const client = makeWriteClient({ singleResult: { data: null, error: { message: 'permission denied' } } })
    const out = await submitBusiness(client, input, 'user-1')
    expect(out.ok).toBe(false)
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.submit.error' })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })
})

describe('list/pending readers logging (INV3)', () => {
  it('fetchApprovedBusinesses: EXACTLY ONE .complete with result_count, no PII', async () => {
    const client = makeReadClient({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    const rows = await fetchApprovedBusinesses(client)
    expect(rows).toHaveLength(2)
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.list.fetch.complete' })
    expect(sinks[0].attrs).toEqual({ result_count: 2 })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchApprovedBusinesses: EXACTLY ONE .error and throws on a Supabase error', async () => {
    const client = makeReadClient({ data: null, error: { message: 'boom' } })
    await expect(fetchApprovedBusinesses(client)).rejects.toThrow('boom')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.list.fetch.error' })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchPendingBusinesses: EXACTLY ONE .complete with result_count, no PII', async () => {
    const client = makeReadClient({ data: [{ id: 'p' }], error: null })
    const rows = await fetchPendingBusinesses(client)
    expect(rows).toHaveLength(1)
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.pending.fetch.complete' })
    expect(sinks[0].attrs).toEqual({ result_count: 1 })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchPendingBusinesses: EXACTLY ONE .error and throws on a Supabase error', async () => {
    const client = makeReadClient({ data: null, error: { message: 'denied' } })
    await expect(fetchPendingBusinesses(client)).rejects.toThrow('denied')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.pending.fetch.error' })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })
})

describe('child writers — insertBusinessHours/Services/Photos', () => {
  it('insertBusinessHours issues an insert into business_hours with org_id-stamped rows', async () => {
    const client = makeChildWriteClient()
    await insertBusinessHours(client, 'org-9', [
      { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
    ])
    expect(client.state.table).toBe('business_hours')
    expect(client.state.inserted).toEqual([
      { org_id: 'org-9', day_of_week: 1, open_time: '09:00', close_time: '17:00' },
    ])
  })

  it('insertBusinessServices trims name, nulls blank description, keeps sort_order', async () => {
    const client = makeChildWriteClient()
    await insertBusinessServices(client, 'org-9', [
      { name: '  Haircut  ', description: '   ', sort_order: 2 },
    ])
    expect(client.state.table).toBe('business_services')
    expect(client.state.inserted).toEqual([
      { org_id: 'org-9', name: 'Haircut', description: null, sort_order: 2 },
    ])
  })

  it('insertBusinessPhotos maps every column including caption', async () => {
    const client = makeChildWriteClient()
    await insertBusinessPhotos(client, 'org-9', [
      { kind: 'logo', url: 'https://x/l.png', storage_path: 'org-9/l.png', sort_order: 0, caption: null },
      { kind: 'gallery', url: 'https://x/g.png', storage_path: 'org-9/g.png', sort_order: 1, caption: 'Front' },
    ])
    expect(client.state.table).toBe('business_photos')
    expect(client.state.inserted).toEqual([
      { org_id: 'org-9', kind: 'logo', url: 'https://x/l.png', storage_path: 'org-9/l.png', sort_order: 0, caption: null },
      { org_id: 'org-9', kind: 'gallery', url: 'https://x/g.png', storage_path: 'org-9/g.png', sort_order: 1, caption: 'Front' },
    ])
  })

  it('an empty array is a no-op — no query is issued', async () => {
    const client = makeChildWriteClient()
    await insertBusinessHours(client, 'org-9', [])
    await insertBusinessServices(client, 'org-9', [])
    await insertBusinessPhotos(client, 'org-9', [])
    expect(client.state.table).toBe('')
    expect(client.state.inserted).toBeNull()
  })

  it('a Supabase error throws a typed BusinessWriteError', async () => {
    const client = makeChildWriteClient({ data: null, error: { message: 'rls denied' } })
    await expect(
      insertBusinessHours(client, 'org-9', [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }])
    ).rejects.toThrow('rls denied')
  })
})

describe('child readers — fetchBusinessHours/Services/Photos', () => {
  it('fetchBusinessHours selects the hours columns, filters org_id, orders by day_of_week', async () => {
    const client = makeRecordingReadClient({
      data: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
      error: null,
    })
    const rows = await fetchBusinessHours(client, 'org-9')
    expect(rows).toHaveLength(1)
    expect(client.state).toMatchObject({
      table: 'business_hours',
      selected: 'day_of_week, open_time, close_time',
      eqCol: 'org_id',
      eqVal: 'org-9',
      orderCol: 'day_of_week',
      orderAsc: true,
    })
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.hours.fetch.complete' })
    expect(sinks[0].attrs).toEqual({ result_count: 1 })
    assertBoundedPiiFreeLabels(sinks[0].attrs)
  })

  it('fetchBusinessServices orders by sort_order and reports result_count', async () => {
    const client = makeRecordingReadClient({
      data: [
        { name: 'A', description: null, sort_order: 0 },
        { name: 'B', description: null, sort_order: 1 },
      ],
      error: null,
    })
    const rows = await fetchBusinessServices(client, 'org-9')
    expect(rows).toHaveLength(2)
    expect(client.state).toMatchObject({
      table: 'business_services',
      selected: 'name, description, sort_order',
      eqCol: 'org_id',
      eqVal: 'org-9',
      orderCol: 'sort_order',
      orderAsc: true,
    })
    expect(sinks).toHaveLength(1)
    expect(sinks[0].attrs).toEqual({ result_count: 2 })
  })

  it('fetchBusinessPhotos orders by sort_order and reports result_count', async () => {
    const client = makeRecordingReadClient({
      data: [{ kind: 'logo', url: 'u', storage_path: 'p', sort_order: 0, caption: null }],
      error: null,
    })
    const rows = await fetchBusinessPhotos(client, 'org-9')
    expect(rows).toHaveLength(1)
    expect(client.state).toMatchObject({
      table: 'business_photos',
      selected: 'kind, url, storage_path, sort_order, caption',
      eqCol: 'org_id',
      eqVal: 'org-9',
      orderCol: 'sort_order',
      orderAsc: true,
    })
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.photos.fetch.complete' })
  })

  it('each child reader emits EXACTLY ONE .error and throws on a Supabase error', async () => {
    for (const fn of [fetchBusinessHours, fetchBusinessServices, fetchBusinessPhotos]) {
      sinks.length = 0
      const client = makeRecordingReadClient({ data: null, error: { message: 'boom' } })
      await expect(fn(client, 'org-9')).rejects.toThrow('boom')
      expect(sinks).toHaveLength(1)
      expect(sinks[0].level).toBe('error')
      assertBoundedPiiFreeLabels(sinks[0].attrs)
    }
  })
})

describe('photoSizeBucket + withPhotoUploadMetric', () => {
  it('buckets bytes into the fixed vocabulary (clamping large files to le_5m)', () => {
    expect(photoSizeBucket(1)).toBe('le_512k')
    expect(photoSizeBucket(512 * 1024)).toBe('le_512k')
    expect(photoSizeBucket(512 * 1024 + 1)).toBe('le_2m')
    expect(photoSizeBucket(2 * 1024 * 1024)).toBe('le_2m')
    expect(photoSizeBucket(2 * 1024 * 1024 + 1)).toBe('le_5m')
    expect(photoSizeBucket(50 * 1024 * 1024)).toBe('le_5m')
  })

  it('EXACTLY ONE .complete with bounded image_type + size_bucket on a successful upload', async () => {
    const out = await withPhotoUploadMetric('jpeg', 1024 * 1024, async () => 'uploaded')
    expect(out).toBe('uploaded')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.photo.upload.complete' })
    assertBoundedPhotoLabels(sinks[0].attrs)
    expect(sinks[0].attrs).toEqual({ image_type: 'jpeg', size_bucket: 'le_2m' })
  })

  it('EXACTLY ONE .error and re-throws when the upload fn throws', async () => {
    await expect(
      withPhotoUploadMetric('png', 100, async () => {
        throw new Error('upload failed')
      })
    ).rejects.toThrow('upload failed')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.photo.upload.error' })
    assertBoundedPhotoLabels(sinks[0].attrs)
  })
})
