'use client'

// apps/web/src/components/feed/post-edit-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The edit dialog for every member post type (petitions excepted). It:
//   - reads the post on open (server truth: the version token, the text, the poll and the counts the
//     locks depend on) — never the possibly stale card;
//   - renders the same fields as the create wizard (PostFormFields), locked fields read-only with
//     their reason;
//   - saves once (synchronous single-flight) through edit_post with the version it opened with,
//     sending only the changed keys, then settles the card from a fresh read of the row;
//   - on a stale version (PT409) shows the side-by-side comparison (keep mine / take the current
//     version / combine) with focus on its heading;
//   - on PT404 says the post is gone; on any other refusal explains it and keeps the draft.
// Focus returns to the element that opened it (the card's menu trigger).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/logger'
import { dir, type Locale } from '@/lib/i18n'
import { browserTimeZone, dateTimeFormat } from '@/lib/event-time'
import { editPost, type EditPostResult, type PostRpcFailure } from '@/lib/post-rpc'
import { editT, failureText, editTitleKey } from '@/lib/i18n-feed-edit'
import { usePostImagePicker, PostImagePickerField } from './post-image-picker'
import { createSingleFlight } from './composer-guards'
import { PostFormFields } from './post-form-fields'
import { EditConflictView, fieldDisplayText, type ConflictChoice } from './post-edit-conflict'
import { loadEditSource, loadFeedRow, type LoadedEditSource } from './post-edit-data'
import {
  LIMITS,
  capacityFloor,
  diffDraft,
  draftFromSource,
  fieldLocks,
  mergeDrafts,
  validateDraft,
  type DraftErrors,
  type EditFacts,
  type EditField,
  type PostDraft,
} from './post-edit-model'
import type { FeedPostRow, Post } from './post-model'

export interface PostEditDialogProps {
  /** The post to edit; the dialog is open while non-null. */
  post: Pick<Post, 'id' | 'postType'> | null
  locale: Locale
  onClose: () => void
  /** Where focus returns when the dialog closes (the menu trigger that opened it). */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  /** The save landed: `row` is the post re-read with the feed's columns (null if that read failed). */
  onSaved: (postId: string, row: FeedPostRow | null, result: EditPostResult, changes: Record<string, unknown>) => void
  /** The post no longer exists for this member (deleted, or never readable). */
  onGone: (postId: string) => void
  /** The dialog has closed and focus is back (announce what happened only now: while the modal is
   *  open the rest of the page — the feed's notice region included — is hidden from assistive tech). */
  onClosed?: () => void
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'gone' }
  | { kind: 'blocked'; reason: 'removed' }
  | {
      kind: 'editing'
      source: LoadedEditSource
      facts: EditFacts
      /** The form the dialog opened with (what diffDraft compares against). */
      original: PostDraft
      version: number
      /** The conflict "Combine" left these fields with the current text shown under them. */
      currentText: Partial<Record<EditField, string>>
      /** A legacy member event that has to gain a venue zone on this edit. */
      needsZone: boolean
    }
  | {
      kind: 'conflict'
      editing: Extract<Phase, { kind: 'editing' }>
      mine: PostDraft
      theirs: { source: LoadedEditSource; facts: EditFacts; draft: PostDraft }
      choice: ConflictChoice
    }

function formatWhen(iso: string | null, locale: Locale): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return dateTimeFormat(locale, browserTimeZone(), { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function PostEditDialog({ post, locale, onClose, returnFocusRef, onSaved, onGone, onClosed }: PostEditDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const viewerTz = useMemo(() => browserTimeZone(), [])
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<DraftErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const gate = useRef(createSingleFlight())
  const firstFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null)
  const picker = usePostImagePicker()
  const postId = post?.id ?? null
  const idPrefix = `edit-${postId ?? 'none'}`

  const startEditing = useCallback(
    (source: LoadedEditSource, facts: EditFacts, carry?: { draft: PostDraft; currentText: Partial<Record<EditField, string>> }) => {
      const original = draftFromSource(source, viewerTz)
      const needsZone = source.post_type === 'event_post' && !original.timeZone
      // A legacy member event gains the device's zone as a starting point; the member confirms it.
      const working = carry?.draft ?? (needsZone ? { ...original, timeZone: viewerTz } : original)
      setPhase({ kind: 'editing', source, facts, original, version: source.version, currentText: carry?.currentText ?? {}, needsZone })
      setDraft(working)
      setErrors({})
    },
    [viewerTz],
  )

  // Open: read the post (server truth).
  useEffect(() => {
    if (!postId) return
    let active = true
    setPhase({ kind: 'loading' })
    setDraft(null)
    setReason('')
    setBanner(null)
    void loadEditSource(supabase, postId).then((res) => {
      if (!active) return
      if (res.status === 'found') {
        if (res.source.hidden_reason === 'admin_removal') setPhase({ kind: 'blocked', reason: 'removed' })
        else startEditing(res.source, res.facts)
      } else setPhase({ kind: res.status })
    })
    return () => {
      active = false
    }
  }, [postId, supabase, startEditing])

  // Focus: the first field once the form is ready; the comparison's heading when it opens.
  useEffect(() => {
    if (phase.kind === 'editing') requestAnimationFrame(() => firstFieldRef.current?.focus())
    if (phase.kind === 'conflict') requestAnimationFrame(() => conflictHeadingRef.current?.focus())
  }, [phase.kind])

  const close = useCallback(() => {
    // A photo uploaded in this dialog and never saved is deleted (a committed one never is).
    picker.clearImage()
    onClose()
  }, [onClose, picker])

  const editing = phase.kind === 'editing' ? phase : null
  const effective: PostDraft | null = draft && picker.imageUrl ? { ...draft, imageUrl: picker.imageUrl } : draft
  const changes = editing && effective ? diffDraft(editing.source.post_type, editing.original, effective, viewerTz) : {}
  const hasChanges = Object.keys(changes).length > 0 || (editing?.needsZone ?? false)

  const applyFailure = useCallback(
    async (failure: PostRpcFailure, current: Extract<Phase, { kind: 'editing' }>, mine: PostDraft) => {
      switch (failure.kind) {
        case 'conflict': {
          const res = await loadEditSource(supabase, current.source.id)
          if (res.status === 'gone') return setPhase({ kind: 'gone' })
          if (res.status !== 'found') return setBanner(failureText(locale, failure))
          return setPhase({
            kind: 'conflict',
            editing: current,
            mine,
            theirs: { source: res.source, facts: res.facts, draft: draftFromSource(res.source, viewerTz) },
            choice: 'keep_mine',
          })
        }
        case 'not_found':
          return setPhase({ kind: 'gone' })
        case 'forbidden':
          if (failure.token === 'post_removed') return setPhase({ kind: 'blocked', reason: 'removed' })
          return setBanner(failureText(locale, failure))
        case 'locked': {
          // Someone voted since the dialog opened: refresh the locks, keep the draft.
          const res = await loadEditSource(supabase, current.source.id)
          if (res.status === 'found') setPhase({ ...current, facts: res.facts })
          return setBanner(failureText(locale, failure))
        }
        case 'capacity':
          setPhase({ ...current, facts: { ...current.facts, committedOptIns: failure.committed ?? current.facts.committedOptIns } })
          setErrors({ max_seekers: { code: 'capacity_range', min: Math.max(1, failure.committed ?? 1), max: LIMITS.capacityMax } })
          return setBanner(failureText(locale, failure))
        case 'event': {
          const next: DraftErrors = {}
          if (failure.problems.starts_at) next.starts_at = { code: failure.problems.starts_at === 'required' ? 'required' : 'invalid' }
          if (failure.problems.time_zone) next.time_zone = { code: 'zone_required' }
          if (failure.problems.ends_at) next.ends_at = { code: failure.problems.ends_at === 'before_start' ? 'end_before_start' : 'invalid' }
          setErrors(next)
          return setBanner(failureText(locale, failure))
        }
        case 'invalid':
        case 'required':
          setErrors({ [failure.field]: { code: failure.kind === 'required' ? 'required' : 'invalid' } } as DraftErrors)
          return setBanner(failureText(locale, failure))
        default:
          return setBanner(failureText(locale, failure))
      }
    },
    [supabase, locale, viewerTz],
  )

  const save = useCallback(
    async (current: Extract<Phase, { kind: 'editing' }>, mine: PostDraft) => {
      await gate.current.run(async () => {
        const found = validateDraft(current.source.post_type, mine, { original: current.original, facts: current.facts, viewerTz })
        setErrors(found)
        if (Object.keys(found).length > 0) {
          setBanner(editT(locale, 'fixErrors'))
          return
        }
        const toSend = diffDraft(current.source.post_type, current.original, mine, viewerTz)
        // A legacy event's first edit must carry its zone even when the member changed nothing else.
        if (current.needsZone && !('time_zone' in toSend)) Object.assign(toSend, { time_zone: mine.timeZone })
        if (Object.keys(toSend).length === 0) return
        setSaving(true)
        setBanner(null)
        try {
          const res = await editPost(supabase, {
            postId: current.source.id,
            postType: current.source.post_type,
            expectedVersion: current.version,
            changes: toSend,
            reason: reason.trim() || null,
          })
          if (!res.ok) {
            await applyFailure(res.failure, current, mine)
            return
          }
          const row = await loadFeedRow(supabase, current.source.id)
          picker.resetAfterPost()
          onSaved(current.source.id, row, res.value, toSend as Record<string, unknown>)
          onClose()
        } finally {
          setSaving(false)
        }
      })
    },
    [viewerTz, locale, supabase, reason, applyFailure, picker, onSaved, onClose],
  )

  const resolveConflict = useCallback(async () => {
    if (phase.kind !== 'conflict') return
    const { editing: before, mine, theirs, choice } = phase
    logEvent('feed.post.edit.conflict', { post_type: before.source.post_type, resolution: choice })
    if (choice === 'take_theirs') {
      const row = await loadFeedRow(supabase, theirs.source.id)
      onSaved(
        theirs.source.id,
        row,
        { version: theirs.source.version, editedAt: theirs.source.edited_at, editCount: 0, grace: false, changed: [] },
        {},
      )
      picker.clearImage()
      onClose()
      return
    }
    // Both other choices continue from the CURRENT version (its token, its counts).
    const theirsEditing: Extract<Phase, { kind: 'editing' }> = {
      kind: 'editing',
      source: theirs.source,
      facts: theirs.facts,
      original: theirs.draft,
      version: theirs.source.version,
      currentText: {},
      needsZone: theirs.source.post_type === 'event_post' && !theirs.draft.timeZone,
    }
    if (choice === 'keep_mine') {
      setPhase(theirsEditing)
      setDraft(mine)
      await save(theirsEditing, mine)
      return
    }
    const merged = mergeDrafts(before.source.post_type, before.original, mine, theirs.draft)
    const currentText: Partial<Record<EditField, string>> = {}
    for (const f of merged.conflicts) currentText[f] = fieldDisplayText(f, theirs.draft, locale)
    setPhase({ ...theirsEditing, currentText })
    setDraft(merged.draft)
  }, [phase, supabase, onSaved, picker, onClose, save, locale])

  const postType = editing?.source.post_type ?? post?.postType ?? 'feed'
  const showCapacity =
    !!editing &&
    (editing.source.post_type === 'feed' || editing.source.post_type === 'source_offer' || editing.source.post_type === 'seeker_request') &&
    (editing.source.max_seekers != null || editing.source.resource_id != null)

  const photoSlot =
    editing && effective && editing.source.post_type === 'feed' ? (
      effective.imageUrl && !picker.previewUrl ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={effective.imageUrl} alt={effective.imageAlt || editT(locale, 'currentPhoto')} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => picker.fileInputRef.current?.click()}>
              {editT(locale, 'replacePhoto')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => draft && setDraft({ ...draft, imageUrl: null })}>
              {editT(locale, 'removePhoto')}
            </Button>
          </div>
          <input
            ref={picker.fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={picker.handleFileSelect}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      ) : (
        <div lang="en" dir="ltr" data-english-only="photo-picker">
        <PostImagePickerField
          previewUrl={picker.previewUrl}
          imageUploading={picker.imageUploading}
          imageError={picker.imageError}
          fileInputRef={picker.fileInputRef}
          onFileSelect={picker.handleFileSelect}
          onClear={picker.clearImage}
        />
        </div>
      )
    ) : undefined

  return (
    <Dialog open={post !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent
        disableOutsideClose
        lang={locale}
        dir={dir(locale)}
        className="max-h-[90vh] max-w-xl overflow-y-auto"
        data-testid="post-edit-dialog"
        onCloseAutoFocus={(e) => {
          if (returnFocusRef?.current) {
            e.preventDefault()
            returnFocusRef.current.focus()
          }
          onClosed?.()
        }}
      >
        <DialogHeader>
          <DialogTitle>{editT(locale, editTitleKey(postType))}</DialogTitle>
          <DialogDescription className="text-stone-700">{editT(locale, 'editDescription')}</DialogDescription>
        </DialogHeader>

        {phase.kind === 'loading' && (
          <p role="status" className="flex items-center gap-2 text-sm text-stone-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {editT(locale, 'loading')}
          </p>
        )}
        {phase.kind === 'error' && (
          <div role="alert" className="text-sm text-red-800">
            {editT(locale, 'loadFailed')}
          </div>
        )}
        {phase.kind === 'gone' && (
          <div role="alert" className="text-sm text-stone-800" data-testid="edit-gone">
            {editT(locale, 'postGone')}
          </div>
        )}
        {phase.kind === 'blocked' && (
          <div role="alert" className="text-sm text-stone-800">
            {editT(locale, 'postRemovedNoEdit')}
          </div>
        )}

        {editing && effective && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              if (!saving && hasChanges) void save(editing, effective)
            }}
            className="flex flex-col gap-4"
          >
            {editing.needsZone && (
              <p className="rounded-md border border-sky-300 bg-sky-50 p-2 text-sm text-sky-950">{editT(locale, 'legacyEventZone')}</p>
            )}
            {banner && (
              <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
                {banner}
              </p>
            )}
            <PostFormFields
              postType={editing.source.post_type}
              draft={effective}
              onChange={(next) => setDraft({ ...next, imageUrl: picker.imageUrl ? draft?.imageUrl ?? null : next.imageUrl })}
              mode="edit"
              locale={locale}
              idPrefix={idPrefix}
              locks={fieldLocks(editing.source.post_type, editing.facts)}
              errors={errors}
              showCapacity={showCapacity}
              capacityMin={capacityFloor(editing.facts)}
              currentText={editing.currentText}
              pollOpen={!editing.facts.pollEndsAt || Date.parse(editing.facts.pollEndsAt) > Date.now()}
              firstFieldRef={firstFieldRef}
              photoSlot={photoSlot}
            />
            <div>
              <Label htmlFor={`${idPrefix}-reason`}>{editT(locale, 'fieldReason')}</Label>
              <Input
                id={`${idPrefix}-reason`}
                dir="auto"
                value={reason}
                maxLength={LIMITS.reasonMax}
                onChange={(e) => setReason(e.target.value)}
                placeholder={editT(locale, 'placeholderReason')}
                aria-describedby={`${idPrefix}-reason-hint`}
                className="mt-1 bg-white text-stone-900 placeholder:text-stone-500"
              />
              <p id={`${idPrefix}-reason-hint`} className="mt-1 text-xs text-stone-600">
                {editT(locale, 'hintReason')}
              </p>
            </div>
            <DialogFooter className="gap-2">
              {!hasChanges && (
                <p id={`${idPrefix}-nochanges`} className="me-auto self-center text-xs text-stone-600">
                  {editT(locale, 'noChanges')}
                </p>
              )}
              <Button type="button" variant="outline" onClick={close}>
                {editT(locale, 'cancel')}
              </Button>
              <Button
                type="submit"
                // aria-disabled (not disabled): the button keeps focus while saving / with nothing to save.
                aria-disabled={saving || !hasChanges || picker.imageUploading || undefined}
                aria-describedby={!hasChanges ? `${idPrefix}-nochanges` : undefined}
                data-testid="post-edit-save"
                className="bg-[#4a5d23] text-white hover:bg-[#3a4d1a] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? editT(locale, 'saving') : editT(locale, 'save')}
              </Button>
            </DialogFooter>
            <p role="status" className="sr-only">
              {saving ? editT(locale, 'saving') : ''}
            </p>
          </form>
        )}

        {phase.kind === 'conflict' && (
          <>
            <EditConflictView
              postType={phase.editing.source.post_type}
              locale={locale}
              base={phase.editing.original}
              mine={phase.mine}
              theirs={phase.theirs.draft}
              theirsWhen={formatWhen(phase.theirs.source.edited_at, locale)}
              choice={phase.choice}
              onChoice={(choice) => setPhase({ ...phase, choice })}
              headingRef={conflictHeadingRef}
              idPrefix={`${idPrefix}-conflict`}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={close}>
                {editT(locale, 'cancel')}
              </Button>
              <Button type="button" onClick={() => void resolveConflict()} className="bg-[#4a5d23] text-white hover:bg-[#3a4d1a]" data-testid="conflict-continue">
                {editT(locale, 'continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {(phase.kind === 'gone' || phase.kind === 'blocked' || phase.kind === 'error') && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (phase.kind === 'gone' && postId) onGone(postId)
                close()
              }}
            >
              {editT(locale, 'close')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
