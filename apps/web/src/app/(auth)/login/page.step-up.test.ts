// page.step-up.test.ts — /login?step=mfa, the admin MFA step-up. The REAL login page and the REAL
// MFAVerify, driven by the SSR hook harness; the Supabase MFA service is faked.
//   - A signed-in session with a verified factor at aal1 is shown the code prompt exactly once.
//   - A wrong code shows an error and the prompt stays for a retry; a correct code goes to redirectTo.
//   - redirectTo is honoured only as a same-origin relative path.
//   - A backup code does not raise the session to aal2, so an admin destination is not navigated to.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  return reactWithHarness(await importOriginal<typeof import('react')>())
})

const t = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  factors: [] as Array<{ id: string; status: string }>,
  aal: { current: 'aal1' as 'aal1' | 'aal2' },
  verifyResults: [] as boolean[],
  backupOk: false,
  calls: { listFactors: 0, createChallenge: 0, verify: [] as string[] },
  buttons: [] as Array<{ label: string; onClick?: () => void }>,
  inputs: [] as Array<{ placeholder?: string; onChange?: (e: { target: { value: string } }) => void }>,
}))

vi.mock('next/navigation', () => ({ useRouter: () => t.router, useSearchParams: () => t.params }))
vi.mock('next/link', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return { default: (p: { href: string; children?: unknown }) => createElement('a', { href: p.href }, p.children as string) }
})
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {} }) }))
vi.mock('@/hooks/use-rate-limited-action', () => ({ useRateLimitedAction: () => ({ execute: vi.fn(), isLimited: false, remainingRequests: 5 }) }))
vi.mock('@/hooks/use-csrf-token', () => ({ useCsrfToken: () => ({ token: 'tok', validate: () => true }) }))
vi.mock('@/components/auth/turnstile-widget', () => ({ TurnstileWidget: () => null }))
vi.mock('@/lib/audit-logger', () => ({ logPredefinedEvent: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))
vi.mock('@/lib/mfa', () => ({
  mfaService: {
    listFactors: async () => { t.calls.listFactors++; return t.factors },
    getAssuranceLevel: async () => t.aal.current,
    createChallenge: async () => { t.calls.createChallenge++; return 'ch1' },
    verifyChallenge: async (_f: string, _c: string, code: string) => {
      t.calls.verify.push(code)
      const ok = t.verifyResults.shift() ?? false
      if (ok) t.aal.current = 'aal2'
      return ok
    },
    verifyBackupCode: async () => t.backupOk,
  },
}))
vi.mock('@/components/ui/button', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return {
    Button: (p: { children?: unknown; onClick?: () => void }) => {
      t.buttons.push({ label: typeof p.children === 'string' ? p.children : '', onClick: p.onClick })
      return createElement('button', null, p.children as string)
    },
  }
})
vi.mock('@/components/ui/input', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return {
    Input: (p: { placeholder?: string; onChange?: (e: { target: { value: string } }) => void; value?: string }) => {
      t.inputs.push({ placeholder: p.placeholder, onChange: p.onChange })
      return createElement('input', { placeholder: p.placeholder, value: p.value, readOnly: true })
    },
  }
})

import { harness } from '@/test-utils/ssr-hook-harness'
import LoginPage from './page'

const page = () => h(LoginPage)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function settle() { t.buttons = []; t.inputs = []; return harness.settle(page()) }
const lastInput = (placeholder: string) => [...t.inputs].reverse().find((i) => i.placeholder === placeholder)!
const lastButton = (label: string) => [...t.buttons].reverse().find((b) => b.label === label)!
/** Type a full code: MFAVerify auto-submits 100 ms after the 6th digit. */
async function typeCode(code: string) {
  lastInput('000000').onChange!({ target: { value: code } })
  await settle()
  await wait(150)
  return settle()
}

beforeEach(() => {
  harness.reset()
  t.params = new URLSearchParams()
  t.router.push.mockReset(); t.router.replace.mockReset(); t.router.refresh.mockReset()
  t.factors = [{ id: 'f1', status: 'verified' }]
  t.aal.current = 'aal1'
  t.verifyResults = []
  t.backupOk = false
  t.calls = { listFactors: 0, createChallenge: 0, verify: [] }
})

describe('/login?step=mfa', () => {
  it('shows the code prompt exactly once for an aal1 session with a verified factor', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    const html = await settle()
    expect(html).toContain('Two-Factor Authentication')
    expect(html).not.toContain('Welcome to FEED')
    // The effect runs again (as under React StrictMode, or a new router identity): still one prompt.
    t.router = { ...t.router }
    await settle()
    expect(t.calls.listFactors).toBe(1)
    expect(t.calls.createChallenge).toBe(1)
  })

  it('a wrong code shows an error and keeps the prompt; the right code goes to redirectTo', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation%3Ftab%3Dpeople')
    await settle()
    t.verifyResults = [false, true]
    let html = await typeCode('111111')
    expect(html).toContain('Invalid verification code')
    expect(html).toContain('Two-Factor Authentication')
    expect(t.router.push).not.toHaveBeenCalled()
    html = await typeCode('222222')
    expect(t.calls.verify).toEqual(['111111', '222222'])
    expect(t.router.push).toHaveBeenCalledTimes(1)
    expect(t.router.push).toHaveBeenCalledWith('/moderation?tab=people')
  })

  it('the Verify button submits the typed code', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    await settle()
    t.verifyResults = [true]
    lastInput('000000').onChange!({ target: { value: '33333' } }) // 5 digits: no auto-submit
    await settle()
    lastInput('000000').onChange!({ target: { value: '333333' } })
    await settle()
    lastButton('Verify').onClick!()
    await wait(150)
    await settle()
    expect(t.calls.verify[0]).toBe('333333')
    expect(t.router.push).toHaveBeenCalledWith('/moderation')
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil'])('an off-origin redirectTo %j lands on / after the code', async (bad) => {
    t.params = new URLSearchParams({ step: 'mfa', redirectTo: bad })
    await settle()
    t.verifyResults = [true]
    await typeCode('444444')
    expect(t.router.push).toHaveBeenCalledWith('/')
  })

  it('a backup code does not unlock an admin route (the session stays aal1)', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    await settle()
    t.backupOk = true
    lastButton('Use Backup Code').onClick!()
    await settle()
    lastInput('ENTER-BACKUP-CODE').onChange!({ target: { value: 'abcd-1234' } })
    await settle()
    lastButton('Verify Backup Code').onClick!()
    await wait(10)
    const html = await settle()
    expect(t.router.push).not.toHaveBeenCalled()
    expect(html).toContain('authenticator app to continue')
  })

  it('an already-aal2 session goes straight to redirectTo', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    t.aal.current = 'aal2'
    const html = await settle()
    expect(t.router.replace).toHaveBeenCalledWith('/moderation')
    expect(html).not.toContain('Two-Factor Authentication')
  })

  it('without step=mfa (or signed out, no factor) the sign-in form shows and no step-up runs', async () => {
    let html = await settle()
    expect(html).toContain('Welcome to FEED')
    expect(html).not.toContain('Two-Factor Authentication')
    expect(t.calls.listFactors).toBe(0)
    harness.reset()
    t.params = new URLSearchParams('step=mfa')
    t.factors = []
    html = await settle()
    expect(html).toContain('Welcome to FEED')
    expect(html).not.toContain('Two-Factor Authentication')
    expect(t.calls.createChallenge).toBe(0)
  })
})
