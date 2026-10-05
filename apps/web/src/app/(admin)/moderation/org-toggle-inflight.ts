// apps/web/src/app/(admin)/moderation/org-toggle-inflight.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Which organizations have a Deactivate/Reactivate call in flight. Several toggles can run at
// once; finishing one must leave the others busy (a single "busy id" re-enabled B's More button
// while B's call was still running).

export function startToggle(inFlight: ReadonlySet<string>, orgId: string): Set<string> {
  const next = new Set(inFlight)
  next.add(orgId)
  return next
}

export function finishToggle(inFlight: ReadonlySet<string>, orgId: string): Set<string> {
  const next = new Set(inFlight)
  next.delete(orgId)
  return next
}

const OPEN_KEYS = new Set(['Enter', ' ', 'ArrowDown'])

/**
 * Busy guard for a row's More menu trigger: while that row's toggle is in flight the trigger stays
 * focusable (aria-disabled) but a pointer-down or an opening key does not open the menu. Calling
 * preventDefault stops Radix's own trigger handler (composeEventHandlers skips it).
 */
export function guardBusyTrigger(
  busyIds: ReadonlySet<string>,
  orgId: string,
  event: { preventDefault: () => void; key?: string }
): boolean {
  if (!busyIds.has(orgId)) return false
  if (event.key !== undefined && !OPEN_KEYS.has(event.key)) return false
  event.preventDefault()
  return true
}
