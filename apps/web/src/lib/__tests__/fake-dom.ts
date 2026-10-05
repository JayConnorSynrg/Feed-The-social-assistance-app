// Minimal fake elements for focus tests (no DOM renderer in this repo).
export type FakeEl = {
  name: string
  isConnected: boolean
  parentElement: FakeEl | null
  attrs: Map<string, string>
  focusCalls: Array<FocusOptions | undefined>
  h1: FakeEl | null
  blurHandlers: Array<() => void>
  focus: (opts?: FocusOptions) => void
  hasAttribute: (k: string) => boolean
  setAttribute: (k: string, v: string) => void
  removeAttribute: (k: string) => void
  addEventListener: (t: string, h: () => void) => void
  querySelector: (sel: string) => FakeEl | null
}

/**
 * `takesFocus` (default true): focus() makes the element document.activeElement
 * when a document is stubbed; false models an element focus cannot land on.
 */
export function fakeEl(
  name: string,
  opts: { connected?: boolean; tabindex?: string; h1?: FakeEl | null; takesFocus?: boolean } = {}
): FakeEl {
  const e: FakeEl = {
    name,
    isConnected: opts.connected ?? true,
    parentElement: null,
    attrs: new Map(opts.tabindex !== undefined ? [['tabindex', opts.tabindex]] : []),
    focusCalls: [],
    h1: opts.h1 ?? null,
    blurHandlers: [],
    focus: (o) => {
      e.focusCalls.push(o)
      const doc = (globalThis as { document?: { activeElement?: unknown } }).document
      if (doc && opts.takesFocus !== false) doc.activeElement = e
    },
    hasAttribute: (k) => e.attrs.has(k),
    setAttribute: (k, v) => { e.attrs.set(k, v) },
    removeAttribute: (k) => { e.attrs.delete(k) },
    addEventListener: (t, h) => { if (t === 'blur') e.blurHandlers.push(h) },
    querySelector: (sel) => (sel === 'h1' ? e.h1 : null),
  }
  return e
}

export const asEl = (e: FakeEl | null) => e as unknown as HTMLElement
