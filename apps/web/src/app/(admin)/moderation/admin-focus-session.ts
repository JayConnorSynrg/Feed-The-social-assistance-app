// apps/web/src/app/(admin)/moderation/admin-focus-session.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One followed "Edit in admin" link = one admin.deeplink.resolve row, then the `focus` param is
// dropped (history.replaceState) so a reload does not open the item again. Pure (no React), so the
// exactly-once rule is unit-testable; hooks in use-admin-focus.ts bind it to the browser.
//
// Who writes the row:
//   - the admin tab that OWNS the focus kind (ADMIN_FOCUS_TAB: post / safety_alert -> moderation,
//     event -> events, …) claims it on mount and resolves it: found | not_found, or abandoned when
//     it unmounts first;
//   - the shell (adminFocusGateOutcome) when no tab will take it: invalid (malformed focus, or a
//     focus whose kind this screen never opens or whose ?tab= is not its tab) or forbidden (the
//     viewer's tier does not show the owning tab).
// Exactly one of the two applies to any URL, so a followed link never writes two rows.

import { ADMIN_FOCUS_TAB, type AdminFocusKind } from '@/lib/admin-url'
import { hasAdminFocusParam, readAdminFocus, stripAdminFocusHref, type AdminFocus } from './admin-focus-url'

export type AdminDeeplinkOutcome = 'found' | 'not_found' | 'forbidden' | 'invalid' | 'abandoned'

export interface AdminDeeplinkRow {
  /** The focus kind, or 'unknown' when the focus is malformed. */
  kind: AdminFocusKind | 'unknown'
  outcome: AdminDeeplinkOutcome
  /** The admin tab that took (or would have taken) the focus, or 'unknown'. */
  tab: string
}

/** Where a focus session reads the URL, writes its row and drops the param. */
export interface AdminFocusEnv {
  search: () => string
  emit: (row: AdminDeeplinkRow) => void
  strip: () => void
}

export interface AdminFocusSession {
  readonly focus: AdminFocus
  readonly tab: string
  /** True until the session has written its row. */
  isOpen: () => boolean
  /** Write found / not_found (first call only; false when already settled). */
  resolve: (outcome: 'found' | 'not_found') => boolean
  /** Write abandoned when still open (the tab left before it resolved). */
  abandon: () => boolean
}

function settleOnce(env: AdminFocusEnv, row: () => AdminDeeplinkRow) {
  let open = true
  return {
    isOpen: () => open,
    settle: (outcome: AdminDeeplinkOutcome): boolean => {
      if (!open) return false
      open = false
      env.emit({ ...row(), outcome })
      env.strip()
      return true
    },
  }
}

/**
 * The focus in the URL when it is one of `kinds`, as a session that writes exactly one row; null
 * when there is no focus, it is malformed (the shell reports that), or it names another kind.
 */
export function claimAdminFocus(
  env: AdminFocusEnv,
  kinds: readonly AdminFocusKind[],
  tab: string
): AdminFocusSession | null {
  const focus = readAdminFocus(env.search())
  if (!focus || !kinds.includes(focus.kind)) return null
  const once = settleOnce(env, () => ({ kind: focus.kind, outcome: 'found', tab }))
  return {
    focus,
    tab,
    isOpen: once.isOpen,
    resolve: (outcome) => once.settle(outcome),
    abandon: () => once.settle('abandoned'),
  }
}

export interface AdminFocusGateInput {
  search: string
  /** The tab that opens a focus kind on this screen, or null when this screen never opens it. */
  ownerTab: (kind: AdminFocusKind) => string | null
  /** The tabs this viewer is shown (decided: tier and organization roles loaded). */
  visibleTabs: readonly string[]
}

/**
 * The row the SHELL writes for a focus no tab will take, or null (no focus, or its owning tab is
 * shown and takes it). Call only once the viewer's tabs are decided.
 */
export function adminFocusGateOutcome({ search, ownerTab, visibleTabs }: AdminFocusGateInput): AdminDeeplinkRow | null {
  if (!hasAdminFocusParam(search)) return null
  const requested = new URLSearchParams(search).get('tab')
  const requestedTab = requested !== null && visibleTabs.includes(requested) ? requested : 'unknown'
  const focus = readAdminFocus(search)
  if (!focus) return { kind: 'unknown', outcome: 'invalid', tab: requestedTab }
  const owner = ownerTab(focus.kind)
  if (owner === null || requested !== owner) return { kind: focus.kind, outcome: 'invalid', tab: requestedTab }
  if (!visibleTabs.includes(owner)) return { kind: focus.kind, outcome: 'forbidden', tab: owner }
  return null
}

/** The main admin shell (/moderation): each kind opens on its ADMIN_FOCUS_TAB. */
export function shellOwnerTab(kind: AdminFocusKind): string {
  return ADMIN_FOCUS_TAB[kind]
}

/** The organization admin page (/moderation/org/<id>): only events, on its Events tab. */
export function orgPageOwnerTab(kind: AdminFocusKind): string | null {
  return kind === 'event' ? 'events' : null
}

/** Write the shell's row when it has one (then drop the param). Returns the row written, or null. */
export function runAdminFocusGate(env: AdminFocusEnv, input: Omit<AdminFocusGateInput, 'search'>): AdminDeeplinkRow | null {
  const row = adminFocusGateOutcome({ ...input, search: env.search() })
  if (!row) return null
  env.emit(row)
  env.strip()
  return row
}

/** The browser binding: window.location, history.replaceState, and the persisted row. */
export function browserAdminFocusEnv(emit: (row: AdminDeeplinkRow) => void): AdminFocusEnv {
  return {
    search: () => window.location.search,
    emit,
    strip: () => window.history.replaceState(window.history.state, '', stripAdminFocusHref(window.location)),
  }
}
