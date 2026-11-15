// apps/web/src/app/(admin)/moderation/row-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Where keyboard focus goes when an action takes a row out of an admin list (approve, reject,
// remove a member): chosen BEFORE the row leaves, applied once the list has re-rendered, so focus
// never falls to <body>. The next row when there is one, else the previous row, else the list's
// heading (null). Each list passes its rows' ids in display order.

/** The id of the row to focus after `removedId` leaves `ids`; null means the list's heading. */
export function focusAfterRowRemoval(ids: readonly string[], removedId: string): string | null {
  const at = ids.indexOf(removedId)
  if (at === -1) return null
  return ids[at + 1] ?? ids[at - 1] ?? null
}

/** Run `fn` after the browser has laid out the changed list (a timer where there is no frame loop). */
export function afterLayout(fn: () => void): void {
  const nextFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: () => void) => setTimeout(f, 0)
  nextFrame(fn)
}
