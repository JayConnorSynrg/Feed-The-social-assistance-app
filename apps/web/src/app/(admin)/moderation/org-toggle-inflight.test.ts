// apps/web/src/app/(admin)/moderation/org-toggle-inflight.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC

import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { finishToggle, guardBusyTrigger, startToggle } from './org-toggle-inflight'

describe('in-flight org toggles', () => {
  it('toggling A then B: A finishing leaves B busy until B finishes', () => {
    let s: Set<string> = new Set()
    s = startToggle(s, 'A')
    s = startToggle(s, 'B')
    s = finishToggle(s, 'A')
    expect(s.has('B')).toBe(true)
    expect(s.has('A')).toBe(false)
    s = finishToggle(s, 'B')
    expect(s.size).toBe(0)
  })

  it('the list tracks busy rows with these helpers (no single busy id)', () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'orgs-section.tsx'), 'utf8')
    expect(src).toMatch(/setBusyIds\(\(s\) => startToggle\(s, org\.id\)\)/)
    expect(src).toMatch(/setBusyIds\(\(s\) => finishToggle\(s, org\.id\)\)/)
    expect(src).not.toMatch(/busyId\b/)
  })
})

describe('guardBusyTrigger (More menu trigger while a toggle runs)', () => {
  it('busy row: pointer-down and opening keys are prevented; Tab and idle rows pass through', () => {
    const busy = new Set(['A'])
    const ev = (key?: string) => ({ key, preventDefault: vi.fn() })
    const pointer = ev()
    expect(guardBusyTrigger(busy, 'A', pointer)).toBe(true)
    expect(pointer.preventDefault).toHaveBeenCalled()
    for (const key of ['Enter', ' ', 'ArrowDown']) {
      const e = ev(key)
      expect(guardBusyTrigger(busy, 'A', e)).toBe(true)
      expect(e.preventDefault).toHaveBeenCalled()
    }
    const tab = ev('Tab')
    expect(guardBusyTrigger(busy, 'A', tab)).toBe(false)
    expect(tab.preventDefault).not.toHaveBeenCalled()
    const idle = ev()
    expect(guardBusyTrigger(busy, 'B', idle)).toBe(false)
    expect(idle.preventDefault).not.toHaveBeenCalled()
  })

  it('both trigger handlers in the list route through the guard', () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'orgs-section.tsx'), 'utf8')
    expect(src).toMatch(/onPointerDown=\{\(e\) => guardBusyTrigger\(busyIds, org\.id, e\)\}/)
    expect(src).toMatch(/onKeyDown=\{\(e\) => guardBusyTrigger\(busyIds, org\.id, e\)\}/)
  })
})

