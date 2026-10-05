// focus-after-reset.test.ts — where focus lands after an error boundary's "Try again".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryWithFocus } from './focus-after-reset'

type FakeEl = {
  isConnected: boolean
  attrs: Map<string, string>
  focused: number
  blurHandlers: Array<() => void>
  focus: () => void
  hasAttribute: (k: string) => boolean
  setAttribute: (k: string, v: string) => void
  removeAttribute: (k: string) => void
  addEventListener: (t: string, h: () => void) => void
}
function el(connected = true): FakeEl {
  const e: FakeEl = {
    isConnected: connected,
    attrs: new Map(),
    focused: 0,
    blurHandlers: [],
    focus: () => { e.focused++ },
    hasAttribute: (k) => e.attrs.has(k),
    setAttribute: (k, v) => { e.attrs.set(k, v) },
    removeAttribute: (k) => { e.attrs.delete(k) },
    addEventListener: (t, h) => { if (t === 'blur') e.blurHandlers.push(h) },
  }
  return e
}

let container: FakeEl
beforeEach(() => {
  container = el()
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { cb(); return 1 })
  vi.stubGlobal('document', { getElementById: (id: string) => (id === 'app-content' ? container : null) })
})
afterEach(() => vi.unstubAllGlobals())

describe('retryWithFocus', () => {
  it('successful reset: focus moves to the content container via a temporary tabindex', () => {
    const reset = vi.fn()
    const heading = el(false) // fallback unmounted by the successful reset
    retryWithFocus(reset, heading as unknown as HTMLElement, 'app-content')
    expect(reset).toHaveBeenCalledTimes(1)
    expect(container.focused).toBe(1)
    expect(container.attrs.get('tabindex')).toBe('-1')
    container.blurHandlers.forEach((h) => h())
    expect(container.attrs.has('tabindex')).toBe(false) // never a permanent tab/click target
  })

  it('failed reset: focus returns to the still-mounted fallback heading', () => {
    const heading = el(true)
    retryWithFocus(vi.fn(), heading as unknown as HTMLElement, 'app-content')
    expect(heading.focused).toBe(1)
    expect(container.focused).toBe(0)
  })
})
