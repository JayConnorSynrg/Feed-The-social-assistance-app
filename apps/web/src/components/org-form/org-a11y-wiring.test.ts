// apps/web/src/components/org-form/org-a11y-wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Static a11y wiring of the organization screens that the node test environment cannot render:
// every element that sets dir from the viewer locale also sets lang, the pin map offers a keyboard
// placement path, and the directory/panel focus hand-offs stay wired.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hidePinFromAssistiveTech } from './org-pin-a11y'
import { orgFormMessages } from '@/lib/i18n-org-forms'

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
        // Menu.Root renders no element; its dir reaches the portaled Menu.Content (checked below).
        if (tag.startsWith('<Menu.Root')) continue
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
  it('the portaled row menu sets lang and inherits dir from Menu.Root', () => {
    const list = read('app/(admin)/moderation/orgs-section.tsx')
    expect(list).toMatch(/<Menu\.Root dir=\{dir\(locale\)\}>/)
    expect(list).toMatch(/<Menu\.Content\s+lang=\{locale\}/)
  })

  it('the English-only member roster is marked lang="en"', () => {
    expect(read('app/(admin)/moderation/orgs-section.tsx')).toMatch(/<div lang="en"( dir="ltr")? className="rounded-xl border/)
  })

  it('the pin map shows its instructions, describes itself with them, and translates Mapbox controls', () => {
    const map = read('components/org-form/org-pin-map.tsx')
    expect(map).toMatch(/<p id=\{instructionsId\}[^>]*>\s*\{instructions\}/)
    expect(map).toMatch(/aria-describedby=\{instructionsId\}/)
    expect(map).toMatch(/focus-within:ring-2 focus-within:ring-brand/)
    expect(map).toMatch(/'NavigationControl\.ZoomIn': mapLocale\.zoomIn/)
    expect(map).toMatch(/'Map\.Title': mapLocale\.title/)
  })
  it('busy buttons dim their colors, not their opacity (the focus ring keeps full contrast)', () => {
    for (const f of [
      'components/org-form/org-form-panel.tsx',
      'components/org-form/resource-directory.tsx',
      'app/(admin)/moderation/orgs-section.tsx',
    ]) {
      expect(read(f), f).not.toMatch(/aria-disabled:opacity-/)
    }
    expect(read('components/org-form/org-form-panel.tsx')).toMatch(/aria-disabled:bg-brand\/60/)
    expect(read('components/org-form/resource-directory.tsx')).toMatch(/aria-disabled:bg-brand\/60/)
  })

  it('every Mapbox control string is translated and the pin is hidden from assistive tech', () => {
    const map = read('components/org-form/org-pin-map.tsx')
    expect(map).toMatch(/'AttributionControl\.ToggleAttribution': mapLocale\.attribution/)
    expect(map).toMatch(/'LogoControl\.Title': mapLocale\.logo/)
    expect(map).toMatch(/<Marker\s+ref=\{hidePinFromAssistiveTech\}/)
    const setAttribute = vi.fn()
    hidePinFromAssistiveTech({ getElement: () => ({ setAttribute }) })
    expect(setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
  })

  it('the English roster is lang="en" dir="ltr", including its portaled role lists', () => {
    const list = read('app/(admin)/moderation/orgs-section.tsx')
    expect(list).toMatch(/<div lang="en" dir="ltr" className="rounded-xl border/)
    const roster = list.slice(list.indexOf('<div lang="en" dir="ltr"'))
    expect(roster.match(/<SelectContent lang="en">/g)).toHaveLength(2)
    expect(roster).not.toMatch(/<SelectContent>/)
  })

  it('Back/Forward keeps the real opener while the panel is already open', () => {
    expect(read('app/(admin)/moderation/admin-shell.tsx')).toMatch(
      /if \(!panelOpenRef\.current\) returnFocusRef\.current = null/
    )
  })

  it('the map instructions do not start with the word "Map" (the region is already named Map)', () => {
    for (const [locale, m] of Object.entries(orgFormMessages)) {
      // A leading "Map." sentence (title + full stop in any script), not a word that merely begins
      // with the same letters (Amharic "ካርታውን" = "the map", object case).
      const lead = m.locMapLabel.toLocaleLowerCase(locale)
      const title = m.mapTitle.toLocaleLowerCase(locale)
      expect(lead.startsWith(title) && /^[.。።:]/.test(lead.slice(title.length)), locale).toBe(false)
    }
  })
})

