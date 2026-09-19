// Tiny pure debounce runner used by AddressAutocomplete (address-autocomplete.tsx).
// Extracted so the "a selection cancels the pending search, but a later keystroke
// still schedules a fresh one" behavior is unit-testable with fake timers in the
// node test env — the component owns one of these and calls schedule()/cancel()
// exactly where it previously inlined setTimeout/clearTimeout.

export interface DebouncedRunner {
  /** Schedule `run` to fire after the delay, replacing any pending run. */
  schedule: (run: () => void) => void
  /** Cancel any pending run so nothing fires until the next schedule(). Calling
   *  this does NOT disable the runner — a subsequent schedule() works normally. */
  cancel: () => void
}

export function createDebouncedRunner(delayMs: number): DebouncedRunner {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    schedule(run: () => void) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        run()
      }, delayMs)
    },
    cancel() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
