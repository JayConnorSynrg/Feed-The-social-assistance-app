import { describe, expect, it, vi } from 'vitest'
import { guardOutsideClose } from './dialog-guards'

function fakeEvent() {
  return { preventDefault: vi.fn() }
}

describe('guardOutsideClose', () => {
  // W1 core: when the dialog opts into disableOutsideClose, an incidental
  // outside interaction is prevented from dismissing — so the dialog stays open
  // and the in-progress edit (form state) survives.
  // Mutation-proof: removing `if (disable) e.preventDefault()` flips this RED.
  it('prevents the default dismiss when disable is true (edit survives an outside click)', () => {
    const e = fakeEvent()
    guardOutsideClose(true)(e)
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
  })

  // The other direction: an explicit/allowed dismiss path is untouched, so the
  // dialog can still close (and reset) when the guard is off.
  it('does NOT prevent the default when disable is false (dialog may still dismiss)', () => {
    const e = fakeEvent()
    guardOutsideClose(false)(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('does NOT prevent the default when disable is undefined (unchanged global behavior)', () => {
    const e = fakeEvent()
    guardOutsideClose(undefined)(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('always forwards to a caller-supplied handler, guarded or not', () => {
    const userHandler = vi.fn()
    const e1 = fakeEvent()
    guardOutsideClose(true, userHandler)(e1)
    const e2 = fakeEvent()
    guardOutsideClose(false, userHandler)(e2)
    expect(userHandler).toHaveBeenCalledTimes(2)
    expect(userHandler).toHaveBeenCalledWith(e1)
    expect(userHandler).toHaveBeenCalledWith(e2)
  })
})
