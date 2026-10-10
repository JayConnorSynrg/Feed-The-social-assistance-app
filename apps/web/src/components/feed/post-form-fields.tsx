'use client'

// apps/web/src/components/feed/post-form-fields.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The fields of every member post type, shared by the create wizard and the edit dialog so both use
// one set of labels, limits and accessibility. Which fields render comes from EDITABLE_FIELDS (the
// server contract); a locked field stays visible, read-only and focusable, with its reason linked by
// aria-describedby; an invalid field carries aria-invalid and its message. Copy is translated
// (lib/i18n-feed-composer.ts); the member's own text inputs carry dir="auto".

import React, { useMemo } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Locale } from '@/lib/i18n'
import type { PostType } from '@/lib/post-rpc'
import { timeZoneOptions } from '@/lib/event-time'
import { composerT, requestCategoryLabel, REQUEST_CATEGORIES } from '@/lib/i18n-feed-composer'
import { editT, fieldErrorText, lockReasonText } from '@/lib/i18n-feed-edit'
import { formatMessage } from '@/lib/i18n-event-forms'
import {
  EDITABLE_FIELDS,
  LIMITS,
  type DraftErrors,
  type EditField,
  type FieldError,
  type LockReason,
  type PostDraft,
} from './post-edit-model'

export interface PostFormFieldsProps {
  postType: PostType
  draft: PostDraft
  onChange: (next: PostDraft) => void
  mode: 'create' | 'edit'
  locale: Locale
  /** Unique per form instance (ids, label associations). */
  idPrefix: string
  locks?: Partial<Record<EditField, LockReason>>
  errors?: DraftErrors
  /** Show the seeker-limit field (a post with a linked resource or an existing limit). */
  showCapacity?: boolean
  /** The least capacity allowed (opt-ins already holding a slot). */
  capacityMin?: number
  /** Edit conflict "Combine": the current server text under each field we both changed. */
  currentText?: Partial<Record<EditField, string>>
  /** Poll edit: the poll is still open (offers "Close the poll now"). */
  pollOpen?: boolean
  /** Ref for the first field (focus on open / on a combine). */
  firstFieldRef?: React.Ref<HTMLTextAreaElement | HTMLInputElement>
  /** The photo control (picker / current photo), rendered between the text and the photo description. */
  photoSlot?: React.ReactNode
}

/** The control for the first field (in form order) with an error: its input, its first option, or
 *  the first chip of its group. */
export function firstInvalidControl(
  postType: PostType,
  idPrefix: string,
  errors: DraftErrors,
  doc: Pick<Document, 'getElementById' | 'querySelector'> = document,
): HTMLElement | null {
  const f = EDITABLE_FIELDS[postType].find((k) => errors[k])
  if (!f) return null
  const base = `${idPrefix}-${f}`
  return (
    (doc.getElementById(`${base}-0`) as HTMLElement | null) ??
    (doc.getElementById(base) as HTMLElement | null) ??
    doc.querySelector<HTMLElement>(`[aria-labelledby="${base}-legend"] button`)
  )
}

const INPUT = 'mt-1 bg-white text-stone-900 placeholder:text-stone-500 read-only:bg-stone-100 read-only:text-stone-700'

/** aria wiring for a field: its error and/or lock / hint text. */
function describe(id: string, error: FieldError | undefined, extra: Array<string | null>) {
  const ids = [error ? `${id}-err` : null, ...extra].filter(Boolean).join(' ')
  return {
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': ids || undefined,
  }
}

function FieldNote({ id, text, tone = 'muted' }: { id: string; text: string; tone?: 'muted' | 'error' | 'current' }) {
  const cls =
    tone === 'error' ? 'text-red-700' : tone === 'current' ? 'text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1' : 'text-stone-600'
  return (
    <p id={id} className={`mt-1 text-xs ${cls}`} dir={tone === 'current' ? 'auto' : undefined}>
      {text}
    </p>
  )
}

function contentLabelKey(postType: PostType) {
  switch (postType) {
    case 'seeker_request':
      return 'fieldRequest' as const
    case 'source_offer':
      return 'fieldOffer' as const
    case 'event_post':
      return 'fieldEventTitle' as const
    case 'poll':
      return 'fieldPollQuestion' as const
    case 'resource_post':
      return 'fieldResourceNote' as const
    default:
      return 'fieldUpdate' as const
  }
}

function contentPlaceholderKey(postType: PostType) {
  switch (postType) {
    case 'seeker_request':
      return 'placeholderRequest' as const
    case 'source_offer':
      return 'placeholderOffer' as const
    case 'event_post':
      return 'placeholderEventTitle' as const
    case 'poll':
      return 'placeholderPollQuestion' as const
    case 'resource_post':
      return 'placeholderResourceNote' as const
    default:
      return 'placeholderUpdate' as const
  }
}

/** Chips for the request / offer categories: a labelled group of toggle buttons (aria-pressed). The
 *  stored value stays the English key; the label is translated. */
export function CategoryChips({
  id,
  selected,
  onChange,
  locale,
  disabled,
}: {
  id: string
  selected: string[]
  onChange: (next: string[]) => void
  locale: Locale
  disabled?: boolean
}) {
  const toggle = (cat: string) => onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat])
  return (
    <div role="group" aria-labelledby={`${id}-legend`}>
      <p id={`${id}-legend`} className="mb-2 block text-sm font-medium text-stone-800">
        {composerT(locale, 'fieldCategories')}
      </p>
      <div className="flex flex-wrap gap-2">
        {REQUEST_CATEGORIES.map((cat) => {
          const on = selected.includes(cat)
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(cat)}
              className={`min-h-8 rounded-full border px-3 py-1 text-xs transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#4a5d23] ${
                on ? 'border-[#4a5d23] bg-[#4a5d23] text-white' : 'border-stone-300 text-stone-700 hover:border-[#4a5d23]'
              }`}
            >
              {requestCategoryLabel(cat, locale)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Venue time-zone picker for member events: common US zones first, then every zone the server
 *  converts the same way (lib/event-time.ts timeZoneOptions leaves out SERVER_UNSUPPORTED_ZONES). */
function ZoneSelect({ id, value, onChange, locale, error, describedBy }: {
  id: string
  value: string
  onChange: (tz: string) => void
  locale: Locale
  error?: FieldError
  describedBy: string[]
}) {
  const options = useMemo(() => timeZoneOptions(locale, value), [locale, value])
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23]"
      {...describe(id, error, describedBy)}
    >
      {!value && <option value="">{composerT(locale, 'zonePlaceholder')}</option>}
      <optgroup label={composerT(locale, 'zoneCommon')}>
        {options.common.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </optgroup>
      <optgroup label={composerT(locale, 'zoneAll')}>
        {options.all.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

export function PostFormFields({
  postType,
  draft,
  onChange,
  mode,
  locale,
  idPrefix,
  locks = {},
  errors = {},
  showCapacity = false,
  capacityMin,
  currentText = {},
  pollOpen = true,
  firstFieldRef,
  photoSlot,
}: PostFormFieldsProps) {
  const fields = EDITABLE_FIELDS[postType]
  const has = (f: EditField) => fields.includes(f)
  const set = (patch: Partial<PostDraft>) => onChange({ ...draft, ...patch })
  const id = (f: string) => `${idPrefix}-${f}`
  const err = (f: EditField) => errors[f]
  const errNote = (f: EditField) =>
    errors[f] ? <FieldNote id={`${id(f)}-err`} text={fieldErrorText(locale, errors[f]!)} tone="error" /> : null
  const lockNote = (f: EditField) => (locks[f] ? <FieldNote id={`${id(f)}-lock`} text={lockReasonText(locks[f]!, locale)} /> : null)
  const currentNote = (f: EditField) =>
    currentText[f] !== undefined ? (
      <FieldNote id={`${id(f)}-current`} text={formatMessage(editT(locale, 'currentSays'), { text: currentText[f]! })} tone="current" />
    ) : null
  const extraIds = (f: EditField) => [locks[f] ? `${id(f)}-lock` : null, currentText[f] !== undefined ? `${id(f)}-current` : null]

  const contentLocked = locks.content !== undefined
  const optionsLocked = locks.options !== undefined
  const endLocked = locks.ends_at === 'poll_closed'

  return (
    <div className="flex flex-col gap-4">
      {has('content') && (
        <div>
          <Label htmlFor={id('content')}>{composerT(locale, contentLabelKey(postType))}</Label>
          {postType === 'poll' || postType === 'event_post' ? (
            <Input
              id={id('content')}
              ref={firstFieldRef as React.Ref<HTMLInputElement>}
              dir="auto"
              value={draft.content}
              readOnly={contentLocked}
              required
              aria-required="true"
              maxLength={postType === 'poll' ? LIMITS.pollQuestionMax : LIMITS.contentMax}
              onChange={(e) => set({ content: e.target.value })}
              placeholder={composerT(locale, contentPlaceholderKey(postType))}
              className={INPUT}
              {...describe(id('content'), err('content'), extraIds('content'))}
            />
          ) : (
            <Textarea
              id={id('content')}
              ref={firstFieldRef as React.Ref<HTMLTextAreaElement>}
              dir="auto"
              value={draft.content}
              readOnly={contentLocked}
              required={postType !== 'resource_post'}
              aria-required={postType !== 'resource_post' || undefined}
              maxLength={LIMITS.contentMax}
              onChange={(e) => set({ content: e.target.value })}
              placeholder={composerT(locale, contentPlaceholderKey(postType))}
              className={`${INPUT} min-h-[120px]`}
              {...describe(id('content'), err('content'), extraIds('content'))}
            />
          )}
          {lockNote('content')}
          {currentNote('content')}
          {errNote('content')}
        </div>
      )}

      {photoSlot}

      {has('image_alt') && draft.imageUrl && (
        <div>
          <Label htmlFor={id('image_alt')}>{editT(locale, 'fieldImageAlt')}</Label>
          <Textarea
            id={id('image_alt')}
            dir="auto"
            rows={2}
            value={draft.imageAlt}
            maxLength={LIMITS.imageAltMax}
            onChange={(e) => set({ imageAlt: e.target.value })}
            placeholder={editT(locale, 'placeholderImageAlt')}
            className={INPUT}
            {...describe(id('image_alt'), err('image_alt'), [`${id('image_alt')}-hint`, ...extraIds('image_alt')])}
          />
          <FieldNote id={`${id('image_alt')}-hint`} text={editT(locale, 'hintImageAlt')} />
          {currentNote('image_alt')}
          {errNote('image_alt')}
        </div>
      )}

      {has('categories') && (
        <div>
          <CategoryChips id={id('categories')} selected={draft.categories} onChange={(categories) => set({ categories })} locale={locale} />
          {currentNote('categories')}
          {errNote('categories')}
        </div>
      )}

      {has('starts_at') && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={id('starts_at')}>{composerT(locale, 'fieldStartsAt')}</Label>
              <Input
                id={id('starts_at')}
                type="datetime-local"
                value={draft.startsAt}
                required
                onChange={(e) => set({ startsAt: e.target.value })}
                className={INPUT}
                {...describe(id('starts_at'), err('starts_at'), extraIds('starts_at'))}
              />
              {currentNote('starts_at')}
              {errNote('starts_at')}
            </div>
            <div>
              <Label htmlFor={id('ends_at')}>{composerT(locale, 'fieldEndsAt')}</Label>
              <Input
                id={id('ends_at')}
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => set({ endsAt: e.target.value })}
                className={INPUT}
                {...describe(id('ends_at'), err('ends_at'), extraIds('ends_at'))}
              />
              {currentNote('ends_at')}
              {errNote('ends_at')}
            </div>
          </div>
          <div>
            <Label htmlFor={id('time_zone')}>{composerT(locale, 'fieldTimeZone')}</Label>
            <ZoneSelect
              id={id('time_zone')}
              value={draft.timeZone}
              onChange={(timeZone) => set({ timeZone })}
              locale={locale}
              error={err('time_zone')}
              describedBy={[`${id('time_zone')}-hint`, ...extraIds('time_zone').filter((x): x is string => !!x)]}
            />
            <FieldNote id={`${id('time_zone')}-hint`} text={composerT(locale, 'hintTimeZone')} />
            {currentNote('time_zone')}
            {errNote('time_zone')}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              id={id('is_online')}
              aria-checked={draft.isOnline}
              aria-labelledby={`${id('is_online')}-label`}
              onClick={() => set({ isOnline: !draft.isOnline })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#4a5d23] ${
                draft.isOnline ? 'bg-[#4a5d23]' : 'bg-stone-500'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${draft.isOnline ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
            </button>
            <span id={`${id('is_online')}-label`} className="text-sm font-medium text-stone-800">
              {composerT(locale, 'fieldOnline')}
            </span>
          </div>
          {!draft.isOnline && (
            <div>
              <Label htmlFor={id('location')}>{composerT(locale, 'fieldLocation')}</Label>
              <Input
                id={id('location')}
                dir="auto"
                value={draft.location}
                maxLength={LIMITS.locationMax}
                onChange={(e) => set({ location: e.target.value })}
                placeholder={composerT(locale, 'placeholderLocation')}
                className={INPUT}
                {...describe(id('location'), err('location'), extraIds('location'))}
              />
              {currentNote('location')}
              {errNote('location')}
            </div>
          )}
        </>
      )}

      {has('options') && (
        <div role="group" aria-labelledby={`${id('options')}-legend`}>
          <p id={`${id('options')}-legend`} className="text-sm font-medium text-stone-800">
            {composerT(locale, 'fieldOptions')}
          </p>
          <div className="mt-1 flex flex-col gap-2">
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  id={`${id('options')}-${i}`}
                  dir="auto"
                  value={opt}
                  readOnly={optionsLocked}
                  required
                  aria-required="true"
                  maxLength={LIMITS.optionMax}
                  aria-label={formatMessage(composerT(locale, 'optionN'), { n: i + 1 })}
                  placeholder={formatMessage(composerT(locale, 'optionN'), { n: i + 1 })}
                  onChange={(e) => set({ options: draft.options.map((o, j) => (j === i ? e.target.value : o)) })}
                  className={INPUT.replace('mt-1 ', '')}
                  {...describe(id('options'), err('options'), extraIds('options'))}
                />
                {!optionsLocked && draft.options.length > LIMITS.optionsMin && (
                  <button
                    type="button"
                    onClick={() => set({ options: draft.options.filter((_, j) => j !== i) })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-stone-600 hover:text-red-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#4a5d23]"
                    aria-label={formatMessage(composerT(locale, 'removeOptionN'), { n: i + 1 })}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!optionsLocked && draft.options.length < LIMITS.optionsMax && (
            <button
              type="button"
              onClick={() => set({ options: [...draft.options, ''] })}
              className="mt-2 text-sm font-medium text-[#4a5d23] hover:underline"
            >
              {composerT(locale, 'addOption')}
            </button>
          )}
          {lockNote('options')}
          {currentNote('options')}
          {errNote('options')}
        </div>
      )}

      {has('ends_at') && postType === 'poll' && (
        <div>
          <Label htmlFor={id('poll_ends')}>{composerT(locale, 'fieldPollEnds')}</Label>
          <Input
            id={id('poll_ends')}
            type="datetime-local"
            value={draft.pollEndsAt}
            readOnly={endLocked || draft.pollCloseNow}
            onChange={(e) => set({ pollEndsAt: e.target.value })}
            className={INPUT}
            {...describe(id('ends_at'), err('ends_at'), extraIds('ends_at'))}
          />
          {mode === 'edit' && pollOpen && (
            <label className="mt-2 flex items-center gap-2 text-sm text-stone-800">
              <input
                type="checkbox"
                checked={draft.pollCloseNow}
                onChange={(e) => set({ pollCloseNow: e.target.checked })}
                className="h-4 w-4 accent-[#4a5d23]"
              />
              {editT(locale, 'pollCloseNow')}
            </label>
          )}
          {lockNote('ends_at')}
          {currentNote('ends_at')}
          {errNote('ends_at')}
        </div>
      )}

      {has('max_seekers') && showCapacity && (
        <div>
          <Label htmlFor={id('max_seekers')}>{composerT(locale, 'fieldCapacity')}</Label>
          <Input
            id={id('max_seekers')}
            type="number"
            inputMode="numeric"
            min={capacityMin ?? LIMITS.capacityMin}
            max={LIMITS.capacityMax}
            value={draft.maxSeekers}
            onChange={(e) => set({ maxSeekers: e.target.value })}
            placeholder={composerT(locale, 'placeholderCapacity')}
            className={INPUT}
            {...describe(id('max_seekers'), err('max_seekers'), [capacityMin && capacityMin > 1 ? `${id('max_seekers')}-min` : null, ...extraIds('max_seekers')])}
          />
          {capacityMin && capacityMin > 1 ? (
            <FieldNote id={`${id('max_seekers')}-min`} text={formatMessage(editT(locale, 'hintCapacityMin'), { n: capacityMin })} />
          ) : null}
          {currentNote('max_seekers')}
          {errNote('max_seekers')}
        </div>
      )}
    </div>
  )
}
