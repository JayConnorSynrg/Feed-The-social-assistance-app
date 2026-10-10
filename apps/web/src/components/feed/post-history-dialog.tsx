'use client'

// apps/web/src/components/feed/post-history-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The public edit history of a post or a comment, opened from its "Edited" label. Versions are listed
// newest first; each shows when it was published, who edited it — by ROLE ("the author"), never a
// name — the author's note, the fields that changed, and a word diff against the previous readable
// version (DiffText: +/− glyphs and screen-reader "added"/"removed", never colour alone). A version
// whose private details were removed shows only that notice and who removed them (the author or a
// FEED admin). The author, and a platform admin, can remove private details from an earlier version
// ("Remove private details", a reason required for an admin); the current version is changed by
// editing. Focus starts on the title and returns to the opener.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/logger'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n-event-forms'
import { browserTimeZone, dateTimeFormat } from '@/lib/event-time'
import { redactCommentRevision, redactPostRevision, type PostType } from '@/lib/post-rpc'
import { editT, failureText, historyFieldLabel, redactorText } from '@/lib/i18n-feed-edit'
import { DiffText } from './diff-text'
import { buildHistory, commentRevisionItem, postRevisionItem, type CurrentVersion, type HistoryEntry } from './post-history'
import { loadCommentRevisions, loadPostRevisions } from './post-edit-data'
import { LIMITS } from './post-edit-model'

export type HistoryTarget =
  | { kind: 'post'; id: string; postType: PostType; authorId: string; current: CurrentVersion }
  | { kind: 'comment'; id: string; authorId: string; current: CurrentVersion }

export interface HistoryViewer {
  id: string | null
  isGuest: boolean
  isPlatformAdmin: boolean
}

/** Who may remove private details from a version: its author, or a platform admin (with a reason). */
export function redactRole(viewer: HistoryViewer, authorId: string): 'author' | 'platform_admin' | null {
  if (!viewer.id || viewer.isGuest) return null
  if (viewer.id === authorId) return 'author'
  return viewer.isPlatformAdmin ? 'platform_admin' : null
}

export function formatHistoryTime(iso: string, locale: Locale, tz: string = browserTimeZone()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateTimeFormat(locale, tz, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function entryTitle(e: HistoryEntry, locale: Locale): string {
  if (e.isCurrent && e.isOriginal) return editT(locale, 'historyCurrentOriginal')
  if (e.isCurrent) return editT(locale, 'historyCurrent')
  if (e.isOriginal) return editT(locale, 'historyOriginal')
  return formatMessage(editT(locale, 'historyVersion'), { n: e.version })
}

export interface HistoryListProps {
  entries: readonly HistoryEntry[]
  locale: Locale
  postType: PostType | 'comment'
  /** Non-null: this viewer may remove private details from earlier versions. */
  redactAs: 'author' | 'platform_admin' | null
  onRedact?: (entry: HistoryEntry) => void
  tz?: string
}

/** The version list (stateless, server-renderable — the dialog wraps it). */
export function HistoryList({ entries, locale, postType, redactAs, onRedact, tz }: HistoryListProps) {
  const added = editT(locale, 'srAdded')
  const removed = editT(locale, 'srRemoved')
  return (
    <ol className="flex flex-col gap-3" data-testid="history-list">
      {entries.map((e) => (
        <li key={e.key} className="rounded-lg border border-stone-200 p-3" data-testid={`history-entry-${e.version}`}>
          <p id={`history-entry-title-${e.version}`} className="text-sm font-semibold text-stone-900">
            {entryTitle(e, locale)} · <time dateTime={e.publishedAt}>{formatHistoryTime(e.publishedAt, locale, tz)}</time>
          </p>
          <p className="text-xs text-stone-700">{e.isOriginal ? editT(locale, 'historyPostedByAuthor') : editT(locale, 'historyEditedByAuthor')}</p>
          {e.redactedBy ? (
            <p className="mt-2 rounded-md bg-stone-100 p-2 text-sm text-stone-800">{redactorText(locale, e.redactedBy)}</p>
          ) : (
            <>
              {e.note && (
                <p className="mt-1 text-xs text-stone-700">
                  {editT(locale, 'historyNote')} <span dir="auto">{e.note}</span>
                </p>
              )}
              {e.changedFields.length > 0 && postType !== 'comment' && (
                <p className="mt-1 text-xs text-stone-700">
                  {formatMessage(editT(locale, 'historyChanged'), {
                    fields: [...new Set(e.changedFields.map((f) => historyFieldLabel(locale, postType, f)))].join(', '),
                  })}
                </p>
              )}
              {e.photoChange && <p className="mt-1 text-xs text-stone-700">{editT(locale, e.photoChange === 'removed' ? 'photoRemoved' : e.photoChange === 'added' ? 'photoAdded' : 'photoChanged')}</p>}
              <div className="mt-2">
                {e.diff ? (
                  <DiffText parts={e.diff} addedLabel={added} removedLabel={removed} />
                ) : (
                  <p dir="auto" className="whitespace-pre-wrap break-words text-sm text-stone-800">
                    {e.content}
                  </p>
                )}
              </div>
              {redactAs && !e.isCurrent && e.revisionId !== null && onRedact && (
                <button
                  type="button"
                  onClick={() => onRedact(e)}
                  aria-describedby={`history-entry-title-${e.version}`}
                  className="mt-2 text-xs font-medium text-red-800 underline underline-offset-2 hover:text-red-900"
                  data-testid={`history-redact-${e.version}`}
                >
                  {editT(locale, 'redactAction')}
                </button>
              )}
            </>
          )}
        </li>
      ))}
    </ol>
  )
}

export function PostHistoryDialog({
  target,
  locale,
  viewer,
  onClose,
  returnFocusRef,
}: {
  target: HistoryTarget | null
  locale: Locale
  viewer: HistoryViewer
  onClose: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; entries: HistoryEntry[] }>({ kind: 'loading' })
  const [redacting, setRedacting] = useState<HistoryEntry | null>(null)
  const [redactReason, setRedactReason] = useState('')
  const [redactError, setRedactError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const redactHeadingRef = useRef<HTMLHeadingElement>(null)
  // Single-flight: a second click before the first answer is ignored (set before the first await).
  const redactInFlight = useRef(false)
  const targetKey = target ? `${target.kind}:${target.id}` : null
  const redactAs = target ? redactRole(viewer, target.authorId) : null

  /** `quiet`: reload in place (after a redaction) — the list stays and nothing says "Loading". */
  const load = useCallback(async (quiet = false) => {
    if (!target) return
    if (!quiet) setState({ kind: 'loading' })
    if (target.kind === 'post') {
      const rows = await loadPostRevisions(supabase, target.id)
      if (!rows) return setState({ kind: 'error' })
      const entries = buildHistory(target.current, rows.map(postRevisionItem))
      setState({ kind: 'ready', entries })
      logEvent('feed.post.history.open', { post_type: target.postType, revision_count: rows.length, target: 'post' })
    } else {
      const rows = await loadCommentRevisions(supabase, target.id)
      if (!rows) return setState({ kind: 'error' })
      setState({ kind: 'ready', entries: buildHistory(target.current, rows.map(commentRevisionItem)) })
      logEvent('feed.post.history.open', { post_type: 'comment', revision_count: rows.length, target: 'comment' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, supabase])

  useEffect(() => {
    setRedacting(null)
    setStatus('')
    void load()
  }, [load])

  // The confirmation opens with focus on its heading; Cancel returns focus to that version's button.
  const redactingVersion = redacting?.version ?? null
  useEffect(() => {
    if (redactingVersion === null) return
    const raf = requestAnimationFrame(() => redactHeadingRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [redactingVersion])

  const cancelRedact = () => {
    const version = redacting?.version
    setRedacting(null)
    setRedactError(null)
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-testid="history-redact-${version}"]`)?.focus(),
    )
  }

  const confirmRedact = async () => {
    if (!target || !redacting || redacting.revisionId === null || redactInFlight.current) return
    if (redactAs === 'platform_admin' && !redactReason.trim()) {
      setRedactError(editT(locale, 'redactReasonRequired'))
      return
    }
    redactInFlight.current = true
    setBusy(true)
    setRedactError(null)
    setStatus('')
    let res: Awaited<ReturnType<typeof redactPostRevision>>
    try {
      res =
        target.kind === 'post'
          ? await redactPostRevision(supabase, redacting.revisionId, target.id, redactReason || null)
          : await redactCommentRevision(supabase, redacting.revisionId, target.id, redactReason || null)
    } finally {
      redactInFlight.current = false
      setBusy(false)
    }
    if (!res.ok) {
      setRedactError(
        res.failure.kind === 'forbidden' && res.failure.token === 'revision_under_report'
          ? editT(locale, 'redactUnderReport')
          : failureText(locale, res.failure),
      )
      return
    }
    setRedacting(null)
    setRedactReason('')
    // Reload in place, then announce once and move focus to the title.
    await load(true)
    setStatus(editT(locale, 'redactDone'))
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        lang={locale}
        dir={dir(locale)}
        className="max-h-[90vh] max-w-xl overflow-y-auto"
        aria-describedby={undefined}
        data-testid="post-history-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          if (returnFocusRef?.current) {
            e.preventDefault()
            returnFocusRef.current.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="focus:outline-hidden">
            {editT(locale, 'historyTitle')}
          </DialogTitle>
        </DialogHeader>
        <p role="status" className="sr-only">
          {state.kind === 'loading' ? editT(locale, 'historyLoading') : status}
        </p>
        {state.kind === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-stone-700" aria-hidden="true">
            <Loader2 className="h-4 w-4 animate-spin" />
            {editT(locale, 'historyLoading')}
          </p>
        )}
        {state.kind === 'error' && (
          <div role="alert" className="flex items-center gap-3 text-sm text-red-800">
            {editT(locale, 'historyLoadFailed')}
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              {editT(locale, 'retry')}
            </Button>
          </div>
        )}
        {state.kind === 'ready' && target && (
          <>
            {status && <p className="rounded-md bg-green-50 p-2 text-sm text-green-900">{status}</p>}
            <HistoryList
              entries={state.entries}
              locale={locale}
              postType={target.kind === 'post' ? target.postType : 'comment'}
              redactAs={redactAs}
              onRedact={(e) => {
                setRedacting(e)
                setRedactReason('')
                setRedactError(null)
              }}
            />
          </>
        )}
        {redacting && (
          <section aria-labelledby="redact-heading" className="rounded-lg border border-red-200 bg-red-50/40 p-3">
            <h3 id="redact-heading" ref={redactHeadingRef} tabIndex={-1} className="text-sm font-semibold text-stone-900 focus:outline-hidden" data-testid="redact-heading">
              {formatMessage(editT(locale, 'redactTitle'), { n: redacting.version })}
            </h3>
            <p className="mt-1 text-xs text-stone-700">{editT(locale, 'redactBody')}</p>
            <Label htmlFor="redact-reason" className="mt-2 block">
              {redactAs === 'platform_admin' ? editT(locale, 'redactReasonAdmin') : editT(locale, 'redactReasonOptional')}
            </Label>
            <Textarea
              id="redact-reason"
              dir="auto"
              rows={2}
              value={redactReason}
              maxLength={LIMITS.reasonMax}
              required={redactAs === 'platform_admin'}
              aria-invalid={redactError ? true : undefined}
              aria-describedby={redactError ? 'redact-error' : undefined}
              onChange={(e) => setRedactReason(e.target.value)}
              className="mt-1 bg-white text-stone-900"
            />
            {redactError && (
              <p id="redact-error" role="alert" className="mt-1 text-xs text-red-800">
                {redactError}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelRedact} data-testid="history-redact-cancel">
                {editT(locale, 'cancel')}
              </Button>
              <Button type="button" size="sm" onClick={() => void confirmRedact()} aria-disabled={busy || undefined} className="bg-red-700 text-white hover:bg-red-800" data-testid="history-redact-confirm">
                {editT(locale, 'redactConfirm')}
              </Button>
            </div>
          </section>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {editT(locale, 'close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
