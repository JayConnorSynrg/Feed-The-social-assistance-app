// apps/web/src/lib/focus-after-reset.ts
//
// Focus management for a route error boundary's "Try again". reset() re-renders
// the segment; when that succeeds the fallback (and the focused heading inside
// it) unmounts and focus would otherwise fall to <body>. After the re-render
// commits this moves focus to the segment's content container — an element in
// the segment layout, which survives the reset — with a temporary tabindex="-1"
// that is removed again on blur, so the container is never a permanent click or
// tab target. If the fallback is still mounted (the retry failed), focus returns
// to its heading.

export function retryWithFocus(
  reset: () => void,
  fallbackHeading: HTMLElement | null,
  contentId: string
): void {
  reset()
  requestAnimationFrame(() => {
    if (fallbackHeading?.isConnected) {
      fallbackHeading.focus()
      return
    }
    const container = document.getElementById(contentId)
    if (!container) return
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
      container.addEventListener('blur', () => container.removeAttribute('tabindex'), { once: true })
    }
    container.focus({ preventScroll: true })
  })
}
