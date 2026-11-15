// apps/web/src/lib/i18n-admin-shell.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Parity for the admin shell's dictionary (src/test/dictionary-parity.ts), and every tab the shell
// can show has a name in every language (adminTabLabel is the tab bar's one source).
// What an admin reads on screen: app/(admin)/moderation/admin-shell.i18n.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { logger } from './logger'
import { messages, type Locale } from './i18n'
import { adminShellMessages, adminShellT, adminTabLabel } from './i18n-admin-shell'
import { TAB_ORDER } from '@/app/(admin)/moderation/admin-shell-tabs'
import { describeDictionaryParity } from '@/test/dictionary-parity'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('admin shell', adminShellMessages, adminShellT)

describe('tab names', () => {
  beforeEach(() => vi.mocked(logger.warn).mockClear())

  it.each(LOCALES)('%s: every tab has its own name, and no two tabs share one', (locale) => {
    const names = TAB_ORDER.map((id) => adminTabLabel(id, locale))
    expect(names.every((n) => n.trim() !== '')).toBe(true)
    expect(new Set(names).size).toBe(names.length)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('reads each language', () => {
    expect(adminTabLabel('moderation', 'ko')).toBe('검토')
    expect(adminTabLabel('people', 'es')).toBe('Personas')
    expect(adminShellT('ar', 'allOrganizations')).toBe('كل المنظمات')
  })
})
