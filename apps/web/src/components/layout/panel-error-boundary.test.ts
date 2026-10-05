// panel-error-boundary.test.ts — focus placement of the panel fallback, exercised
// on the class itself (no DOM renderer in this repo).
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { PanelErrorBoundary } from './panel-error-boundary'
import { fakeEl, asEl } from '@/lib/__tests__/fake-dom'

function boundary(hasError: boolean) {
  const b = new PanelErrorBoundary({ children: null })
  b.state = { hasError, error: hasError ? new Error('x') : null }
  return b
}
const setRef = (ref: { current: unknown }, v: unknown) => { (ref as { current: unknown }).current = v }

describe('PanelErrorBoundary focus', () => {
  it('mount with an error already caught: focuses the fallback message', () => {
    const b = boundary(true)
    const msg = fakeEl('msg', { tabindex: '-1' })
    setRef(b.messageRef, asEl(msg))
    b.componentDidMount()
    expect(msg.focusCalls).toHaveLength(1)
  })

  it('mount without an error: focuses nothing', () => {
    const b = boundary(false)
    const msg = fakeEl('msg')
    setRef(b.messageRef, asEl(msg))
    b.componentDidMount()
    expect(msg.focusCalls).toHaveLength(0)
  })

  it('error caught on update (no error -> error): focuses the fallback message', () => {
    const b = boundary(true)
    const msg = fakeEl('msg', { tabindex: '-1' })
    setRef(b.messageRef, asEl(msg))
    b.componentDidUpdate({ children: null }, { hasError: false, error: null })
    expect(msg.focusCalls).toHaveLength(1)
  })

  it('update while already showing the error: does not re-focus', () => {
    const b = boundary(true)
    const msg = fakeEl('msg', { tabindex: '-1' })
    setRef(b.messageRef, asEl(msg))
    b.componentDidUpdate({ children: null }, { hasError: true, error: new Error('x') })
    expect(msg.focusCalls).toHaveLength(0)
  })

  it('retry succeeds: message gone, focus goes to the returned panel h1', () => {
    const b = boundary(true)
    const panelH1 = fakeEl('panel-h1')
    const host = fakeEl('host', { h1: panelH1 })
    const fallback = fakeEl('fallback')
    fallback.parentElement = host
    setRef(b.fallbackRef, asEl(fallback))
    b.setState = ((_s: unknown, cb?: () => void) => {
      setRef(b.messageRef, null) // fallback unmounted, children back
      cb?.()
    }) as typeof b.setState
    b.retry()
    expect(panelH1.focusCalls).toHaveLength(1)
  })

  it('retry fails: focus goes to the re-shown message, not the panel host', () => {
    const b = boundary(true)
    const host = fakeEl('host', { h1: fakeEl('h1') })
    const fallback = fakeEl('fallback')
    fallback.parentElement = host
    setRef(b.fallbackRef, asEl(fallback))
    const reshown = fakeEl('msg', { tabindex: '-1' })
    b.setState = ((_s: unknown, cb?: () => void) => {
      setRef(b.messageRef, asEl(reshown)) // children threw again; fallback re-rendered
      cb?.()
    }) as typeof b.setState
    b.retry()
    expect(reshown.focusCalls).toHaveLength(1)
    expect(host.h1!.focusCalls).toHaveLength(0)
  })
})
