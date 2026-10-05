// apps/web/src/lib/focus-target.ts
//
// One rule for "where does focus go after a fallback appears or disappears":
//   1. `preferred`, when it is still in the document (e.g. a re-shown error
//      message that already has tabIndex={-1});
//   2. otherwise the first <h1> inside `host` (the content that came back);
//   3. otherwise `host` itself.
// A target without a tabindex gets a temporary tabindex="-1" — a heading or a
// container is not focusable otherwise — removed again on blur, so it never
// becomes a permanent Tab or click target. Scrolling is suppressed only when the
// whole container is the target. Returns the element focused, or null.

export function focusWithin(host: HTMLElement | null | undefined, preferred?: HTMLElement | null): HTMLElement | null {
  if (preferred?.isConnected) {
    preferred.focus()
    return preferred
  }
  if (!host?.isConnected) return null
  const target = host.querySelector<HTMLElement>('h1') ?? host
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1')
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
  }
  if (target === host) target.focus({ preventScroll: true })
  else target.focus()
  return target
}
