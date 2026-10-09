// post-edit-model.test.ts — what the create forms and the edit dialog let a member do, per post type,
// against the server contract (specs/post-editing-contract.md "Per-type fields").
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  EDITABLE_FIELDS,
  EMPTY_DRAFT,
  capacityFloor,
  changedFields,
  createFields,
  diffDraft,
  draftFromSource,
  fieldLocks,
  inputToInstant,
  instantToInput,
  isEditableType,
  mergeDrafts,
  validateDraft,
  type EditFacts,
  type PostDraft,
} from './post-edit-model'
import { POST_TYPE_VALUES } from './post-model'

const NY = 'America/New_York'
const NO_FACTS: EditFacts = { pollVotes: 0, committedOptIns: 0, pollEndsAt: null }
const d = (o: Partial<PostDraft>): PostDraft => ({ ...EMPTY_DRAFT, ...o })

describe('EDITABLE_FIELDS mirrors the contract table exactly', () => {
  it('covers every post type', () => {
    expect(Object.keys(EDITABLE_FIELDS).sort()).toEqual([...POST_TYPE_VALUES].sort())
  })
  it.each([
    ['feed', ['content', 'image_url', 'image_alt', 'max_seekers']],
    ['seeker_request', ['content', 'categories', 'max_seekers']],
    ['source_offer', ['content', 'categories', 'max_seekers']],
    ['event_post', ['content', 'starts_at', 'ends_at', 'time_zone', 'is_online', 'location']],
    ['poll', ['content', 'options', 'ends_at']],
    ['resource_post', ['content']],
    ['petition', []],
  ] as const)('%s', (type, fields) => {
    expect([...EDITABLE_FIELDS[type]].sort()).toEqual([...fields].sort())
  })
  it('a petition is not edited from the feed (its text is what people signed)', () => {
    expect(isEditableType('petition')).toBe(false)
    expect(isEditableType('poll')).toBe(true)
  })
})

describe('edit sends only what changed (edit_post p_changes)', () => {
  it('no change -> nothing to send (Save stays disabled)', () => {
    const original = d({ content: 'Free bread at 5' })
    expect(diffDraft('feed', original, { ...original }, NY)).toEqual({})
  })
  it('a text edit sends only content, trimmed, raw (no HTML escaping)', () => {
    const original = d({ content: 'Free bread', maxSeekers: '4' })
    expect(diffDraft('feed', original, { ...original, content: '  Tom & Jerry <3 bread ' }, NY)).toEqual({ content: 'Tom & Jerry <3 bread' })
  })
  it('a field the type does not take is never sent (categories on a plain post)', () => {
    const original = d({ content: 'x' })
    expect(diffDraft('feed', original, { ...original, categories: ['Food'] }, NY)).toEqual({})
    expect(diffDraft('seeker_request', original, { ...original, categories: ['Food'] }, NY)).toEqual({ categories: ['Food'] })
  })
  it('removing the photo sends image_url null; capacity back to unlimited sends max_seekers null', () => {
    const original = d({ content: 'x', imageUrl: 'https://p/u/a.webp', imageAlt: 'apples', maxSeekers: '5' })
    expect(diffDraft('feed', original, { ...original, imageUrl: null, maxSeekers: '' }, NY)).toEqual({
      image_url: null,
      image_alt: null,
      max_seekers: null,
    })
  })
  it('a member event keeps its wall-clock times verbatim (never shifted through Date)', () => {
    const original = d({ content: 'Potluck', startsAt: '2026-10-10T18:00', timeZone: NY })
    expect(diffDraft('event_post', original, { ...original, startsAt: '2026-10-10T19:30' }, NY)).toEqual({ starts_at: '2026-10-10T19:30' })
  })
  it('going online clears the location', () => {
    const original = d({ content: 'Talk', startsAt: '2026-10-10T18:00', timeZone: NY, location: 'Library' })
    expect(diffDraft('event_post', original, { ...original, isOnline: true }, NY)).toEqual({ is_online: true, location: null })
  })
  it('closing a poll now sends ends_at "now"', () => {
    const original = d({ content: 'Which day?', options: ['Sat', 'Sun'] })
    expect(diffDraft('poll', original, { ...original, pollCloseNow: true }, NY)).toEqual({ ends_at: 'now' })
  })
})

describe('create sends every field the type takes (create_post p_fields)', () => {
  it('a member event carries its venue time zone', () => {
    expect(createFields('event_post', d({ content: 'Potluck', startsAt: '2026-10-10T18:00', endsAt: '2026-10-10T20:00', timeZone: NY, location: 'Hall' }), NY)).toEqual({
      content: 'Potluck',
      starts_at: '2026-10-10T18:00',
      ends_at: '2026-10-10T20:00',
      time_zone: NY,
      is_online: false,
      location: 'Hall',
    })
  })
  it('a poll carries its question, options and a deadline instant with an offset', () => {
    expect(createFields('poll', d({ content: 'Which day?', options: [' Sat', 'Sun '], pollEndsAt: '2026-10-10T18:00' }), NY)).toEqual({
      content: 'Which day?',
      options: ['Sat', 'Sun'],
      ends_at: '2026-10-10T22:00:00.000Z',
    })
  })
  it('a request carries its categories', () => {
    expect(createFields('seeker_request', d({ content: 'Need a ride', categories: ['Transit'] }), NY)).toEqual({ content: 'Need a ride', categories: ['Transit'] })
  })
})

describe('locks: key fields lock once people act', () => {
  it('a poll with no votes is fully editable', () => {
    expect(fieldLocks('poll', NO_FACTS)).toEqual({})
  })
  it('after the first vote the question and options lock; the deadline can only be extended or closed', () => {
    expect(fieldLocks('poll', { ...NO_FACTS, pollVotes: 1, pollEndsAt: '2099-01-01T00:00:00Z' })).toEqual({
      content: 'poll_voted',
      options: 'poll_voted',
      ends_at: 'poll_extend_only',
    })
  })
  it('a voted poll that already closed cannot reopen', () => {
    expect(fieldLocks('poll', { ...NO_FACTS, pollVotes: 3, pollEndsAt: '2020-01-01T00:00:00Z' }).ends_at).toBe('poll_closed')
  })
  it('capacity never goes below the opt-ins already holding a slot', () => {
    expect(capacityFloor({ ...NO_FACTS, committedOptIns: 3 })).toBe(3)
    const opts = { original: d({ maxSeekers: '5' }), facts: { ...NO_FACTS, committedOptIns: 3 }, viewerTz: NY }
    expect(validateDraft('feed', d({ content: 'x', maxSeekers: '2' }), opts).max_seekers).toEqual({ code: 'capacity_range', min: 3, max: 1000 })
    expect(validateDraft('feed', d({ content: 'x', maxSeekers: '3' }), opts).max_seekers).toBeUndefined()
  })
})

describe('validateDraft — the server limits, explained before saving', () => {
  const opts = { original: null, facts: NO_FACTS, viewerTz: NY, now: Date.parse('2026-10-09T12:00:00Z') }
  it('empty text and too-long text', () => {
    expect(validateDraft('feed', d({ content: '   ' }), opts).content).toEqual({ code: 'required' })
    expect(validateDraft('feed', d({ content: 'x'.repeat(5001) }), opts).content).toEqual({ code: 'too_long', max: 5000 })
    expect(validateDraft('poll', d({ content: 'Hi', options: ['a', 'b'] }), opts).content).toEqual({ code: 'too_short', min: 3 })
  })
  it('a member event needs a start, a venue zone, and an end after the start', () => {
    const e = validateDraft('event_post', d({ content: 'Potluck', startsAt: '2026-10-10T18:00', endsAt: '2026-10-10T09:00', timeZone: '' }), opts)
    expect(e.time_zone).toEqual({ code: 'zone_required' })
    expect(e.ends_at).toEqual({ code: 'end_before_start' })
    expect(validateDraft('event_post', d({ content: 'P', startsAt: '', timeZone: NY }), opts).starts_at).toEqual({ code: 'required' })
  })
  it('a zone the server refuses is caught (America/Asuncion)', () => {
    expect(validateDraft('event_post', d({ content: 'P', startsAt: '2026-10-10T18:00', timeZone: 'America/Asuncion' }), opts).time_zone).toEqual({ code: 'zone_unsupported' })
  })
  it('poll options: 2-10, none empty, unique ignoring case', () => {
    expect(validateDraft('poll', d({ content: 'Which?', options: ['a'] }), opts).options).toEqual({ code: 'options_count', min: 2, max: 10 })
    expect(validateDraft('poll', d({ content: 'Which?', options: ['a', ' '] }), opts).options).toEqual({ code: 'option_empty' })
    expect(validateDraft('poll', d({ content: 'Which?', options: ['Sat', 'sat'] }), opts).options).toEqual({ code: 'options_duplicate' })
  })
  it('a voted poll deadline can be extended but not shortened; a new deadline must be in the future', () => {
    const facts = { pollVotes: 2, committedOptIns: 0, pollEndsAt: '2026-10-20T12:00:00Z' }
    const original = d({ content: 'Which?', options: ['a', 'b'], pollEndsAt: instantToInput('2026-10-20T12:00:00Z', NY) })
    const base = { original, facts, viewerTz: NY, now: opts.now }
    expect(validateDraft('poll', { ...original, pollEndsAt: '2026-10-25T08:00' }, base).ends_at).toBeUndefined()
    expect(validateDraft('poll', { ...original, pollEndsAt: '2026-10-15T08:00' }, base).ends_at).toEqual({ code: 'poll_end_shorten' })
    expect(validateDraft('poll', { ...original, pollEndsAt: '2026-10-01T08:00' }, base).ends_at).toEqual({ code: 'poll_end_past' })
  })
})

describe('draftFromSource — the form starts from the row read on open', () => {
  it('a member event round-trips its stored wall-clock strings and zone', () => {
    const draft = draftFromSource(
      { post_type: 'event_post', content: 'Potluck', metadata: { starts_at: '2026-10-10T18:00', ends_at: '2026-10-10T20:00:00', time_zone: NY, location: 'Hall', is_online: false }, image_url: null, image_alt: null, max_seekers: null },
      'America/Los_Angeles',
    )
    expect(draft).toMatchObject({ content: 'Potluck', startsAt: '2026-10-10T18:00', endsAt: '2026-10-10T20:00', timeZone: NY, location: 'Hall' })
  })
  it('a poll reads its options and its deadline in the viewer zone', () => {
    const draft = draftFromSource(
      { post_type: 'poll', content: 'Which?', metadata: null, image_url: null, image_alt: null, max_seekers: null, poll: { question: 'Which?', options: ['Sat', 'Sun'], ends_at: '2026-10-10T22:00:00Z' } },
      NY,
    )
    expect(draft.options).toEqual(['Sat', 'Sun'])
    expect(draft.pollEndsAt).toBe('2026-10-10T18:00')
    expect(inputToInstant(draft.pollEndsAt, NY)).toBe('2026-10-10T22:00:00.000Z')
  })
})

describe('mergeDrafts — the "Combine" choice of an edit conflict', () => {
  const base = d({ content: 'Pantry open Sat', categories: ['Food'] })
  it('a field only I changed takes mine; a field only they changed takes theirs', () => {
    const mine = { ...base, categories: ['Food', 'Housing'] }
    const theirs = { ...base, content: 'Pantry open Sun' }
    const { draft, conflicts } = mergeDrafts('seeker_request', base, mine, theirs)
    expect(draft).toMatchObject({ content: 'Pantry open Sun', categories: ['Food', 'Housing'] })
    expect(conflicts).toEqual([])
  })
  it('a field we both changed keeps MY text and is listed as a conflict', () => {
    const mine = { ...base, content: 'Pantry open Sat 9am' }
    const theirs = { ...base, content: 'Pantry closed Sat' }
    const { draft, conflicts } = mergeDrafts('seeker_request', base, mine, theirs)
    expect(draft.content).toBe('Pantry open Sat 9am')
    expect(conflicts).toEqual(['content'])
    expect(changedFields('seeker_request', mine, theirs)).toEqual(['content'])
  })
})
