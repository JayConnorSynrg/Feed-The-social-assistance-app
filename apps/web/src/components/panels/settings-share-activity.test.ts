/**
 * Source-level guard for the removed "Share Activity" control.
 *
 * `shareActivity` had no consumer outside settings-panel.tsx and its toggle
 * was dead (it changed nothing). Wave A removed it from the SettingsData type,
 * DEFAULT_SETTINGS, and the UI. These are module-internal (not exported), so a
 * source-level guard is the right test: it has no runtime behavior to exercise.
 *
 * Regression guard: this asserts ABSENCE — it never reintroduces the symbol
 * into the codebase.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'settings-panel.tsx'), 'utf8')

describe('settings-panel: Share Activity removed', () => {
  it('does not reference shareActivity anywhere in the panel source', () => {
    expect(source).not.toMatch(/shareActivity/)
  })

  it('does not render a "Share Activity" ToggleRow label', () => {
    expect(source).not.toMatch(/Share Activity/)
  })
})
