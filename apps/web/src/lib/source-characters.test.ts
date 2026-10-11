// apps/web/src/lib/source-characters.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// No source file holds a raw invisible character — in the web app's source (apps/web/src), its
// end-to-end specs (apps/web/e2e), its scripts (apps/web/scripts) and the edge functions
// (supabase/functions). Each one is written as a \u escape, so a reader, a reviewer and a
// scanner all see what the line does:
//   - the bidirectional controls U+2066–U+2069 (isolates) and U+202A–U+202E (embeddings,
//     overrides), which can reorder the code a reviewer reads;
//   - the invisible spaces and marks Intl output carries, which five lines held raw inside a
//     regex character class until 2026-10-11: U+00A0, U+202F, U+2009, U+200E, U+200F, U+061C.
// The zero-width joiner (U+200D) stays allowed: it is part of emoji and Arabic text.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
/** Every tree the check walks, as a path from the repository root. */
const TREES = ['apps/web/src', 'apps/web/e2e', 'apps/web/scripts', 'supabase/functions']
const BIDI_CONTROLS = /[\u2066-\u2069\u202a-\u202e]/
const INVISIBLE = /[\u2066-\u2069\u202a-\u202e\u00a0\u202f\u2009\u200e\u200f\u061c]/g

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.(ts|tsx|mjs|js|css)$/.test(name)) out.push(path)
  }
  return out
}

const codePoint = (c: string) => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`

/** Every raw invisible character in a text, as "line N: U+XXXX". */
export function rawInvisibles(text: string): string[] {
  return text.split('\n').flatMap((line, i) => [...new Set(line.match(INVISIBLE) ?? [])].map((c) => `line ${i + 1}: ${codePoint(c)}`))
}

describe('source files hold no raw invisible character', () => {
  const files = TREES.flatMap((tree) => sourceFiles(join(REPO, tree)))
  const rel = (f: string) => relative(REPO, f)

  it('reads the four trees', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(500)
    const listed = files.map(rel)
    expect(listed).toContain('apps/web/src/lib/i18n-intl.ts')
    // One known file from each of the other three, so a moved or emptied tree is noticed.
    expect(listed).toContain('apps/web/e2e/opt-in-flow.spec.ts')
    expect(listed).toContain('supabase/functions/post-image-upload/index.ts')
    expect(listed.some((f) => f.startsWith('apps/web/scripts/'))).toBe(true)
    for (const tree of TREES) expect(listed.filter((f) => f.startsWith(`${tree}/`)).length, tree).toBeGreaterThan(0)
  })

  it('no bidirectional control (U+2066–U+2069, U+202A–U+202E) and no invisible space or mark: write \\u escapes', () => {
    const hits = files.flatMap((f) => rawInvisibles(readFileSync(f, 'utf8')).map((hit) => `${rel(f)} ${hit}`))
    expect(hits).toEqual([])
  })

  it('the check sees each character it names, and passes the escape and the zero-width joiner', () => {
    for (const code of [0x2066, 0x2067, 0x2068, 0x2069, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x00a0, 0x202f, 0x2009, 0x200e, 0x200f, 0x061c]) {
      const c = String.fromCharCode(code)
      expect(rawInvisibles(`ok\nconst x = '${c}'`), codePoint(c)).toEqual([`line 2: ${codePoint(c)}`])
    }
    for (const code of [0x2066, 0x2067, 0x2068, 0x2069, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e]) {
      expect(BIDI_CONTROLS.test(String.fromCharCode(code)), codePoint(String.fromCharCode(code))).toBe(true)
    }
    expect(rawInvisibles("s.replace(/[\\u00a0\\u202f]/g, ' ')")).toEqual([])
    expect(rawInvisibles(`a${String.fromCharCode(0x200d)}b`)).toEqual([])
  })
})
