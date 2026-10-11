// apps/web/src/components/ui/sheet.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The shared sheet's default close button, with the same contract as the dialog's
// (dialog.test.ts): its screen-reader name is the caller's translated label when one is given,
// otherwise the English "Close" marked lang="en"; it sits at the inline end. And, across the
// member app: every dialog or sheet that carries the viewer's language either names its default
// close button in that language or renders its own.

import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SheetContent } from './sheet'

type El = { type: unknown; props: Record<string, unknown> }
type Renderable = { render: (props: Record<string, unknown>, ref: null) => ReactElement }

function all(tree: unknown, pred: (el: El) => boolean): El[] {
  const out: El[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isValidElement(node)) return
    const el = node as unknown as El
    if (pred(el)) out.push(el)
    walk(el.props.children)
  }
  walk(tree)
  return out
}
const hasClass = (el: El, name: string) => typeof el.props.className === 'string' && el.props.className.split(/\s+/).includes(name)
const render = (props: Record<string, unknown>) => (SheetContent as unknown as Renderable).render({ children: null, ...props }, null)

describe('SheetContent default close button', () => {
  it('with no label: English "Close", marked lang="en"', () => {
    const labels = all(render({}), (el) => hasClass(el, 'sr-only'))
    expect(labels).toHaveLength(1)
    expect(labels[0].props.children).toBe('Close')
    expect(labels[0].props.lang).toBe('en')
  })

  it("with a translated label: the caller's text, and no English mark", () => {
    const [label] = all(render({ closeLabel: 'Fèmen' }), (el) => hasClass(el, 'sr-only'))
    expect(label.props.children).toBe('Fèmen')
    expect(label.props.lang).toBeUndefined()
  })

  it('an empty label never leaves the button unnamed', () => {
    const [label] = all(render({ closeLabel: '' }), (el) => hasClass(el, 'sr-only'))
    expect(label.props.children).toBe('Close')
    expect(label.props.lang).toBe('en')
  })

  it('sits at the inline end, not a fixed right edge; its icon is hidden from assistive tech', () => {
    const [button] = all(render({}), (el) => hasClass(el, 'top-3'))
    expect(hasClass(button, 'end-3')).toBe(true)
    expect(String(button.props.className)).not.toMatch(/\bright-\d/)
    expect(all(button, (el) => el.props['aria-hidden'] === 'true')).toHaveLength(1)
  })

  it('is a 24px target (a 16px icon with 4px of padding) and keeps a focus outline in forced-colors mode', () => {
    for (const props of [{}, { closeLabel: 'Cerrar' }]) {
      const [button] = all(render(props), (el) => hasClass(el, 'top-3'))
      expect(hasClass(button, 'p-1')).toBe(true)
      expect(hasClass(button, 'focus:outline-hidden')).toBe(true)
      expect(hasClass(button, 'focus:outline-none')).toBe(false)
      expect(hasClass(button, 'focus:ring-2')).toBe(true)
      const [icon] = all(button, (el) => el.props['aria-hidden'] === 'true')
      expect(icon.props.className).toBe('h-4 w-4')
    }
  })

  it('closeLabel is not passed down to the DOM element; hideDefaultClose still removes the button', () => {
    const seen = all(render({ closeLabel: 'Cerrar' }), () => true).flatMap((el) => Object.keys(el.props))
    expect(seen).not.toContain('closeLabel')
    expect(all(render({ hideDefaultClose: true }), (el) => hasClass(el, 'sr-only'))).toHaveLength(0)
  })
})

describe('every dialog and sheet in the viewer language names its close button in that language', () => {
  const SRC = fileURLToPath(new URL('../..', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.endsWith('.tsx')) files.push(path)
    }
  }
  walk(SRC)
  /** The opening tag that starts at `from`: up to the first ">" outside every {…} (an arrow
   *  function inside a prop does not end it). */
  function openingTag(source: string, from: number): string {
    let depth = 0
    for (let i = from; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      else if (source[i] === '>' && depth === 0) return source.slice(from, i + 1)
    }
    return source.slice(from)
  }
  /** Each opening <DialogContent …> / <SheetContent …> tag in the source tree. */
  const tags = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/<(DialogContent|SheetContent)\b/g)].map((m) => ({ file: relative(SRC, file), kind: m[1], tag: openingTag(source, m.index) }))
  })
  const translated = tags.filter((t) => /\blang=\{locale\}/.test(t.tag))

  it('finds the dialogs and sheets, each tag whole', () => {
    expect(tags.length).toBeGreaterThanOrEqual(20)
    for (const t of tags) expect(t.tag.endsWith('>') && !t.tag.endsWith('=>'), `${t.file}: ${t.tag.slice(0, 60)}`).toBe(true)
    expect(openingTag('<SheetContent onX={(e) => { go(e) }} lang={locale}>rest', 0)).toBe('<SheetContent onX={(e) => { go(e) }} lang={locale}>')
    expect(translated.map((t) => t.file)).toEqual(
      expect.arrayContaining(['components/feed/post-edit-dialog.tsx', 'components/feed/post-history-dialog.tsx', 'components/feed/report-dialog.tsx', 'components/panels/feed-panel.tsx', 'components/panels/messages-panel.tsx']),
    )
  })

  it('a translated one passes closeLabel from a dictionary, or hides the default close and renders its own', () => {
    const unnamed = translated.filter((t) => !/\bhideDefaultClose\b/.test(t.tag) && !/\bcloseLabel=\{\w+T\(locale, '\w+'\)\}/.test(t.tag))
    expect(unnamed.map((t) => `${t.file} <${t.kind}>`)).toEqual([])
  })

  it('one that keeps the English default carries no member-language mark (the default says lang="en" itself)', () => {
    for (const t of tags.filter((x) => !/\bhideDefaultClose\b/.test(x.tag) && !/\bcloseLabel=/.test(x.tag))) {
      expect(t.tag, t.file).not.toMatch(/\blang=\{locale\}/)
    }
  })
})
