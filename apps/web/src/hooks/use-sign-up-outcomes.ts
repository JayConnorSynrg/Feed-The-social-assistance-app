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
// follows its action, nor the account or sub-tab it began in.
//
// An outcome is said only when the server confirmed it. A request that came back without an error
// may still have changed nothing: an update that matched no row (the seeker had withdrawn), a
// withdraw that deleted none (the request had been accepted), an unblock that deleted none
// (another tab got there first). The caller tells the hook which it was — succeeded() or
// unchanged() — and, as a second check, a fresh read that does not show the outcome of an
// accept, decline, mark-completed, withdraw or unblock is not said as done either. A failure
// is never said here: the card shows it on its own alert line (which is what speaks), so it is
// heard once. The hook only puts focus somewhere stable when the pressed control goes.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n'
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
  /** Set when its request came back: true when the server changed something, false when the
   *  request answered without an error and changed nothing. Unset until then. */
  changed?: boolean
}

/**
 * How the read that follows an action ended:
 *   fresh  — it was read again and written to the state the card renders from;
 *   stale  — that read failed (the list on screen may be behind);
 *   unread — nothing was read for it (its card is not on screen any more).
 */
export type SignUpSettle = 'fresh' | 'stale' | 'unread'

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
/** Writes that answer without an error even when they changed no row (an update that matches
 *  none, a withdraw or an unblock that deletes none). Only opt_in_to_post refuses with an error. */
const NEEDS_PROOF: ReadonlySet<SignUpKind> = new Set<SignUpKind>(['accept', 'decline', 'complete', 'withdraw', 'unblock'])

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

/** Where focus goes when an action turned out not to be done and its control is gone: the
 *  sign-up list toggle of that post, else the card. */
export function signUpStableTarget(attempt: Pick<SignUpAttempt, 'postId'>, byTestId: (testId: string) => HTMLElement | null): HTMLElement | null {
  return byTestId(`opt-in-manage-${attempt.postId}`) ?? byTestId(`post-card-${attempt.postId}`)
}

/**
 * True when the outcome of an attempt may be said: the server changed something, and — for the
 * actions whose request answers without an error even when it changed nothing — a fresh read does
 * not contradict it. A stale or missing read cannot contradict: the write's own answer stands.
 */
export function signUpDone(attempt: Pick<SignUpAttempt, 'kind' | 'changed'>, settle: SignUpSettle | null, shown: boolean): boolean {
  if (attempt.changed !== true) return false
  return !(settle === 'fresh' && NEEDS_PROOF.has(attempt.kind) && !shown)
}

/**
 * The author's rows as the action itself left them — used when the read that follows a CONFIRMED
 * action fails, so its row is not shown with the status it had before: accept, decline and mark
 * completed set that row's status; unblock removes the row. Other rows are returned as they are.
 * An action that changed nothing (attempt.changed === false) settles nothing: its request no
 * longer exists, or is in another state, and only a read can say which.
 */
export function signUpRowsAfter<R extends { id: string; status: string }>(rows: Record<string, R[]>, attempt: Pick<SignUpAttempt, 'kind' | 'optInId' | 'changed'>): Record<string, R[]> {
  const status = STATUS_AFTER[attempt.kind]
  if (attempt.changed === false || !attempt.optInId || (attempt.kind !== 'unblock' && !status)) return rows
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
  /** An action the caller reported as done turned out not to be (a fresh read does not show it):
   *  the caller shows the failure on the card, as it does for one it reported itself. */
  onNotDone: (attempt: SignUpAttempt) => void
}

interface Armed {
  attempt: SignUpAttempt
  /** How the read that follows the action ended; null while it is on its way. */
  settled: SignUpSettle | null
}

const AUTHOR_KINDS: ReadonlySet<SignUpKind> = new Set<SignUpKind>(['accept', 'decline', 'complete', 'unblock'])
const NO_ROWS: ReadonlySet<string> = new Set()

export function useSignUpOutcomes({ locale, announce, memberStatuses, authorRows, context, onNotDone }: SignUpOutcomesOptions) {
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
  const notDone = useRef(onNotDone)
  useEffect(() => {
    rows.current = authorRows
    notDone.current = onNotDone
  }, [authorRows, onNotDone])

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

  const arm = useCallback((attempt: SignUpAttempt, changed: boolean) => {
    if (attempt.context !== contextRef.current) return
    attempt.changed = changed
    armed.current.set(signUpAttemptKey(attempt), { attempt, settled: null })
  }, [])

  /** The request came back and the server changed something: speak and move focus once the
   *  outcome is on screen. */
  const succeeded = useCallback((attempt: SignUpAttempt) => arm(attempt, true), [arm])

  /**
   * The request came back without an error and changed nothing (the caller shows the failure on
   * the card). Nothing is said for it; when the read that follows it has corrected the card and
   * the pressed control is gone, focus is put on a stable control.
   */
  const unchanged = useCallback((attempt: SignUpAttempt) => arm(attempt, false), [arm])

  /** The request failed (the caller shows the failure on the card). Focus stays on the pressed
   *  control; its row is free again. Other attempts are left as they are. */
  const failed = useCallback((attempt: SignUpAttempt) => {
    if (attempt.context !== contextRef.current) return
    const key = signUpAttemptKey(attempt)
    if (armed.current.get(key)?.attempt === attempt) armed.current.delete(key)
    release(attempt)
  }, [release])

  /**
   * The read that follows the action has settled: call it right after that read's state is set,
   * so the render that shows the outcome also frees the row. No attempt is left to speak late:
   * it is settled then, and said or not by signUpDone.
   */
  const settled = useCallback((attempt: SignUpAttempt, how: SignUpSettle = 'fresh') => {
    if (attempt.context !== contextRef.current) return
    release(attempt)
    const entry = armed.current.get(signUpAttemptKey(attempt))
    if (entry?.attempt !== attempt) return
    entry.settled = how
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
    // Ready: the read that follows it has settled, or (for a confirmed change) the card shows it.
    const ready = [...armed.current.values()].filter((e) => e.settled !== null || (e.attempt.changed === true && signUpOutcomeShown(e.attempt, memberStatuses, authorRows)))
    if (ready.length === 0) return
    for (const e of ready) armed.current.delete(signUpAttemptKey(e.attempt))
    const done = ready.map((e) => signUpDone(e.attempt, e.settled, signUpOutcomeShown(e.attempt, memberStatuses, authorRows)))
    // Reported as done, and a fresh read does not show it: the caller shows the failure.
    ready.forEach((e, i) => {
      if (!done[i] && e.attempt.changed === true) notDone.current(e.attempt)
    })
    // Outcomes that show in the same render are one announcement (a second one in the same frame
    // would replace the first); focus follows the latest press. Only outcomes are said here.
    const said = ready.filter((_, i) => done[i]).map((e) => signUpNotice(e.attempt.kind, e.attempt.name, locale))
    if (ready.some((e) => e.settled === 'stale')) said.push(optInsT(locale, 'announceListStale'))
    const last = ready[ready.length - 1].attempt
    const lastDone = done[done.length - 1]
    announce(said.join(' '), () => {
      // A control still on the page, or a member who has moved on, keeps the focus.
      if (last.pressed?.isConnected || !focusWasLost(last.pressed)) return
      ;(lastDone ? signUpFocusTarget(last, byTestId, rowAction) : signUpStableTarget(last, byTestId))?.focus()
    })
  }, [memberStatuses, authorRows, locale, announce, settledTick])

  return { begin, succeeded, unchanged, failed, settled, disarm, sentence, busy }
}
