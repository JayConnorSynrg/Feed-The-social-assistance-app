// apps/web/src/components/ui/dialog.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The shared dialog's default close button: its screen-reader name is the caller's translated
// label when one is given, otherwise the English "Close" marked lang="en" (so a dialog in another
// language does not mislabel it), and it sits at the inline end (the left in a right-to-left
// dialog). Read from DialogContent's own render output: a Radix portal renders nothing in the
// node test environment.

import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { DialogContent, DialogHeader } from './dialog'

type El = { type: unknown; props: Record<string, unknown> }
type Renderable = { render: (props: Record<string, unknown>, ref: null) => ReactElement }

function closeButton(props: Record<string, unknown>) {
  const tree = (DialogContent as unknown as Renderable).render({ children: null, ...props }, null)
  const found: El[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isValidElement(node)) return
    const el = node as unknown as El
    if (typeof el.props.className === 'string' && el.props.className.includes('sr-only')) found.push(el)
    walk(el.props.children)
  }
  walk(tree)
  // The sr-only label and the button around it.
  const buttons: El[] = []
  const find = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(find)
    if (!isValidElement(node)) return
    const el = node as unknown as El
    if (typeof el.props.className === 'string' && el.props.className.includes('top-4')) buttons.push(el)
    find(el.props.children)
  }
  find(tree)
  return { label: found[0], button: buttons[0], count: found.length }
}

describe('DialogContent default close button', () => {
  it('with no label: English "Close", marked lang="en"', () => {
    const { label, count } = closeButton({})
    expect(count).toBe(1)
    expect(label.props.children).toBe('Close')
    expect(label.props.lang).toBe('en')
  })

  it("with a translated label: the caller's text, and no English mark", () => {
    const { label } = closeButton({ closeLabel: 'Cerrar' })
    expect(label.props.children).toBe('Cerrar')
    expect(label.props.lang).toBeUndefined()
  })

  it('sits at the inline end, not a fixed right edge', () => {
    const { button } = closeButton({})
    expect(button.props.className).toMatch(/\bend-4\b/)
    expect(button.props.className).not.toMatch(/\bright-4\b/)
  })

  it('an empty label never leaves the button unnamed: it falls back to English "Close", marked lang="en"', () => {
    const { label } = closeButton({ closeLabel: '' })
    expect(label.props.children).toBe('Close')
    expect(label.props.lang).toBe('en')
  })

  it('closeLabel is not passed down to the DOM element', () => {
    const tree = (DialogContent as unknown as Renderable).render({ children: null, closeLabel: 'Cerrar' }, null)
    const seen: string[] = []
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!isValidElement(node)) return
      const el = node as unknown as El
      seen.push(...Object.keys(el.props))
      walk(el.props.children)
    }
    walk(tree)
    expect(seen).not.toContain('closeLabel')
  })

  it('hideDefaultClose still removes it', () => {
    expect(closeButton({ hideDefaultClose: true }).count).toBe(0)
  })
})

describe('DialogHeader', () => {
  it('aligns its title to the reading start, so in a right-to-left dialog it does not sit under the close button', () => {
    const el = DialogHeader({}) as unknown as El
    expect(el.props.className).toMatch(/\bsm:text-start\b/)
    expect(el.props.className).not.toMatch(/\bsm:text-left\b/)
  })

  it('a caller class still wins', () => {
    const el = DialogHeader({ className: 'flex-row' }) as unknown as El
    expect(el.props.className).toContain('flex-row')
  })
})
