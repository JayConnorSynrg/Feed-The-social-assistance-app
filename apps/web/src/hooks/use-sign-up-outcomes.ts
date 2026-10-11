'use client'

// apps/web/src/hooks/use-sign-up-outcomes.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a member hears, and where their focus is, after a sign-up ("opt-in") action on a feed post
// card has gone through. Opting in swaps the Opt In button for "Opted In" and Withdraw; Accept,
// Decline and Mark Completed swap a row's buttons; each removes the button that was pressed.
//
// The feed panel's handlers (components/panels/feed-panel.tsx) send what they always sent. They
// tell this hook when an attempt begins, when its request came back and when the read that
// follows it has settled; the hook sends nothing. Once the state the card renders from shows the
// outcome — the control that replaces the pressed one is on the page — it asks the feed's
// card-notice announcer for one frame in which focus moves first and the sentence is written
// second (hooks/use-feed-event-cards.ts), exactly once. Focus moves only when the pressed control
// is gone and focus went with it (lib/focus-lost.ts).
//
// One attempt per row (per post for the member's own two actions), so two quick actions on
// different rows are both said. A row is busy from the press until its outcome is said or its
// action fails: a second press on it starts nothing. An attempt never outlives the read that
// follows its action (it is said then, shown or not), nor the account or sub-tab it began in.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { cardT } from '@/lib/i18n-feed-card'
import { optInsT, signUpNotice, type SignUpKind } from '@/lib/i18n-feed-optins'
import { focusWasLost } from '@/lib/focus-lost'

/** A row of the author's sign-up list, as far as this hook reads it. */
export interface SignUpRow {
  id: string
  postId: string
  seekerName: string
  status: string
}

export interface SignUpAttempt {
  kind: SignUpKind
  postId: string
  /** The row an author's action is about; null for the member's own two actions. */
  optInId: string | null
  /** The person in that row, as they wrote their name. */
  name: string | null
  /** The control that was pressed. */
  pressed: HTMLElement | null
  /** The rows listed after that row, in order. */
  rowsAfter: string[]
  /** The sub-tab visit and account it began in (SignUpOutcomesOptions.context). */
  context: string
}

/** What an attempt is kept under: its row, or its post for the member's own two actions. */
export const signUpAttemptKey = (attempt: Pick<SignUpAttempt, 'optInId' | 'postId'>): string => attempt.optInId ?? `post:${attempt.postId}`

type AuthorRows = Record<string, SignUpRow[]>
type MemberStatuses = ReadonlyMap<string, unknown>

/** The data-testid of the control each action is pressed on (components/feed/feed-post-card.tsx). */
export function signUpControlTestId(kind: SignUpKind, postId: string, optInId: string | null): string {
  switch (kind) {
    case 'optIn':
      return `opt-in-btn-${postId}`
    case 'withdraw':
      return `withdraw-btn-${postId}`
    case 'accept':
      return `accept-optin-${optInId}`
    case 'decline':
      return `decline-optin-${optInId}`
    case 'complete':
      return `complete-optin-${optInId}`
    case 'unblock':
      return `unblock-optin-${optInId}`
  }
}

const STATUS_AFTER: Partial<Record<SignUpKind, string>> = { accept: 'accepted', decline: 'declined', complete: 'completed' }

/** True once the state the card renders from shows what the action did. */
export function signUpOutcomeShown(attempt: SignUpAttempt, memberStatuses: MemberStatuses, authorRows: AuthorRows): boolean {
  if (attempt.kind === 'optIn') return memberStatuses.get(attempt.postId) != null
  if (attempt.kind === 'withdraw') return memberStatuses.get(attempt.postId) == null
  const row = (authorRows[attempt.postId] ?? []).find((r) => r.id === attempt.optInId)
  if (attempt.kind === 'unblock') return row === undefined
  return row?.status === STATUS_AFTER[attempt.kind]
}

/**
 * Where focus goes once the pressed control is gone:
 *   opt in → Withdraw; withdraw → Opt In; accept → that row's Mark Completed;
 *   mark completed → the sign-up list toggle;
 *   decline → that same row's control (Unblock: the way to undo it), else the toggle;
 *   unblock (the row is gone) → the first action of the next row that has one, else the toggle.
 * A target that is not on the page falls back to the toggle, then to the card itself.
 */
export function signUpFocusTarget(
  attempt: SignUpAttempt,
  byTestId: (testId: string) => HTMLElement | null,
  rowAction: (optInId: string) => HTMLElement | null,
): HTMLElement | null {
  const toggle = () => byTestId(`opt-in-manage-${attempt.postId}`) ?? byTestId(`post-card-${attempt.postId}`)
  switch (attempt.kind) {
    case 'optIn':
      return byTestId(`withdraw-btn-${attempt.postId}`) ?? byTestId(`post-card-${attempt.postId}`)
    case 'withdraw':
      return byTestId(`opt-in-btn-${attempt.postId}`) ?? byTestId(`post-card-${attempt.postId}`)
    case 'accept':
      return byTestId(`complete-optin-${attempt.optInId}`) ?? toggle()
    case 'complete':
      return toggle()
    case 'decline':
      return byTestId(`unblock-optin-${attempt.optInId}`) ?? (attempt.optInId ? rowAction(attempt.optInId) : null) ?? toggle()
    case 'unblock':
      for (const id of attempt.rowsAfter) {
        const action = rowAction(id)
        if (action) return action
      }
      return toggle()
  }
}

/**
 * The author's rows as the action itself left them — used when the read that follows a confirmed
 * action fails, so its row is not shown with the status it had before: accept, decline and mark
 * completed set that row's status; unblock removes the row. Other rows are returned as they are.
 */
export function signUpRowsAfter<R extends { id: string; status: string }>(rows: Record<string, R[]>, attempt: Pick<SignUpAttempt, 'kind' | 'optInId'>): Record<string, R[]> {
  const status = STATUS_AFTER[attempt.kind]
  if (!attempt.optInId || (attempt.kind !== 'unblock' && !status)) return rows
  const next: Record<string, R[]> = {}
  for (const [postId, list] of Object.entries(rows)) {
    next[postId] = attempt.kind === 'unblock' ? list.filter((r) => r.id !== attempt.optInId) : list.map((r) => (r.id === attempt.optInId ? { ...r, status: status as string } : r))
  }
  return next
}

const inPage = (selector: string) => (typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(selector))
const byTestId = (testId: string) => inPage(`[data-testid="${CSS.escape(testId)}"]`)
const rowAction = (optInId: string) => inPage(`[data-opt-in-row="${CSS.escape(optInId)}"] button:not([disabled])`)

export interface SignUpOutcomesOptions {
  locale: Locale
  /** The feed's card-notice announcer: in one frame, `moveFocus` first, then the sentence. Stable. */
  announce: (text: string, moveFocus?: () => void) => void
  /** post id → the viewer's own sign-up status (absent: not signed up). */
  memberStatuses: MemberStatuses
  /** post id → the rows of the author's sign-up list. */
  authorRows: AuthorRows
  /** What attempts belong to (the feed sub-tab and the signed-in account). When it changes, every
   *  attempt is dropped unsaid and every row is released. */
  context: string
}

interface Armed {
  attempt: SignUpAttempt
  /** The read that follows the action has settled: say the outcome now, shown or not. */
  settled: boolean
  /** True when that read failed: the stale-list sentence is added. */
  stale: boolean
}

const AUTHOR_KINDS: ReadonlySet<SignUpKind> = new Set<SignUpKind>(['accept', 'decline', 'complete', 'unblock'])
const NO_ROWS: ReadonlySet<string> = new Set()

export function useSignUpOutcomes({ locale, announce, memberStatuses, authorRows, context }: SignUpOutcomesOptions) {
  // Attempts whose request came back and whose outcome has not been said yet, in press order.
  const armed = useRef(new Map<string, Armed>())
  // Rows with an author action under way: set synchronously at the press (state alone would let
  // a second press through before the first has rendered). `busy` is the same set, for the card.
  const inFlight = useRef(new Set<string>())
  const [busyState, setBusyState] = useState<{ context: string; rows: ReadonlySet<string> }>({ context, rows: NO_ROWS })
  const busy = busyState.context === context ? busyState.rows : NO_ROWS
  // Bumped by `settled`, so the effect below runs after the render that applied the follow-up read.
  const [settledTick, setSettledTick] = useState(0)
  const rows = useRef(authorRows)
  useEffect(() => {
    rows.current = authorRows
  }, [authorRows])

  // Another account, or another sub-tab visit: nothing begun before is said or kept busy. An
  // attempt carries the context it began in, and is ignored once that is no longer the context.
  const contextRef = useRef(context)
  useEffect(() => {
    if (contextRef.current === context) return
    contextRef.current = context
    armed.current.clear()
    inFlight.current.clear()
  }, [context])

  const release = useCallback((attempt: SignUpAttempt) => {
    if (attempt.optInId && attempt.context === contextRef.current && inFlight.current.delete(attempt.optInId)) {
      setBusyState({ context: contextRef.current, rows: new Set(inFlight.current) })
    }
  }, [])

  /**
   * Call at the press, before anything is awaited: remembers the pressed control and whom the
   * action is about. Returns null when that row already has an action under way — the caller
   * sends nothing.
   */
  const begin = useCallback((kind: SignUpKind, ids: { postId?: string; optInId?: string }): SignUpAttempt | null => {
    const optInId = ids.optInId ?? null
    if (optInId && AUTHOR_KINDS.has(kind)) {
      if (inFlight.current.has(optInId)) return null
      inFlight.current.add(optInId)
      setBusyState({ context: contextRef.current, rows: new Set(inFlight.current) })
    }
    const row = optInId ? Object.values(rows.current).flat().find((r) => r.id === optInId) : undefined
    const postId = ids.postId ?? row?.postId ?? ''
    const list = rows.current[postId] ?? []
    const at = row ? list.findIndex((r) => r.id === row.id) : -1
    return {
      kind,
      postId,
      optInId,
      name: row?.seekerName ?? null,
      pressed: byTestId(signUpControlTestId(kind, postId, optInId)),
      rowsAfter: at >= 0 ? list.slice(at + 1).map((r) => r.id) : [],
      context: contextRef.current,
    }
  }, [])

  /** The request came back without an error: speak and move focus once the outcome is on screen. */
  const succeeded = useCallback((attempt: SignUpAttempt) => {
    if (attempt.context === contextRef.current) armed.current.set(signUpAttemptKey(attempt), { attempt, settled: false, stale: false })
  }, [])

  /** The request failed: say so in the same region. Focus stays on the pressed control; its row
   *  is free again. Other attempts are left as they are. */
  const failed = useCallback((attempt: SignUpAttempt) => {
    if (attempt.context !== contextRef.current) return
    const key = signUpAttemptKey(attempt)
    if (armed.current.get(key)?.attempt === attempt) armed.current.delete(key)
    release(attempt)
    announce(cardT(locale, 'statusModerationFailed'))
  }, [announce, locale, release])

  /**
   * The read that follows the action has settled: call it right after that read's state is set,
   * so the render that shows the outcome also frees the row. An outcome that render does not show
   * is said anyway, so no attempt is left to speak late. `stale`: that read failed — the list on
   * screen may be behind, and the sentence says so.
   */
  const settled = useCallback((attempt: SignUpAttempt, stale = false) => {
    if (attempt.context !== contextRef.current) return
    release(attempt)
    const entry = armed.current.get(signUpAttemptKey(attempt))
    if (entry?.attempt !== attempt) return
    entry.settled = true
    entry.stale = stale
    setSettledTick((t) => t + 1)
  }, [release])

  /**
   * The caller says this outcome itself (the card is leaving the feed): the attempt is dropped and
   * its row released. True when it had not been said yet.
   */
  const disarm = useCallback((attempt: SignUpAttempt): boolean => {
    if (attempt.context !== contextRef.current) return false
    const key = signUpAttemptKey(attempt)
    const pending = armed.current.get(key)?.attempt === attempt
    if (pending) armed.current.delete(key)
    release(attempt)
    return pending
  }, [release])

  /** The outcome sentence of an attempt, for a caller that says it itself. */
  const sentence = useCallback((attempt: SignUpAttempt) => signUpNotice(attempt.kind, attempt.name, locale), [locale])

  useEffect(() => {
    const ready = [...armed.current.values()].filter((e) => e.settled || signUpOutcomeShown(e.attempt, memberStatuses, authorRows))
    if (ready.length === 0) return
    for (const e of ready) armed.current.delete(signUpAttemptKey(e.attempt))
    // Outcomes that show in the same render are one announcement (a second one in the same frame
    // would replace the first); focus follows the latest press.
    const said = ready.map((e) => signUpNotice(e.attempt.kind, e.attempt.name, locale))
    if (ready.some((e) => e.stale)) said.push(optInsT(locale, 'announceListStale'))
    const last = ready[ready.length - 1].attempt
    announce(said.join(' '), () => {
      // A control still on the page, or a member who has moved on, keeps the focus.
      if (last.pressed?.isConnected || !focusWasLost(last.pressed)) return
      signUpFocusTarget(last, byTestId, rowAction)?.focus()
    })
  }, [memberStatuses, authorRows, locale, announce, settledTick])

  return { begin, succeeded, failed, settled, disarm, sentence, busy }
}
