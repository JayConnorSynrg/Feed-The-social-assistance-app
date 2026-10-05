// apps/web/src/components/org-form/org-a11y-wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Static a11y wiring of the organization screens that the node test environment cannot render:
// every element that sets dir from the viewer locale also sets lang, the pin map offers a keyboard
// placement path, and the directory/panel focus hand-offs stay wired.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')
const FILES = [
  'components/org-form/org-form-panel.tsx',
  'components/org-form/resource-directory.tsx',
  'app/(admin)/moderation/orgs-section.tsx',
  'app/(admin)/moderation/overview-tab.tsx',
  'components/panels/organizations-panel.tsx',
]

/** Every JSX opening tag (up to its closing `>`) that contains dir={dir(...)}. */
function tagsWithDir(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/dir=\{dir\(/g)) {
    const start = src.lastIndexOf('<', m.index)
    let depth = 0
    let i = start
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
      else if (src[i] === '>' && depth === 0) break
    }
    out.push(src.slice(start, i + 1))
  }
  return out
}

describe('org screens a11y wiring', () => {
  it('every dir={dir(locale)} element also sets lang', () => {
    let seen = 0
    for (const f of FILES) {
      for (const tag of tagsWithDir(read(f))) {
        seen++
        expect(tag, f).toMatch(/\blang=\{/)
      }
    }
    expect(seen).toBeGreaterThanOrEqual(7)
  })

  it('the pin map can be placed without a pointer (map center button)', () => {
    const src = read('components/org-form/org-pin-map.tsx')
    expect(src).toMatch(/mapRef\.current\?\.getCenter\(\)/)
    expect(src).toMatch(/onClick=\{placeAtCenter\}/)
    expect(read('components/org-form/org-form-panel.tsx')).toMatch(/placeCenterLabel=\{tr\('locPlaceCenter'\)\}/)
  })

  it('directory view: search takes focus on entry; Browse directory gets it back on exit', () => {
    const panel = read('components/org-form/org-form-panel.tsx')
    expect(panel).toMatch(/<ResourceDirectory[\s\S]*?autoFocusSearch/)
    expect(panel).toMatch(/browseRef\.current\?\.focus\(\)/)
    expect(read('components/org-form/resource-directory.tsx')).toMatch(/if \(autoFocusSearch\) searchRef\.current\?\.focus\(\)/)
  })

  it('Deactivate/Reactivate dialog returns focus to the row More button', () => {
    const list = read('app/(admin)/moderation/orgs-section.tsx')
    expect(list).toMatch(/id=\{moreButtonId\(org\.id\)\}/)
    expect(list).toMatch(/document\.getElementById\(moreButtonId\(confirm\.org\.id\)\)\?\.focus\(\)/)
  })
})
