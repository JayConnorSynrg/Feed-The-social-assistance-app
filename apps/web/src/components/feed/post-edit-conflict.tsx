'use client'

// apps/web/src/components/feed/post-edit-conflict.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The side-by-side comparison an edit opens when the post was saved somewhere else since the dialog
// opened (edit_post PT409 edit_conflict). Only the author edits a post, so "somewhere else" is the
// author's own other tab or device. For each field the two versions differ in, the member sees
// "Your edit" and "Current version", each as a word diff against the text both started from, then
// chooses: keep mine (save my edit over the current version), take the current version (discard my
// edit), or combine (back to the editor with every non-overlapping change of both, and the current
// text shown under each field we both changed). Nothing is lost silently.

import React from 'react'
import type { Locale } from '@/lib/i18n'
import { diffWords } from '@/lib/text-diff'
import { editT, fieldLabel } from '@/lib/i18n-feed-edit'
import { requestCategoryLabel } from '@/lib/i18n-feed-composer'
import { formatMessage } from '@/lib/i18n-event-forms'
import type { PostType } from '@/lib/post-rpc'
import { DiffText } from './diff-text'
import { changedFields, type EditField, type PostDraft } from './post-edit-model'

export type ConflictChoice = 'keep_mine' | 'take_theirs' | 'combine'

/** One field of a draft as plain text, for the comparison (and the "Current version says" note). */
export function fieldDisplayText(field: EditField, d: PostDraft, locale: Locale): string {
  switch (field) {
    case 'content':
      return d.content
    case 'image_url':
      return d.imageUrl ? editT(locale, 'photoPresent') : editT(locale, 'photoNone')
    case 'image_alt':
      return d.imageAlt
    case 'max_seekers':
      return d.maxSeekers.trim() === '' ? editT(locale, 'capacityNone') : d.maxSeekers
    case 'categories':
      return d.categories.map((c) => requestCategoryLabel(c, locale)).join(' · ')
    case 'starts_at':
      return d.startsAt.replace('T', ' ')
    case 'ends_at':
      if (d.pollCloseNow) return editT(locale, 'pollCloseNow')
      return (d.pollEndsAt || d.endsAt).replace('T', ' ') || editT(locale, 'noEnd')
    case 'time_zone':
      return d.timeZone
    case 'is_online':
      return d.isOnline ? editT(locale, 'yes') : editT(locale, 'no')
    case 'location':
      return d.location
    case 'options':
      return d.options.map((o) => o.trim()).join(' · ')
  }
}

export interface EditConflictViewProps {
  postType: PostType
  locale: Locale
  /** The form as it was when the dialog opened (what both versions started from). */
  base: PostDraft
  mine: PostDraft
  theirs: PostDraft
  /** When the current version was saved (ISO), already formatted for the viewer. */
  theirsWhen: string | null
  choice: ConflictChoice
  onChoice: (c: ConflictChoice) => void
  headingRef?: React.Ref<HTMLHeadingElement>
  idPrefix: string
}

export function EditConflictView({ postType, locale, base, mine, theirs, theirsWhen, choice, onChoice, headingRef, idPrefix }: EditConflictViewProps) {
  const fields = changedFields(postType, mine, theirs)
  const added = editT(locale, 'srAdded')
  const removed = editT(locale, 'srRemoved')
  return (
    <div className="flex flex-col gap-4" data-testid="edit-conflict">
      <div>
        <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-stone-900 focus:outline-none">
          {editT(locale, 'conflictTitle')}
        </h3>
        <p className="mt-1 text-sm text-stone-700">
          {theirsWhen ? formatMessage(editT(locale, 'conflictBodyWhen'), { when: theirsWhen }) : editT(locale, 'conflictBody')}
        </p>
      </div>
      {fields.map((f) => {
        const b = fieldDisplayText(f, base, locale)
        return (
          <section key={f} aria-labelledby={`${idPrefix}-${f}-h`} className="rounded-lg border border-stone-200 p-3">
            <h4 id={`${idPrefix}-${f}-h`} className="mb-2 text-sm font-semibold text-stone-900">
              {fieldLabel(locale, postType, f)}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-700">{editT(locale, 'yourEdit')}</p>
                <DiffText parts={diffWords(b, fieldDisplayText(f, mine, locale))} addedLabel={added} removedLabel={removed} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-700">{editT(locale, 'currentVersion')}</p>
                <DiffText parts={diffWords(b, fieldDisplayText(f, theirs, locale))} addedLabel={added} removedLabel={removed} />
              </div>
            </div>
          </section>
        )
      })}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-stone-900">{editT(locale, 'conflictChoose')}</legend>
        {(['keep_mine', 'take_theirs', 'combine'] as const).map((c) => (
          <label key={c} className="flex items-start gap-2 rounded-md border border-stone-200 p-2 text-sm text-stone-800 has-[:checked]:border-[#4a5d23]">
            <input
              type="radio"
              name={`${idPrefix}-choice`}
              value={c}
              checked={choice === c}
              onChange={() => onChoice(c)}
              className="mt-0.5 h-4 w-4 accent-[#4a5d23]"
              data-testid={`conflict-${c}`}
            />
            <span>
              <span className="font-medium">{editT(locale, c === 'keep_mine' ? 'keepMine' : c === 'take_theirs' ? 'takeTheirs' : 'combine')}</span>
              <span className="block text-xs text-stone-600">
                {editT(locale, c === 'keep_mine' ? 'keepMineHint' : c === 'take_theirs' ? 'takeTheirsHint' : 'combineHint')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
