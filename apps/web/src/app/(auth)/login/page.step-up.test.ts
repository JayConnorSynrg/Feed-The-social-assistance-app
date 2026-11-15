// page.step-up.test.ts — /login?step=mfa, the admin MFA step-up. The REAL login page and the REAL
// MFAVerify, driven by the SSR hook harness; the Supabase MFA service is faked.
//   - A signed-in session with a verified factor at aal1 is shown the code prompt exactly once.
//   - A wrong code shows an error and the prompt stays for a retry; a correct code goes to redirectTo.
//   - redirectTo is honoured only as a same-origin relative path.
//   - The prompt is usable by keyboard and screen reader: labelled field, hint, one-time-code, one
//     always-present alert tied to the field, focus back in the field after an error, Enter submits
//     once (single flight), the field stays focusable while checking.
//   - A backup code does not raise the session to aal2, so for an admin destination it is not offered.
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
  aalStuck: false,
  calls: { listFactors: 0, createChallenge: 0, verify: [] as string[] },
  buttons: [] as Array<{ label: string; onClick?: () => void }>,
  inputs: [] as Array<Record<string, unknown> & { placeholder?: string; onChange?: (e: { target: { value: string } }) => void }>,
  focus: vi.fn(),
  verifyGate: null as null | Promise<void>,
}))

// The real <form> is not a component; record its props from the JSX runtime to submit it (Enter).
const forms = vi.hoisted(() => [] as Array<{ onSubmit?: (e: { preventDefault: () => void }) => void }>)
const recordForms = vi.hoisted(() => (actual: Record<string, (...a: unknown[]) => unknown>) => {
  const wrap = (fn: (...a: unknown[]) => unknown) => (type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => {
    if (type === 'form') forms.push(props as (typeof forms)[number])
    return fn(type, props, ...rest)
  }
  return { ...actual, ...(actual.jsx && { jsx: wrap(actual.jsx), jsxs: wrap(actual.jsxs) }), ...(actual.jsxDEV && { jsxDEV: wrap(actual.jsxDEV) }) }
})
vi.mock('react/jsx-runtime', async (orig) => recordForms(await orig()))
vi.mock('react/jsx-dev-runtime', async (orig) => recordForms(await orig()))

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
      if (t.verifyGate) await t.verifyGate
      const ok = t.verifyResults.shift() ?? false
      if (ok && !t.aalStuck) t.aal.current = 'aal2'
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
    Input: (p: Record<string, unknown> & { ref?: { current: unknown }; onChange?: (e: { target: { value: string } }) => void }) => {
      const { ref, onChange, ...rest } = p
      if (ref && typeof ref === 'object') ref.current = { focus: t.focus }
      t.inputs.push({ ...rest, onChange })
      return createElement('input', { ...rest, autoFocus: undefined, readOnly: true })
    },
  }
})

import { harness } from '@/test-utils/ssr-hook-harness'
import LoginPage from './page'

const page = () => h(LoginPage)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function settle() { t.buttons = []; t.inputs = []; forms.length = 0; return harness.settle(page()) }
const codeInput = () => [...t.inputs].reverse().find((i) => i.id === 'mfa-code')!
const submitForm = () => forms[forms.length - 1].onSubmit!({ preventDefault: () => {} })
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
  t.aalStuck = false
  t.calls = { listFactors: 0, createChallenge: 0, verify: [] }
  t.focus.mockReset()
  t.verifyGate = null
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

  it('Enter submits the form with the typed code', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    await settle()
    t.verifyResults = [true]
    lastInput('000000').onChange!({ target: { value: '33333' } }) // 5 digits: no auto-submit
    await settle()
    expect(t.calls.verify).toEqual([])
    submitForm() // 5 digits: refused with the error, nothing verified
    let html = await settle()
    expect(t.calls.verify).toEqual([])
    expect(html).toContain('Please enter a valid 6-digit code')
    lastInput('000000').onChange!({ target: { value: '333333' } })
    await settle()
    submitForm()
    await wait(150)
    html = await settle()
    expect(t.calls.verify).toEqual(['333333']) // Enter + auto-submit: verified once
    expect(t.router.push).toHaveBeenCalledWith('/moderation')
  })

  it('a submit while a check is in flight does not verify twice', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    await settle()
    t.verifyResults = [true]
    let release!: () => void
    t.verifyGate = new Promise<void>((r) => { release = r })
    lastInput('000000').onChange!({ target: { value: '555555' } })
    await settle()
    await wait(150) // auto-submit started and is waiting on the server
    await settle()
    expect(codeInput().readOnly).toBe(true) // stays focusable while checking (not disabled)
    expect(codeInput().disabled).toBeUndefined()
    submitForm()
    submitForm()
    release()
    await wait(10)
    await settle()
    expect(t.calls.verify).toEqual(['555555'])
  })

  it('the code field is labelled, hinted, one-time-code, and its error is announced and tied to it', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    let html = await settle()
    expect(html).toMatch(/<h1[^>]*>Two-Factor Authentication<\/h1>/)
    expect(html).toMatch(/<label for="mfa-code"[^>]*>6-digit code<\/label>/)
    expect(html).toContain('id="mfa-code-hint"')
    expect(html).toContain('The code is checked when you enter the 6th digit')
    expect(codeInput().autoComplete).toBe('one-time-code')
    expect(codeInput()['aria-describedby']).toBe('mfa-code-hint')
    expect(codeInput()['aria-invalid']).toBe(false)
    // one alert region, rendered before any error
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html).toMatch(/<div role="alert" id="mfa-code-error"><\/div>/)
    t.verifyResults = [false]
    html = await typeCode('111111')
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html).toMatch(/<div role="alert" id="mfa-code-error"[^>]*>.*Invalid verification code/)
    expect(codeInput()['aria-invalid']).toBe(true)
    expect(codeInput()['aria-describedby']).toBe('mfa-code-error mfa-code-hint')
    expect(t.focus).toHaveBeenCalled() // focus is back in the code field for the retry
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil'])('an off-origin redirectTo %j lands on / after the code', async (bad) => {
    t.params = new URLSearchParams({ step: 'mfa', redirectTo: bad })
    await settle()
    t.verifyResults = [true]
    await typeCode('444444')
    expect(t.router.push).toHaveBeenCalledWith('/')
  })

  it('for an admin destination the backup-code option is not offered, so no code is consumed', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    const html = await settle()
    expect(html).not.toContain('Use Backup Code')
    expect(t.buttons.some((b) => b.label === 'Use Backup Code')).toBe(false)
  })

  it('for a member destination the backup-code option stays', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2F')
    t.backupOk = true
    await settle()
    lastButton('Use Backup Code').onClick!()
    await settle()
    lastInput('ENTER-BACKUP-CODE').onChange!({ target: { value: 'abcd-1234' } })
    await settle()
    lastButton('Verify Backup Code').onClick!()
    await wait(10)
    await settle()
    expect(t.router.push).toHaveBeenCalledWith('/')
  })

  it('a verified code that leaves the session aal1 is refused in the same alert, and nothing navigates', async () => {
    t.params = new URLSearchParams('step=mfa&redirectTo=%2Fmoderation')
    await settle()
    t.verifyResults = [true]
    t.aalStuck = true
    const html = await typeCode('666666')
    expect(t.router.push).not.toHaveBeenCalled()
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html).toMatch(/<div role="alert" id="mfa-code-error"[^>]*>.*authenticator app to continue/)
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
