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
  fetchAdminBusinessList,
  fetchApprovedBusinessById,
  adminSetBusinessActive,
  adminUpdateBusiness,
  BUSINESS_NOT_SAVED_MESSAGE,
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

// ---- orchestration client (org insert + per-table child inserts) --------------------------------
// from('organizations') -> insert -> select -> single ; from('business_*') -> insert -> then.
// Records every table's inserted payload and lets a per-table child error be injected.
function makeOrchestrationClient(opts: {
  orgResult?: { data: { id: string } | null; error: { message: string } | null }
  childErrors?: Partial<Record<'business_photos' | 'business_hours' | 'business_services', string>>
}) {
  const inserts: Record<string, unknown> = {}
  const orgBuilder: Record<string, unknown> = {}
  Object.assign(orgBuilder, {
    insert(row: unknown) {
      inserts['organizations'] = row
      return orgBuilder
    },
    select() {
      return orgBuilder
    },
    single() {
      return Promise.resolve(opts.orgResult ?? { data: { id: 'org-new' }, error: null })
    },
  })
  function childBuilder(table: string) {
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      insert(rows: unknown) {
        inserts[table] = rows
        return b
      },
      then: (cb: (r: { data: unknown; error: { message: string } | null }) => unknown) => {
        const message = opts.childErrors?.[table as keyof typeof opts.childErrors]
        return Promise.resolve(cb({ data: null, error: message ? { message } : null }))
      },
    })
    return b
  }
  const client = {
    inserts,
    from(table: string) {
      return table === 'organizations' ? orgBuilder : childBuilder(table)
    },
  }
  return client as unknown as SupabaseClient<Database> & { inserts: typeof inserts }
}

// ---- logo-embed read client (counts from() calls; returns embedded business_photos) --------------
function makeLogoEmbedClient(rows: unknown[]) {
  const state = { fromCount: 0, selected: '', eqCalls: [] as Array<[string, unknown]> }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: (cols: string) => {
      state.selected = cols
      return builder
    },
    eq: (col: string, val: unknown) => {
      state.eqCalls.push([col, val])
      return builder
    },
    order: () => builder,
    then: (cb: (r: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(cb({ data: rows, error: null })),
  })
  const client = {
    state,
    from() {
      state.fromCount += 1
      return builder
    },
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

const input = { name: '  Corner Cafe  ', description: 'Coffee', city: 'Burlington' }

const richChildren = {
  photos: [
    { kind: 'logo' as const, url: 'https://x/l.png', storage_path: 'org/l.png', sort_order: 0, caption: null },
  ],
  hours: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
  services: [{ name: 'Haircut', description: null, sort_order: 0 }],
}

describe('submitBusiness orchestration — org insert then child writers (CINV4, three-valued)', () => {
  it('org-ok + children-ok: returns ok:true with no partial and stamps every child with the new org id', async () => {
    const client = makeOrchestrationClient({ orgResult: { data: { id: 'org-77' }, error: null } })
    const out = await submitBusiness(client, { ...input, ...richChildren }, 'user-1')
    expect(out).toEqual({ ok: true, id: 'org-77' })
    expect(client.inserts['business_photos']).toEqual([
      { org_id: 'org-77', kind: 'logo', url: 'https://x/l.png', storage_path: 'org/l.png', sort_order: 0, caption: null },
    ])
    expect(client.inserts['business_hours']).toEqual([
      { org_id: 'org-77', day_of_week: 1, open_time: '09:00', close_time: '17:00' },
    ])
    expect(client.inserts['business_services']).toEqual([
      { org_id: 'org-77', name: 'Haircut', description: null, sort_order: 0 },
    ])
    // Exactly one business.submit event, and it is .complete (never an error) even with children.
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.submit.complete' })
  })

  it('org-ok + one-child-fail: returns ok:true WITH partial (never full success, never ok:false), other children still persist', async () => {
    const client = makeOrchestrationClient({
      orgResult: { data: { id: 'org-77' }, error: null },
      childErrors: { business_hours: 'rls denied' },
    })
    const out = await submitBusiness(client, { ...input, ...richChildren }, 'user-1')
    expect(out.ok).toBe(true)
    if (!out.ok) throw new Error('unreachable')
    expect(out.id).toBe('org-77')
    expect(typeof out.partial).toBe('string')
    expect(out.partial).toMatch(/hours/)
    // The non-failing children were still written.
    expect(client.inserts['business_photos']).toBeDefined()
    expect(client.inserts['business_services']).toBeDefined()
    // A child failure does NOT flip the single submit event to error — the submission itself succeeded.
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.submit.complete' })
  })

  it('org insert REJECTS (raw network/promise rejection, not a returned {error}): returns ok:false, NEVER throws, and emits exactly one .error', async () => {
    // A client whose org single() REJECTS — the rare edge the truthful-contract must also cover.
    const rejectingClient = {
      from() {
        const b: Record<string, unknown> = {}
        Object.assign(b, {
          insert: () => b,
          select: () => b,
          single: () => Promise.reject(new Error('network down')),
        })
        return b
      },
    } as unknown as SupabaseClient<Database>
    // Must NOT throw — the non-throwing SubmitOutcome contract holds for a raw rejection too.
    const out = await submitBusiness(rejectingClient, { ...input, ...richChildren }, 'user-1')
    expect(out).toEqual({ ok: false, error: 'network down' })
    // withMetric still observed the throw: exactly one business.submit.error, no double-emit.
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.submit.error' })
  })

  it('org-fail: returns ok:false and NEVER attempts any child insert', async () => {
    const client = makeOrchestrationClient({
      orgResult: { data: null, error: { message: 'permission denied' } },
    })
    const out = await submitBusiness(client, { ...input, ...richChildren }, 'user-1')
    expect(out).toEqual({ ok: false, error: 'permission denied' })
    expect(client.inserts['business_photos']).toBeUndefined()
    expect(client.inserts['business_hours']).toBeUndefined()
    expect(client.inserts['business_services']).toBeUndefined()
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.submit.error' })
  })
})

describe('fetchApprovedBusinesses — logo embed (no N+1)', () => {
  it('issues ONE query embedding business_photos filtered to the logo kind, and flattens logo_url', async () => {
    const client = makeLogoEmbedClient([
      { id: 'a', name: 'A', business_photos: [{ url: 'https://x/logo-a.png' }] },
      { id: 'b', name: 'B', business_photos: [] },
    ])
    const rows = await fetchApprovedBusinesses(client)
    // ONE from() for the whole list — never a per-row logo fetch.
    expect(client.state.fromCount).toBe(1)
    expect(client.state.selected).toContain('business_photos(url)')
    expect(client.state.eqCalls).toContainEqual(['business_photos.kind', 'logo'])
    // logo_url flattened; the embedded array is not leaked to the card shape.
    expect(rows[0]).toMatchObject({ id: 'a', logo_url: 'https://x/logo-a.png' })
    expect(rows[0]).not.toHaveProperty('business_photos')
    // Logo-less business falls back to null (card renders an initial/placeholder).
    expect(rows[1]).toMatchObject({ id: 'b', logo_url: null })
    expect(sinks).toHaveLength(1)
    expect(sinks[0].attrs).toEqual({ result_count: 2 })
  })

  it('INV-2: filters EXACTLY org_type=business AND status=approved (excludes non-business + unapproved)', async () => {
    // The approved-list reader the Businesses tab reuses. Removing the org_type filter would let a
    // NON-business org leak into the Businesses tab; removing the status filter would list pending/
    // rejected business rows in the "approved" section. Either deletion turns these assertions RED —
    // this is INV-2's forward guard (every row shown is an approved business) at the query boundary.
    const client = makeLogoEmbedClient([{ id: 'a', name: 'A', business_photos: [] }])
    await fetchApprovedBusinesses(client)
    expect(client.state.eqCalls).toContainEqual(['org_type', 'business'])
    expect(client.state.eqCalls).toContainEqual(['status', 'approved'])
    // Never widens to a non-business type.
    expect(client.state.eqCalls.map(([, v]) => v)).not.toContain('pantry')
  })
})

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

// ---- update-recording client (update -> eq -> select -> then) for the admin direct-UPDATE writers ---
// The default result is the one changed row a permitted UPDATE ... RETURNING id gives back.
function makeUpdateClient(result: { data: unknown; error: { message: string } | null } = {
  data: [{ id: 'org-77' }],
  error: null,
}) {
  const state = {
    table: '',
    patch: null as Record<string, unknown> | null,
    eqCol: '',
    eqVal: undefined as unknown,
    selected: null as string | null,
  }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    update(patch: Record<string, unknown>) {
      state.patch = patch
      return builder
    },
    eq(col: string, val: unknown) {
      state.eqCol = col
      state.eqVal = val
      return builder
    },
    select(cols: string) {
      state.selected = cols
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

describe('adminSetBusinessActive — Deactivate↔Reactivate toggle, orgs_admin_update (INV-3)', () => {
  it('active=false UPDATEs is_active=false keyed by id; label carries the direction, one .complete', async () => {
    const client = makeUpdateClient()
    await adminSetBusinessActive(client, 'org-77', false)
    expect(client.state.table).toBe('organizations')
    // Deactivate direction: the write is EXACTLY is_active=false — the property that removes the
    // business from every public surface. Flipping the payload bool fails this (mutation-proof direction).
    expect(client.state.patch).toEqual({ is_active: false })
    expect(client.state.eqCol).toBe('id')
    expect(client.state.eqVal).toBe('org-77')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.admin.set_active.complete' })
    // Closed-vocab, PII-free: exactly one boolean `active` label, never the target id.
    expect(sinks[0].attrs).toEqual({ active: false })
    expect(typeof sinks[0].attrs.active).toBe('boolean')
  })

  it('active=true UPDATEs is_active=true keyed by id (the Reactivate direction), one .complete', async () => {
    const client = makeUpdateClient()
    await adminSetBusinessActive(client, 'org-77', true)
    // Reactivate direction: restores the business to the public surfaces. The payload bool follows the
    // argument — if adminSetBusinessActive hard-coded false, this assertion turns RED.
    expect(client.state.patch).toEqual({ is_active: true })
    expect(client.state.eqCol).toBe('id')
    expect(client.state.eqVal).toBe('org-77')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.admin.set_active.complete' })
    expect(sinks[0].attrs).toEqual({ active: true })
  })

  it('throws BusinessWriteError and emits EXACTLY ONE .error on a Supabase failure', async () => {
    const client = makeUpdateClient({ data: null, error: { message: 'rls denied' } })
    await expect(adminSetBusinessActive(client, 'org-77', false)).rejects.toThrow('rls denied')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.admin.set_active.error' })
  })

  it('returns the changed row (select id) and FAILS LOUDLY when RLS filtered the UPDATE to 0 rows', async () => {
    // orgs_admin_update is platform-admin only: for anyone else the UPDATE matches 0 rows with NO
    // error. Success must be proven by the returned row, or a non-PA toggle "succeeds" while nothing changed.
    const ok = makeUpdateClient()
    await adminSetBusinessActive(ok, 'org-77', false)
    expect(ok.state.selected).toBe('id')
    sinks.length = 0
    for (const data of [[], null]) {
      const client = makeUpdateClient({ data, error: null })
      await expect(adminSetBusinessActive(client, 'org-77', false)).rejects.toThrow(BUSINESS_NOT_SAVED_MESSAGE)
    }
    expect(sinks.map((s) => s.event)).toEqual(['business.admin.set_active.error', 'business.admin.set_active.error'])
  })
})

describe('fetchAdminBusinessList — admin reader PROJECTS is_active (INV-2 + toggle state)', () => {
  it('selects is_active, filters org_type=business AND status=approved, returns is_active per row', async () => {
    const client = makeLogoEmbedClient([
      { id: 'a', name: 'A', is_active: true, business_photos: [{ url: 'https://x/a.png' }] },
      { id: 'b', name: 'B', is_active: false, business_photos: [] },
    ])
    const rows = await fetchAdminBusinessList(client)
    // The projection MUST include is_active — without it the tab cannot show live/retired state or
    // drive the toggle. Dropping is_active from the select turns this RED.
    expect(client.state.selected).toContain('is_active')
    // INV-2 for the actual tab source: exactly approved business rows (no non-business, no unapproved).
    expect(client.state.eqCalls).toContainEqual(['org_type', 'business'])
    expect(client.state.eqCalls).toContainEqual(['status', 'approved'])
    // is_active flows through to the row shape (active AND inactive rows both surface to the admin),
    // and logo_url is flattened like the public reader.
    expect(rows[0]).toMatchObject({ id: 'a', is_active: true, logo_url: 'https://x/a.png' })
    expect(rows[1]).toMatchObject({ id: 'b', is_active: false, logo_url: null })
    expect(rows[1]).not.toHaveProperty('business_photos')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.admin.list.fetch.complete' })
    expect(sinks[0].attrs).toEqual({ result_count: 2 })
  })

  it('EXACTLY ONE .error and throws on a Supabase error', async () => {
    const client = makeReadClient({ data: null, error: { message: 'boom' } })
    await expect(fetchAdminBusinessList(client)).rejects.toThrow('boom')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.admin.list.fetch.error' })
  })
})

describe('adminUpdateBusiness — descriptive/contact edit, normalized website (INV-3)', () => {
  it('UPDATEs the editable fields keyed by id: trims name, normalizes website, nulls blanks', async () => {
    const client = makeUpdateClient()
    await adminUpdateBusiness(client, 'org-77', {
      name: '  Corner Cafe  ',
      description: '   ',
      phone: ' 802-555-0100 ',
      email: '   ',
      website: 'corner.example.com',
    })
    expect(client.state.table).toBe('organizations')
    expect(client.state.patch).toEqual({
      name: 'Corner Cafe',
      description: null, // blank -> null
      phone: '802-555-0100',
      email: null, // blank -> null
      website: 'https://corner.example.com', // scheme-less -> https-prefixed (INV2 one source of truth)
    })
    expect(client.state.eqCol).toBe('id')
    expect(client.state.eqVal).toBe('org-77')
    // Bounded, PII-free SHAPE labels only (booleans) — never the name/email/url value itself.
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'info', event: 'business.admin.update.complete' })
    expect(sinks[0].attrs).toEqual({
      has_description: false,
      has_phone: true,
      has_email: false,
      has_website: true,
    })
    for (const [, value] of Object.entries(sinks[0].attrs)) {
      expect(typeof value).toBe('boolean')
    }
  })

  it('throws BusinessWriteError and emits EXACTLY ONE .error on a Supabase failure', async () => {
    const client = makeUpdateClient({ data: null, error: { message: 'permission denied' } })
    await expect(
      adminUpdateBusiness(client, 'org-77', {
        name: 'X',
        description: null,
        phone: null,
        email: null,
        website: null,
      })
    ).rejects.toThrow('permission denied')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.admin.update.error' })
  })

  it('FAILS LOUDLY when the UPDATE changed 0 rows (a non-platform admin, or a missing id)', async () => {
    const client = makeUpdateClient({ data: [], error: null })
    await expect(
      adminUpdateBusiness(client, 'org-77', { name: 'X', description: null, phone: null, email: null, website: null })
    ).rejects.toThrow(BUSINESS_NOT_SAVED_MESSAGE)
    expect(client.state.selected).toBe('id')
    expect(sinks).toHaveLength(1)
    expect(sinks[0]).toMatchObject({ level: 'error', event: 'business.admin.update.error' })
  })
})

// ---- I4 parity: the public business readers show an admin exactly what members see ------------------
// orgs_select_active admits a business to members only when is_active AND status='approved'; an admin's
// read also passes orgs_admin_select (any is_active). So each PUBLIC reader must filter is_active=true
// itself, or an admin would see an inactive business on /s/business/<id>, its OG image and the showcase
// while members get a 404 / omission. The admin management reader must NOT filter it.
function makeSingleClient(row: unknown) {
  const state = { eqCalls: [] as Array<[string, unknown]> }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      state.eqCalls.push([col, val])
      return builder
    },
    single: async () => ({ data: row, error: row ? null : { message: 'not found' } }),
  })
  const client = { state, from: () => builder }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

describe('I4 — public business readers filter is_active=true; the admin reader does not', () => {
  it('fetchApprovedBusinesses (showcase) filters is_active=true', async () => {
    const client = makeLogoEmbedClient([])
    await fetchApprovedBusinesses(client)
    expect(client.state.eqCalls).toContainEqual(['is_active', true])
  })

  it('fetchApprovedBusinessById (public page + OG) filters is_active=true, approved business only', async () => {
    const client = makeSingleClient({ id: 'b1', name: 'B' })
    expect(await fetchApprovedBusinessById(client, 'b1')).toMatchObject({ id: 'b1' })
    expect(client.state.eqCalls).toContainEqual(['is_active', true])
    expect(client.state.eqCalls).toContainEqual(['status', 'approved'])
    expect(client.state.eqCalls).toContainEqual(['org_type', 'business'])
  })

  it('a row the filters exclude resolves to null (the page 404s for admins too)', async () => {
    expect(await fetchApprovedBusinessById(makeSingleClient(null), 'b1')).toBeNull()
  })

  it('fetchAdminBusinessList (admin management) never filters is_active — inactive rows stay listed', async () => {
    const client = makeLogoEmbedClient([])
    await fetchAdminBusinessList(client)
    expect(client.state.eqCalls.map(([c]) => c)).not.toContain('is_active')
    expect(client.state.eqCalls).toContainEqual(['status', 'approved'])
  })
})
