// focus-after-reset.test.ts — where focus lands after a route error page's "Try again".
// Models the real sequence: reset() unmounts the fallback; after the commit the
// content container holds either the returned page or a freshly mounted fallback.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryWithFocus } from './focus-after-reset'
import { fakeEl, type FakeEl } from './__tests__/fake-dom'

let container: FakeEl
let frames: Array<() => void>
beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length })
  vi.stubGlobal('document', { getElementById: (id: string) => (id === 'app-content' ? container : null) })
})
afterEach(() => vi.unstubAllGlobals())

describe('retryWithFocus', () => {
  it('successful retry: focus lands on the returned page heading', () => {
    const pageH1 = fakeEl('page-h1')
    container = fakeEl('container')
    const reset = vi.fn(() => { container.h1 = pageH1 }) // commit: page content back
    retryWithFocus(reset, 'app-content')
    expect(reset).toHaveBeenCalledTimes(1)
    frames.forEach((f) => f())
    expect(pageH1.focusCalls).toHaveLength(1)
    expect(container.focusCalls).toHaveLength(0)
  })

  it('failed retry: the old heading is gone; focus lands on the remounted fallback heading', () => {
    const oldHeading = fakeEl('old-h1', { tabindex: '-1' })
    container = fakeEl('container', { h1: oldHeading })
    const newHeading = fakeEl('new-h1', { tabindex: '-1' })
    retryWithFocus(() => {
      oldHeading.isConnected = false // remount disconnects the captured heading
      container.h1 = newHeading
    }, 'app-content')
    frames.forEach((f) => f())
    expect(newHeading.focusCalls).toHaveLength(1)
    expect(oldHeading.focusCalls).toHaveLength(0)
  })

  it('page without an h1: the container itself, via a temporary tabindex, without scrolling', () => {
    container = fakeEl('container')
    retryWithFocus(() => {}, 'app-content')
    frames.forEach((f) => f())
    expect(container.focusCalls).toEqual([{ preventScroll: true }])
    expect(container.attrs.get('tabindex')).toBe('-1')
  })
})
