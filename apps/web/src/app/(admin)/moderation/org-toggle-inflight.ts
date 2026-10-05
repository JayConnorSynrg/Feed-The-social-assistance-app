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
