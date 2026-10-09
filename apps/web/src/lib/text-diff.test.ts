// text-diff.test.ts — the word diff the edit history and the edit-conflict comparison show.
import { describe, it, expect } from 'vitest'
import { diffWords, hasChanges, tokenize } from './text-diff'

const join = (parts: ReturnType<typeof diffWords>, keep: 'before' | 'after') =>
  parts.filter((p) => p.kind === 'same' || p.kind === (keep === 'before' ? 'removed' : 'added')).map((p) => p.text).join('')

describe('diffWords', () => {
  it('identical text is one unchanged part', () => {
    expect(diffWords('Free bread at 5', 'Free bread at 5')).toEqual([{ kind: 'same', text: 'Free bread at 5' }])
    expect(hasChanges(diffWords('a b', 'a b'))).toBe(false)
  })

  it('a changed word reads as removed then added, the rest unchanged', () => {
    expect(diffWords('Free bread at 5pm', 'Free soup at 5pm')).toEqual([
      { kind: 'same', text: 'Free ' },
      { kind: 'removed', text: 'bread' },
      { kind: 'added', text: 'soup' },
      { kind: 'same', text: ' at 5pm' },
    ])
  })

  it('pure insertion and pure deletion', () => {
    expect(diffWords('Pantry open', 'Pantry open today')).toEqual([
      { kind: 'same', text: 'Pantry open' },
      { kind: 'added', text: ' today' },
    ])
    expect(diffWords('Pantry open today', 'Pantry today')).toEqual([
      { kind: 'same', text: 'Pantry ' },
      { kind: 'removed', text: 'open ' },
      { kind: 'same', text: 'today' },
    ])
  })

  it('round-trips both texts exactly (whitespace, line breaks, unicode, RTL)', () => {
    const cases: Array<[string, string]> = [
      ['line one\nline two', 'line one\n\nline three'],
      ['Comida gratis 🍞 hoy', 'Comida gratis 🍞 mañana'],
      ['خبز مجاني اليوم', 'خبز مجاني غدا'],
      ['', 'new text'],
      ['old text', ''],
    ]
    for (const [a, b] of cases) {
      const parts = diffWords(a, b)
      expect(join(parts, 'before')).toBe(a)
      expect(join(parts, 'after')).toBe(b)
    }
  })

  it('tokenize keeps whitespace runs so joining gives the input back', () => {
    expect(tokenize('a  b\tc')).toEqual(['a', '  ', 'b', '\t', 'c'])
  })
})
