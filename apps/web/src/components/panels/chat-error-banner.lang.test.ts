// apps/web/src/components/panels/chat-error-banner.lang.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The chat error banner reads in the viewer's locale (useProfileLocale) — the profile's language,
// not the device's — and carries that language and direction.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const auth = vi.hoisted(() => ({ value: { profile: null as unknown } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), createOpId: () => 'op' }))

import { ChatErrorBanner } from './chat-panel'
import { t } from '@/lib/i18n'

const banner = () => renderToStaticMarkup(createElement(ChatErrorBanner, { kind: 'network', onRetry: () => {}, isRetrying: false }))

describe('chat error banner', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("Korean profile on a Spanish device: the banner is Korean", () => {
    vi.stubGlobal('localStorage', { getItem: () => 'es' })
    vi.stubGlobal('navigator', { language: 'es-MX' })
    auth.value = { profile: { id: 'u1', preferred_language: 'ko' } }
    const html = banner()
    expect(html).toMatch(/role="alert" lang="ko" dir="ltr"/)
    expect(html).toContain(t('ko', 'chatErrorOffline'))
    expect(html).toContain(t('ko', 'tryAgain'))
  })

  it('Arabic profile: right to left', () => {
    auth.value = { profile: { id: 'u1', preferred_language: 'ar' } }
    expect(banner()).toMatch(/role="alert" lang="ar" dir="rtl"/)
  })
})
