// composer-guards.ts
//
// Pure guards for the inline feed composer (W1.2 review round). JSX-free so the
// double-submit and success-gate semantics are unit-testable directly.

export interface SingleFlight {
  /**
   * Runs `fn` unless a run is already in flight. A concurrent call (e.g. a
   * synchronous double-click) returns undefined WITHOUT running `fn`. The
   * in-flight flag is set synchronously before the first await, so two
   * back-to-back invocations execute `fn` exactly once — a React `disabled`
   * prop or state flag cannot guarantee this (both handlers run before the
   * re-render).
   */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>
}

/** Create a single-flight gate. One instance per composer (held in a ref). */
export function createSingleFlight(): SingleFlight {
  let inFlight = false
  return {
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (inFlight) return undefined
      inFlight = true
      try {
        return await fn()
      } finally {
        inFlight = false
      }
    },
  }
}

export const COMPOSER_POST_FAILED_MESSAGE = 'Could not share your post. Please try again.'

export interface ComposerSubmitOutcome {
  /** Clear the composer (content + photo picker) — success only. */
  reset: boolean
  /** Error to surface, or null on success. */
  error: string | null
}

/**
 * Decide the composer's post-submit action from the create result. handleCreatePost
 * swallows its error and returns null on failure, so a null id means the INSERT
 * failed: KEEP the user's content, surface an error, and do NOT reset — letting
 * them retry. A non-null id is success → reset. (The just-uploaded blob is left
 * as-is on failure; account-deletion cleanup reclaims any orphan.)
 */
export function composerSubmitOutcome(newPostId: string | null): ComposerSubmitOutcome {
  return newPostId
    ? { reset: true, error: null }
    : { reset: false, error: COMPOSER_POST_FAILED_MESSAGE }
}
