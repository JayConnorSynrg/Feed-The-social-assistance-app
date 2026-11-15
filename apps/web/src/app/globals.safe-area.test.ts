// globals.safe-area.test.ts — `safe-area-pb` is a real Tailwind v4 utility: defined once in
// globals.css as padding-bottom: env(safe-area-inset-bottom), and every class use resolves to it.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('..', import.meta.url))
const css = readFileSync(join(srcDir, 'app/globals.css'), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(name)) out.push(p)
  }
  return out
}

describe('safe-area-pb utility', () => {
  it('is defined exactly once, as an @utility padding the bottom inset', () => {
    const defs = css.match(/@utility\s+safe-area-pb\s*\{([^}]*)\}/g) ?? []
    expect(defs).toHaveLength(1)
    expect(defs[0]).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom\)\s*;/)
    // no competing plain-CSS class definition
    expect(css).not.toMatch(/\.safe-area-pb\s*\{/)
  })

  it('is used by the mobile bottom nav and its spacer, and no other safe-area-* class is used undefined', () => {
    const uses = walk(srcDir).flatMap((f) => (readFileSync(f, 'utf8').match(/(?<=[\"'`\s])safe-area-[a-z]+(?=[\"'`\s])/g) ?? []).map((c) => ({ f, c })))
    expect(uses.filter((u) => u.f.endsWith('feed-shell.tsx') && u.c === 'safe-area-pb')).toHaveLength(2)
    for (const { c } of uses) expect(css).toContain(`@utility ${c}`)
  })
})

describe('focused controls clear the fixed mobile nav', () => {
  it('below md, html scroll-padding-bottom is the nav height plus the inset', () => {
    expect(css).toMatch(/@media \(width < 48rem\)\s*\{\s*html\s*\{\s*scroll-padding-bottom:\s*calc\(5rem \+ env\(safe-area-inset-bottom\)\);/)
  })
})

