// apps/web/src/components/feed/post-edit-model.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure (JSX-free) model behind the create forms and the edit dialog of every member post type. The
// server contract (specs/post-editing-contract.md, "Per-type fields") is the authority; this module
// mirrors it so the forms show exactly the fields the server accepts, explain the ones that are
// locked, catch the errors the server would refuse before a round trip, and send only what changed:
//
//   EDITABLE_FIELDS   one typed map keyed by post_type (a new post_type is a compile error here)
//   draftFromSource   the form state, from the row the dialog read on open (server truth)
//   fieldLocks        what is locked and why (poll after the first vote, capacity held by opt-ins)
//   validateDraft     the same limits as the server (lengths, options, event zone + end, capacity)
//   diffDraft         only the changed, editable keys -> edit_post p_changes
//   createFields      every field of a new post -> create_post p_fields
//   mergeDrafts       three-way merge for the edit-conflict "Combine" choice
//
// Member event times are venue wall-clock strings ("YYYY-MM-DDTHH:MM", interpreted in the post's
// time_zone) and are round-tripped verbatim — never through Date, which would shift them by the
// viewer's offset. Poll deadlines are instants; the form edits them in the viewer's own zone.

import type { PostFields, PostType } from '@/lib/post-rpc'
import { checkLocalTime, dateTimeFormat, isKnownTimeZone, SERVER_UNSUPPORTED_ZONES } from '@/lib/event-time'

/** A field of create_post / edit_post (contract key names). */
export type EditField = keyof PostFields

/** The fields each post type accepts, in form order (contract table). Petitions are edited elsewhere. */
export const EDITABLE_FIELDS: Record<PostType, readonly EditField[]> = {
  feed: ['content', 'image_url', 'image_alt', 'max_seekers'],
  resource_post: ['content'],
  seeker_request: ['content', 'categories', 'max_seekers'],
  source_offer: ['content', 'categories', 'max_seekers'],
  event_post: ['content', 'starts_at', 'ends_at', 'time_zone', 'is_online', 'location'],
  poll: ['content', 'options', 'ends_at'],
  petition: [],
}

/** True when the member can edit this type from the feed (petitions have their own update path). */
export function isEditableType(postType: PostType): boolean {
  return EDITABLE_FIELDS[postType].length > 0
}

/** Server limits (post_normalize_fields). */
export const LIMITS = {
  contentMax: 5000,
  pollQuestionMin: 3,
  pollQuestionMax: 300,
  imageAltMax: 1000,
  capacityMin: 1,
  capacityMax: 1000,
  categoriesMax: 10,
  locationMax: 200,
  optionsMin: 2,
  optionsMax: 10,
  optionMax: 100,
  reasonMax: 500,
  commentMax: 2000,
} as const

/** The form state of one post (create or edit). Text inputs keep their raw text. */
export interface PostDraft {
  content: string
  imageUrl: string | null
  imageAlt: string
  /** '' = no limit. */
  maxSeekers: string
  categories: string[]
  /** Venue wall clock 'YYYY-MM-DDTHH:MM'. */
  startsAt: string
  /** '' = no end. */
  endsAt: string
  timeZone: string
  isOnline: boolean
  location: string
  options: string[]
  /** Poll deadline in the viewer's zone 'YYYY-MM-DDTHH:MM'; '' = no deadline. */
  pollEndsAt: string
  /** "Close the poll now" (sends ends_at "now"). */
  pollCloseNow: boolean
}

export const EMPTY_DRAFT: PostDraft = {
  content: '',
  imageUrl: null,
  imageAlt: '',
  maxSeekers: '',
  categories: [],
  startsAt: '',
  endsAt: '',
  timeZone: '',
  isOnline: false,
  location: '',
  options: ['', ''],
  pollEndsAt: '',
  pollCloseNow: false,
}

/** The post row (and its poll) the edit dialog reads on open — the form never starts from card state. */
export interface EditSource {
  post_type: PostType
  content: string
  metadata: unknown
  image_url: string | null
  image_alt: string | null
  max_seekers: number | null
  poll?: { question: string; options: unknown; ends_at: string | null } | null
}

/** Facts the locks depend on, read with the row. */
export interface EditFacts {
  /** Votes on the poll (0 for other types). */
  pollVotes: number
  /** Opt-in rows holding a slot (every resource_opt_ins row of the post). */
  committedOptIns: number
  /** The poll's current deadline (instant), or null. */
  pollEndsAt: string | null
}

const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/

/** A stored member-event time as the form's datetime-local value; '' when it is not a wall-clock string. */
export function wallClockInput(value: unknown): string {
  if (typeof value !== 'string') return ''
  const m = WALL_CLOCK.exec(value)
  return m ? `${m[1]}T${m[2]}` : ''
}

/** An instant as 'YYYY-MM-DDTHH:MM' in `tz` (the viewer's zone for a poll deadline). */
export function instantToInput(iso: string | null, tz: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = dateTimeFormat(null, tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '00'
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour') === '24' ? '00' : p('hour')}:${p('minute')}`
}

/** A 'YYYY-MM-DDTHH:MM' in `tz` as an instant with an offset (toISOString), or null when it does not exist. */
export function inputToInstant(local: string, tz: string): string | null {
  const m = WALL_CLOCK.exec(local)
  if (!m) return null
  const r = checkLocalTime(m[1], m[2], tz)
  return r.kind === 'ok' ? r.instant.toISOString() : null
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** The form state for editing, from the row read on open. */
export function draftFromSource(src: EditSource, viewerTz: string): PostDraft {
  const meta = record(src.metadata)
  const pollOptions = strings(src.poll?.options)
  return {
    ...EMPTY_DRAFT,
    content: src.content ?? '',
    imageUrl: src.image_url ?? null,
    imageAlt: src.image_alt ?? '',
    maxSeekers: src.max_seekers != null ? String(src.max_seekers) : '',
    categories: strings(meta.categories),
    startsAt: wallClockInput(meta.starts_at),
    endsAt: wallClockInput(meta.ends_at),
    timeZone: typeof meta.time_zone === 'string' ? meta.time_zone : '',
    isOnline: meta.is_online === true,
    location: typeof meta.location === 'string' ? meta.location : '',
    options: pollOptions.length > 0 ? pollOptions : ['', ''],
    pollEndsAt: instantToInput(src.poll?.ends_at ?? null, viewerTz),
    pollCloseNow: false,
  }
}

/** Why a field is locked or restricted (each has an on-screen explanation). */
export type LockReason =
  /** Poll question / options after the first vote. */
  | 'poll_voted'
  /** Poll deadline after the first vote: only extend, remove, or close now. */
  | 'poll_extend_only'
  /** Poll already closed and voted: it cannot reopen. */
  | 'poll_closed'

export function fieldLocks(postType: PostType, facts: EditFacts, now: number = Date.now()): Partial<Record<EditField, LockReason>> {
  if (postType !== 'poll' || facts.pollVotes === 0) return {}
  const closed = facts.pollEndsAt != null && Date.parse(facts.pollEndsAt) <= now
  return { content: 'poll_voted', options: 'poll_voted', ends_at: closed ? 'poll_closed' : 'poll_extend_only' }
}

/** The least capacity the post can be set to (the opt-ins already holding a slot), or null when any is fine. */
export function capacityFloor(facts: EditFacts): number {
  return Math.max(LIMITS.capacityMin, facts.committedOptIns)
}

export type FieldError =
  | { code: 'required' }
  | { code: 'too_long'; max: number }
  | { code: 'too_short'; min: number }
  | { code: 'too_many'; max: number }
  | { code: 'invalid' }
  | { code: 'end_before_start' }
  | { code: 'zone_required' }
  | { code: 'zone_unsupported' }
  | { code: 'capacity_range'; min: number; max: number }
  | { code: 'options_count'; min: number; max: number }
  | { code: 'options_duplicate' }
  | { code: 'option_empty' }
  | { code: 'poll_end_past' }
  | { code: 'poll_end_shorten' }

export type DraftErrors = Partial<Record<EditField, FieldError>>

const len = (s: string) => [...s.trim()].length

/**
 * The same checks the server makes, so the form explains a problem before saving. `original` is the
 * form state the dialog opened with (null when creating); `facts` the counts the locks depend on.
 */
export function validateDraft(
  postType: PostType,
  draft: PostDraft,
  opts: { original: PostDraft | null; facts: EditFacts; viewerTz: string; now?: number },
): DraftErrors {
  const errors: DraftErrors = {}
  const fields = EDITABLE_FIELDS[postType]
  const now = opts.now ?? Date.now()
  const has = (f: EditField) => fields.includes(f)

  if (has('content')) {
    const n = len(draft.content)
    if (n === 0) errors.content = { code: 'required' }
    else if (postType === 'poll' && n < LIMITS.pollQuestionMin) errors.content = { code: 'too_short', min: LIMITS.pollQuestionMin }
    else if (postType === 'poll' && n > LIMITS.pollQuestionMax) errors.content = { code: 'too_long', max: LIMITS.pollQuestionMax }
    else if (n > LIMITS.contentMax) errors.content = { code: 'too_long', max: LIMITS.contentMax }
  }
  if (has('image_alt') && len(draft.imageAlt) > LIMITS.imageAltMax) errors.image_alt = { code: 'too_long', max: LIMITS.imageAltMax }
  if (has('max_seekers') && draft.maxSeekers.trim() !== '') {
    const v = Number(draft.maxSeekers)
    const min = capacityFloor(opts.facts)
    if (!Number.isInteger(v) || v < min || v > LIMITS.capacityMax) errors.max_seekers = { code: 'capacity_range', min, max: LIMITS.capacityMax }
  }
  if (has('categories') && draft.categories.length > LIMITS.categoriesMax) {
    errors.categories = { code: 'too_many', max: LIMITS.categoriesMax }
  }
  if (postType === 'event_post') {
    if (!WALL_CLOCK.test(draft.startsAt)) errors.starts_at = { code: 'required' }
    if (!draft.timeZone) errors.time_zone = { code: 'zone_required' }
    else if (SERVER_UNSUPPORTED_ZONES.has(draft.timeZone) || !isKnownTimeZone(draft.timeZone)) errors.time_zone = { code: 'zone_unsupported' }
    if (draft.endsAt) {
      if (!WALL_CLOCK.test(draft.endsAt)) errors.ends_at = { code: 'invalid' }
      else if (WALL_CLOCK.test(draft.startsAt) && draft.endsAt <= draft.startsAt) errors.ends_at = { code: 'end_before_start' }
    }
    if (!draft.isOnline && len(draft.location) > LIMITS.locationMax) errors.location = { code: 'too_long', max: LIMITS.locationMax }
  }
  if (postType === 'poll') {
    const opts2 = draft.options.map((o) => o.trim())
    if (opts2.length < LIMITS.optionsMin || opts2.length > LIMITS.optionsMax) {
      errors.options = { code: 'options_count', min: LIMITS.optionsMin, max: LIMITS.optionsMax }
    } else if (opts2.some((o) => o.length === 0)) errors.options = { code: 'option_empty' }
    else if (opts2.some((o) => [...o].length > LIMITS.optionMax)) errors.options = { code: 'too_long', max: LIMITS.optionMax }
    else if (new Set(opts2.map((o) => o.toLowerCase())).size !== opts2.length) errors.options = { code: 'options_duplicate' }

    if (!draft.pollCloseNow && draft.pollEndsAt) {
      const end = inputToInstant(draft.pollEndsAt, opts.viewerTz)
      const original = opts.original?.pollEndsAt ? inputToInstant(opts.original.pollEndsAt, opts.viewerTz) : null
      const changed = !opts.original || draft.pollEndsAt !== opts.original.pollEndsAt
      if (!end) errors.ends_at = { code: 'invalid' }
      else if (changed && Date.parse(end) <= now) errors.ends_at = { code: 'poll_end_past' }
      else if (changed && opts.facts.pollVotes > 0 && original && Date.parse(end) < Date.parse(original)) {
        errors.ends_at = { code: 'poll_end_shorten' }
      }
    }
  }
  return errors
}

/** The edit_post / create_post value of one field from the form. */
function fieldValue(field: EditField, postType: PostType, d: PostDraft, viewerTz: string): unknown {
  switch (field) {
    case 'content':
      return d.content.trim()
    case 'image_url':
      return d.imageUrl
    case 'image_alt':
      return d.imageUrl ? d.imageAlt.trim() || null : null
    case 'max_seekers':
      return d.maxSeekers.trim() === '' ? null : Number(d.maxSeekers)
    case 'categories':
      return d.categories
    case 'starts_at':
      return d.startsAt
    case 'ends_at':
      if (postType === 'poll') {
        if (d.pollCloseNow) return 'now'
        return d.pollEndsAt ? inputToInstant(d.pollEndsAt, viewerTz) : null
      }
      return d.endsAt || null
    case 'time_zone':
      return d.timeZone
    case 'is_online':
      return d.isOnline
    case 'location':
      return d.isOnline ? null : d.location.trim() || null
    case 'options':
      return d.options.map((o) => o.trim())
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * edit_post p_changes: only the editable keys whose value differs from the form the dialog opened
 * with. An empty object means "no changes yet" (Save stays disabled).
 */
export function diffDraft(postType: PostType, original: PostDraft, draft: PostDraft, viewerTz: string): PostFields {
  const out: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS[postType]) {
    // An event's location follows is_online (cleared when online): compare the values that are sent.
    const before = fieldValue(f, postType, original, viewerTz)
    const after = fieldValue(f, postType, draft, viewerTz)
    if (!same(before, after)) out[f] = after
  }
  // A changed photo always carries its alt text with it (a new photo needs its own description).
  if ('image_url' in out && !('image_alt' in out) && draft.imageUrl) out.image_alt = fieldValue('image_alt', postType, draft, viewerTz)
  return out as PostFields
}

/** create_post p_fields: every field the type takes (empty optional ones left out). */
export function createFields(postType: PostType, draft: PostDraft, viewerTz: string): PostFields {
  const out: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS[postType]) {
    const v = fieldValue(f, postType, draft, viewerTz)
    if (v === null || v === '' || (Array.isArray(v) && v.length === 0 && f !== 'categories')) continue
    out[f] = v
  }
  return out as PostFields
}

/** Every value of a form field the merge compares (one per contract field). */
function draftSlice(field: EditField, d: PostDraft): unknown {
  switch (field) {
    case 'content':
      return d.content
    case 'image_url':
      return d.imageUrl
    case 'image_alt':
      return d.imageAlt
    case 'max_seekers':
      return d.maxSeekers
    case 'categories':
      return d.categories
    case 'starts_at':
      return d.startsAt
    case 'ends_at':
      return [d.endsAt, d.pollEndsAt, d.pollCloseNow]
    case 'time_zone':
      return d.timeZone
    case 'is_online':
      return d.isOnline
    case 'location':
      return d.location
    case 'options':
      return d.options
  }
}

function withSlice(field: EditField, target: PostDraft, from: PostDraft): PostDraft {
  switch (field) {
    case 'content':
      return { ...target, content: from.content }
    case 'image_url':
      return { ...target, imageUrl: from.imageUrl }
    case 'image_alt':
      return { ...target, imageAlt: from.imageAlt }
    case 'max_seekers':
      return { ...target, maxSeekers: from.maxSeekers }
    case 'categories':
      return { ...target, categories: from.categories }
    case 'starts_at':
      return { ...target, startsAt: from.startsAt }
    case 'ends_at':
      return { ...target, endsAt: from.endsAt, pollEndsAt: from.pollEndsAt, pollCloseNow: from.pollCloseNow }
    case 'time_zone':
      return { ...target, timeZone: from.timeZone }
    case 'is_online':
      return { ...target, isOnline: from.isOnline }
    case 'location':
      return { ...target, location: from.location }
    case 'options':
      return { ...target, options: from.options }
  }
}

/**
 * The "Combine" choice of the edit conflict: start from the current server version ("theirs"), take
 * every field only I changed, and keep my text in every field we both changed differently (listed in
 * `conflicts`, so the form can show the current text under it and focus the first one).
 */
export function mergeDrafts(
  postType: PostType,
  base: PostDraft,
  mine: PostDraft,
  theirs: PostDraft,
): { draft: PostDraft; conflicts: EditField[] } {
  let draft = theirs
  const conflicts: EditField[] = []
  for (const f of EDITABLE_FIELDS[postType]) {
    const b = draftSlice(f, base)
    const m = draftSlice(f, mine)
    const t = draftSlice(f, theirs)
    const iChanged = !same(m, b)
    const theyChanged = !same(t, b)
    if (iChanged && !theyChanged) draft = withSlice(f, draft, mine)
    else if (iChanged && theyChanged && !same(m, t)) {
      draft = withSlice(f, draft, mine)
      conflicts.push(f)
    }
  }
  return { draft, conflicts }
}

/** The fields whose text differs between two drafts (the conflict comparison lists these). */
export function changedFields(postType: PostType, a: PostDraft, b: PostDraft): EditField[] {
  return EDITABLE_FIELDS[postType].filter((f) => !same(draftSlice(f, a), draftSlice(f, b)))
}
