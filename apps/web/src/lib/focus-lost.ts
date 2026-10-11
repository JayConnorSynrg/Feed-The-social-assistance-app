// apps/web/src/lib/focus-lost.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Was focus actually lost?" — the question asked before focus is moved for a member after the
// control they pressed has left the page. A browser puts focus on the page body when the focused
// element is removed. A member who tabbed somewhere else while a request was running still has
// focus on a live control: they keep their place, and nothing is moved.

/**
 * True when focus has nowhere to be: on the page body, on nothing, on an element no longer in the
 * page, or still on the removed control itself. With no document (a server render) it is true.
 */
export function focusWasLost(removed: Element | null, doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return true
  const active = doc.activeElement
  return active === null || active === doc.body || active === removed || active.isConnected === false
}
