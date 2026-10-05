// apps/web/src/app/(admin)/moderation/org-panel-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Focus return after the organization panel closes, and the wiring that routes the panel's
// onCloseAutoFocus through it.

import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ORG_CREATE_SELECTOR, restoreFocusAfterPanel } from './org-panel-focus'

const el = (connected = true) => ({ focus: vi.fn(), isConnected: connected })

describe('restoreFocusAfterPanel', () => {
  it('returns focus to the opener and suppresses Radix default focus', () => {
    const e = { preventDefault: vi.fn() }
    const opener = el()
    const create = el()
    restoreFocusAfterPanel(e, opener, { querySelector: () => create })
    expect(e.preventDefault).toHaveBeenCalled()
    expect(opener.focus).toHaveBeenCalled()
    expect(create.focus).not.toHaveBeenCalled()
  })

  it('falls back to the list "Create organization" when the opener is gone (Overview, deep link)', () => {
    const create = el()
    const query = vi.fn(() => create)
    restoreFocusAfterPanel({ preventDefault: vi.fn() }, el(false), { querySelector: query })
    expect(query).toHaveBeenCalledWith(ORG_CREATE_SELECTOR)
    expect(create.focus).toHaveBeenCalled()
    restoreFocusAfterPanel({ preventDefault: vi.fn() }, null, { querySelector: query })
    expect(create.focus).toHaveBeenCalledTimes(2)
  })

  it('is wired: shell -> OrgFormPanel -> SheetContent, and the list Create button carries the marker', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const shell = fs.readFileSync(path.join(here, 'admin-shell.tsx'), 'utf8')
    const panel = fs.readFileSync(path.join(here, '../../../components/org-form/org-form-panel.tsx'), 'utf8')
    const list = fs.readFileSync(path.join(here, 'orgs-section.tsx'), 'utf8')
    expect(shell).toMatch(/onCloseAutoFocus=\{\(e\) => restoreFocusAfterPanel\(e, returnFocusRef\.current\)\}/)
    expect(shell).toMatch(/returnFocusRef\.current = document\.activeElement/)
    expect(panel).toMatch(/<SheetContent[^>]*?onCloseAutoFocus=\{onCloseAutoFocus\}/s)
    expect(list).toMatch(/data-org-create/)
  })
})
