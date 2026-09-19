// Outside-close guard for DialogContent (W1). Radix separates outside-pointer
// interactions (onPointerDownOutside / onInteractOutside) from the Escape key
// (onEscapeKeyDown), so preventing the default on the former blocks an
// INCIDENTAL outside click from dismissing the dialog — which is what preserves
// an in-progress edit — WITHOUT touching Escape, the Cancel button, or the X
// button, all of which stay intentional close paths.
//
// Extracted as a pure function so the guard's contract is unit-testable in the
// node test env: DialogContent wires the exact handler this returns.

/** Minimal shape of the Radix dismiss events this guard cares about. */
export interface DismissableEvent {
  preventDefault: () => void
}

/**
 * Builds a dismiss handler that, when `disable` is true, calls preventDefault()
 * so Radix does NOT dismiss on an outside interaction (keeping the dialog open
 * and its form state intact). Any caller-supplied handler runs first, so
 * existing behavior is preserved. When `disable` is falsy the returned handler
 * only forwards to the caller handler and lets the default dismiss proceed.
 */
export function guardOutsideClose<E extends DismissableEvent>(
  disable: boolean | undefined,
  userHandler?: (e: E) => void,
): (e: E) => void {
  return (e: E) => {
    userHandler?.(e)
    if (disable) e.preventDefault()
  }
}
