// apps/web/src/lib/focus-after-reset.ts
//
// Focus management for a route error boundary's "Try again". reset() re-renders
// the segment and the fallback it was clicked in is unmounted either way: on
// success the content returns, on failure a fresh fallback mounts. After that
// commit, focus moves inside the segment's content container (an element in the
// segment layout, which survives the reset): its first <h1> — the returned
// page's heading, or the new fallback's heading — else the container itself.
// See focusWithin for the temporary-tabindex rule.

import { focusWithin } from './focus-target'

export function retryWithFocus(reset: () => void, contentId: string): void {
  reset()
  requestAnimationFrame(() => {
    focusWithin(document.getElementById(contentId))
  })
}
