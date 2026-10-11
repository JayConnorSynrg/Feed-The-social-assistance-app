'use client'

// apps/web/src/hooks/use-sign-up-outcomes.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a member hears, and where their focus is, after a sign-up ("opt-in") action on a feed post
// card has gone through. Opting in swaps the Opt In button for "Opted In" and Withdraw; Accept,
// Decline and Mark Completed swap a row's buttons; each removes the button that was pressed.
//
// The feed panel's handlers (components/panels/feed-panel.tsx) send what they always sent. They
// tell this hook when an attempt begins and when its request came back; the hook sends nothing.
// Once the state the card renders from shows the outcome — the control that replaces the pressed
// one is on the page — it asks the feed's card-notice announcer for one frame in which focus
// moves first and the sentence is written second (hooks/use-feed-event-cards.ts), exactly once.
// Focus moves only when the pressed control is gone and focus went with it (lib/focus-lost.ts).

import { useCallback, useEffect, useRef } from 'react'
import type { Locale } from '@/lib/i18n'
import { cardT } from '@/lib/i18n-feed-card'
import { signUpNotice, type SignUpKind } from '@/lib/i18n-feed-optins'
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
}

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
 *   decline or unblock → the first action of the next row that has one, else the toggle.
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
    case 'unblock':
      for (const id of attempt.rowsAfter) {
        const action = rowAction(id)
        if (action) return action
      }
      return toggle()
  }
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
}

export function useSignUpOutcomes({ locale, announce, memberStatuses, authorRows }: SignUpOutcomesOptions) {
  // The attempt whose request came back and whose outcome is not on screen yet.
  const awaited = useRef<SignUpAttempt | null>(null)
  const rows = useRef(authorRows)
  useEffect(() => {
    rows.current = authorRows
  }, [authorRows])

  /** Call before the request is sent: remembers the pressed control and whom the action is about. */
  const begin = useCallback((kind: SignUpKind, ids: { postId?: string; optInId?: string }): SignUpAttempt => {
    const optInId = ids.optInId ?? null
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
    }
  }, [])

  /** The request came back without an error: speak and move focus once the outcome is on screen. */
  const succeeded = useCallback((attempt: SignUpAttempt) => {
    awaited.current = attempt
  }, [])

  /** The request failed: say so in the same region. Focus stays on the pressed control. */
  const failed = useCallback(() => {
    awaited.current = null
    announce(cardT(locale, 'statusModerationFailed'))
  }, [announce, locale])

  useEffect(() => {
    const attempt = awaited.current
    if (!attempt || !signUpOutcomeShown(attempt, memberStatuses, authorRows)) return
    awaited.current = null
    announce(signUpNotice(attempt.kind, attempt.name, locale), () => {
      // A control still on the page, or a member who has moved on, keeps the focus.
      if (attempt.pressed?.isConnected || !focusWasLost(attempt.pressed)) return
      signUpFocusTarget(attempt, byTestId, rowAction)?.focus()
    })
  }, [memberStatuses, authorRows, locale, announce])

  return { begin, succeeded, failed }
}
