// feed-shell.region.test.ts — the panel content host is one named region whose
// name is the active panel's sidebar label.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { panelRegionLabel } from './feed-shell'

const source = readFileSync(fileURLToPath(new URL('./feed-shell.tsx', import.meta.url)), 'utf8')

describe('FeedShell panel region', () => {
  it('names the region after the active panel (sidebar labels)', () => {
    expect(panelRegionLabel('chat')).toBe('AI Assistant')
    expect(panelRegionLabel('map')).toBe('Resource Map')
    expect(panelRegionLabel('feed')).toBe('Community & Messages')
    expect(panelRegionLabel('documents')).toBe('Documents & Forms')
    expect(panelRegionLabel('settings')).toBe('Settings')
  })

  it('the children host carries role="region" + aria-label from the active panel — exactly once', () => {
    // control: the host markup the pin anchors on exists
    expect(source).toContain('className="bg-[#faf9f6] rounded-2xl border border-stone-200/50 p-6 shadow-sm h-full flex flex-col"')
    const host = source.match(/<div\s+role="region"\s+aria-label=\{panelRegionLabel\(activePanel\)\}\s+className="bg-\[#faf9f6\][^"]*"\s*>\s*\{children\}/)
    expect(host).not.toBeNull()
    expect(source.match(/role="region"/g)).toHaveLength(1)
    expect(source).not.toMatch(/<main\b|role="main"/)
  })
})
