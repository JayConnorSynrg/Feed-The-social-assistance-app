// apps/web/src/app/(admin)/moderation/org-toggle-inflight.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { finishToggle, startToggle } from './org-toggle-inflight'

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
