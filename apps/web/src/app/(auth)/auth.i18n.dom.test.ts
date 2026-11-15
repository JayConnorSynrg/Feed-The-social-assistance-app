// @vitest-environment jsdom
// apps/web/src/app/(auth)/auth.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W6 — sign in, sign up, forgot / reset password, with React's real scheduling in a real DOM
// (jsdom, createRoot, act). The locale comes as the root layout hands it over (InitialLocaleContext:
// the feed_locale cookie, else Accept-Language); there is no profile.
//   - each page is in the visitor's language, lang/dir on its root (Korean text, Arabic rtl); the
//     Terms / Privacy row stays English, marked lang="en";
//   - the Supabase calls, their arguments, the lockout requests and every redirect are the SAME in
//     English and Korean;
//   - a failure shows a translated line chosen from the error's code — never Supabase's text — and
//     writes exactly one row with the code only (none where one is already written);
//   - no email address reaches a log or the audit row; oauth.start.error carries the code only;
//   - one always-mounted alert per form, one new node per failure (an identical repeat too); a busy
//     submit is aria-disabled and a second press sends nothing; focus moves to the view that
//     replaces the form; required fields, autocomplete tokens, and Label in Name in 14 locales.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  calls: [] as Array<[string, unknown]>,
  results: {} as Record<string, { data?: unknown; error?: unknown }>,
  params: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  gate: null as null | Promise<void>,
}))

vi.mock('next/navigation', () => ({ useRouter: () => h.router, useSearchParams: () => h.params }))
vi.mock('next/link', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return { default: (p: { href: string; className?: string; children?: unknown }) => createElement('a', { href: p.href, className: p.className }, p.children as string) }
})
const call = (name: string) => async (arg?: unknown, arg2?: unknown) => {
  h.calls.push([name, arg2 === undefined ? arg : [arg, arg2]])
  if (h.gate) await h.gate
  const r = h.results[name] ?? {}
  return { data: r.data ?? { session: null, user: null }, error: r.error ?? null }
}
const client = {
  auth: {
    getSession: call('getSession'),
    signInWithPassword: call('signInWithPassword'),
    refreshSession: call('refreshSession'),
    signInWithOAuth: call('signInWithOAuth'),
    signInAnonymously: call('signInAnonymously'),
    signUp: call('signUp'),
    resend: call('resend'),
    resetPasswordForEmail: call('resetPasswordForEmail'),
    updateUser: call('updateUser'),
  },
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => client }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null }) }))
vi.mock('@/hooks/use-rate-limited-action', () => ({
  useRateLimitedAction: () => ({ execute: async (fn: () => unknown) => fn(), isLimited: false, remainingRequests: 5 }),
}))
vi.mock('@/hooks/use-csrf-token', () => ({ useCsrfToken: () => ({ token: 'tok', validate: () => true }) }))
vi.mock('@/components/auth/turnstile-widget', () => ({ TurnstileWidget: () => null }))
vi.mock('@/lib/audit-logger', () => ({ logPredefinedEvent: vi.fn() }))
vi.mock('@/lib/mfa', () => ({ mfaService: { listFactors: async () => [], getAssuranceLevel: async () => 'aal1', createChallenge: async () => 'ch1', verifyChallenge: async () => false, verifyBackupCode: async () => false } }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), time: () => ({ end: vi.fn(), error: vi.fn() }) },
  logEvent: vi.fn(),
}))

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { logger } from '@/lib/logger'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { messages, t, type Locale } from '@/lib/i18n'
import { authT } from '@/lib/i18n-auth'
import LoginPage from './login/page'
import SignupPage from './signup/page'
import ForgotPasswordPage from './forgot-password/page'
import ResetPasswordPage from './reset-password/page'
import { MFAVerify } from '@/components/auth/mfa-verify'

const LOCALES = Object.keys(messages) as Locale[]
const EMAIL = 'ada.lovelace@example.org'
const PASSWORD = 'Str0ng!Passw0rd#2026'
const supabaseError = (code: string, message: string) => Object.assign(new Error(message), { name: 'AuthApiError', code, status: 400 })

let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const fetchBodies: string[] = []

beforeEach(() => {
  h.calls = []
  h.results = {}
  h.params = new URLSearchParams()
  h.gate = null
  h.router.push.mockReset(); h.router.replace.mockReset(); h.router.refresh.mockReset()
  vi.mocked(logger.warn).mockClear(); vi.mocked(logger.error).mockClear(); vi.mocked(logger.info).mockClear()
  vi.mocked(logPredefinedEvent).mockClear()
  fetchBodies.length = 0
  globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    fetchBodies.push(init?.body ?? '')
    return { ok: true, json: async () => ({ isLocked: false }) }
  }) as unknown as typeof fetch
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
async function render(page: () => ReactElement, locale: Locale) {
  await act(async () => root.render(el(InitialLocaleContext.Provider, { value: locale }, page())))
  await settle()
}
const byId = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T
const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement
function type(id: string, value: string) {
  const input = byId(id)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function check(id: string) {
  act(() => byId(id).click())
}
async function submit() {
  await act(async () => { (document.querySelector('form') as HTMLFormElement).requestSubmit() })
  await settle()
}
const rootOf = () => container.querySelector('[lang]') as HTMLElement
const alertText = () => [...document.querySelectorAll('[role="alert"]')].map((n) => n.textContent ?? '').join('|')
const loggedText = () => JSON.stringify([vi.mocked(logger.warn).mock.calls, vi.mocked(logger.error).mock.calls, vi.mocked(logger.info).mock.calls])

const login = () => el(LoginPage)
const signup = () => el(SignupPage)
const forgot = () => el(ForgotPasswordPage)
const reset = () => el(ResetPasswordPage)

async function signIn(locale: Locale) {
  await render(login, locale)
  type('email', EMAIL)
  type('password', PASSWORD)
  await submit()
}
async function signUp(locale: Locale) {
  await render(signup, locale)
  type('firstName', 'Ada')
  type('lastName', 'Lovelace')
  type('email', EMAIL)
  type('password', PASSWORD)
  type('confirmPassword', PASSWORD)
  check('terms')
  await submit()
}

describe('each page in the visitor language, marked on its root', () => {
  it.each([
    ['sign in', login, () => [t('ko', 'welcome'), authT('ko', 'orContinueWith'), authT('ko', 'guestHint')]],
    ['sign up', signup, () => [authT('ko', 'joinTitle'), authT('ko', 'firstName'), authT('ko', 'createAccount')]],
    ['forgot password', forgot, () => [authT('ko', 'forgotTitle'), authT('ko', 'sendResetLink')]],
    ['reset password', reset, () => [authT('ko', 'resetTitle'), authT('ko', 'updatePassword')]],
  ] as const)('%s: Korean, lang="ko"; Arabic dir="rtl"', async (_name, page, words) => {
    await render(page, 'ko')
    expect(rootOf()).toMatchObject({ lang: 'ko', dir: 'ltr' })
    for (const w of words()) expect(container.textContent).toContain(w)
    expect(container.textContent).not.toMatch(/Or continue with|Create Account|Send reset link|Update password/)
    await act(async () => root.render(el('div')))
    await render(page, 'ar')
    expect(rootOf()).toMatchObject({ lang: 'ar', dir: 'rtl' })
  })

  it('sign up: the Terms / Privacy row stays English, marked lang="en" dir="ltr"', async () => {
    await render(signup, 'ko')
    const row = byId<HTMLElement>('terms').closest('[lang]') as HTMLElement
    expect(row).toMatchObject({ lang: 'en', dir: 'ltr' })
    expect(row.textContent).toContain('Terms of Service')
    expect(row.textContent).toContain('Privacy Policy')
  })

  it('sign in: the OAuth callback code reads as a sentence; its detail text is not shown', async () => {
    h.params = new URLSearchParams({ error: 'exchange_failed', detail: 'invalid flow state, no valid flow state found' })
    await render(login, 'ko')
    expect(container.textContent).toContain(authT('ko', 'oauthExchange'))
    expect(container.textContent).not.toContain('flow state')
  })
})

describe('the same Supabase calls, requests and redirects in English and Korean', () => {
  async function trace(run: (l: Locale) => Promise<void>, locale: Locale) {
    h.calls = []; fetchBodies.length = 0
    h.router.push.mockClear()
    await run(locale)
    const out = { calls: JSON.parse(JSON.stringify(h.calls)), fetches: [...fetchBodies], push: h.router.push.mock.calls.map((c) => c[0]) }
    await act(async () => root.render(el('div')))
    return out
  }

  it('sign in (success, then a refused password)', async () => {
    const en = await trace(signIn, 'en')
    const ko = await trace(signIn, 'ko')
    expect(ko).toEqual(en)
    expect(en.calls.map((c: [string]) => c[0])).toEqual(['getSession', 'signInWithPassword'])
    expect(en.push).toEqual(['/'])
    h.results.signInWithPassword = { error: supabaseError('invalid_credentials', 'Invalid login credentials') }
    expect(await trace(signIn, 'ko')).toEqual(await trace(signIn, 'en'))
  })

  it('sign in keeps a safe redirectTo and refuses an unsafe one in both languages', async () => {
    for (const [param, dest] of [['/map', '/map'], ['//evil.com', '/']]) {
      h.params = new URLSearchParams({ redirectTo: param })
      const en = await trace(signIn, 'en')
      const ko = await trace(signIn, 'ko')
      expect(ko.push).toEqual([dest])
      expect(en.push).toEqual([dest])
    }
  })

  it('sign up, guest, forgot and reset', async () => {
    expect(await trace(signUp, 'ko')).toEqual(await trace(signUp, 'en'))
    const guest = async (l: Locale) => { await render(login, l); await act(async () => button(t(l, 'findHelpNow')).click()); await settle() }
    expect(await trace(guest, 'ko')).toEqual(await trace(guest, 'en'))
    const requestReset = async (l: Locale) => { await render(forgot, l); type('email', EMAIL); await submit() }
    expect(await trace(requestReset, 'ko')).toEqual(await trace(requestReset, 'en'))
    const setPassword = async (l: Locale) => { await render(reset, l); type('new-password', PASSWORD); type('confirm-password', PASSWORD); await submit() }
    const en = await trace(setPassword, 'en')
    expect(await trace(setPassword, 'ko')).toEqual(en)
    expect(en.calls).toEqual([['updateUser', { password: PASSWORD }]])
  })
})

describe('a failure: a translated line from the code, one row with the code only', () => {
  it('sign up refused: the Korean line, never Supabase text; one auth.signup.failed {code, step}', async () => {
    h.results.signUp = { error: supabaseError('weak_password', 'Password should contain at least one character of each: abc') }
    await signUp('ko')
    expect(alertText()).toContain(authT('ko', 'passwordTooWeak'))
    expect(container.textContent).not.toContain('should contain')
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith('auth.signup.failed', { code: 'weak_password', step: 'signup' })
    expect(loggedText()).not.toContain(EMAIL)
  })

  it('sign up into an existing account: accountExists, one row', async () => {
    h.results.signUp = { data: { user: { identities: [] }, session: null } }
    await signUp('ar')
    expect(alertText()).toContain(authT('ar', 'accountExists'))
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith('auth.signup.failed', { code: 'user_already_exists', step: 'signup' })
  })

  it('a refused password sign-in writes no client row (check-lockout records it) and shows the code line', async () => {
    h.results.signInWithPassword = { error: supabaseError('invalid_credentials', 'Invalid login credentials') }
    await signIn('ko')
    expect(alertText()).toContain(authT('ko', 'invalidCredentials'))
    expect(container.textContent).not.toContain('Invalid login credentials')
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
    const recorded = fetchBodies.map((b) => JSON.parse(b)).find((b) => b.action === 'record_attempt')
    expect(recorded).toMatchObject({ success: false, failure_reason: 'invalid_credentials' })
  })

  it('guest start refused: one auth.guest.failed {code, step}', async () => {
    h.results.signInAnonymously = { error: supabaseError('anonymous_provider_disabled', 'Anonymous sign-ins are disabled') }
    await render(signup, 'ko')
    await act(async () => button(t('ko', 'findHelpNow')).click())
    await settle()
    expect(alertText()).toContain(authT('ko', 'guestFailed'))
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith('auth.guest.failed', { code: 'anonymous_provider_disabled', step: 'signup' })
  })

  it('forgot and reset refused: one auth.password.failed each', async () => {
    h.results.resetPasswordForEmail = { error: supabaseError('over_email_send_rate_limit', 'For security purposes, you can only request this after 49 seconds.') }
    await render(forgot, 'ko'); type('email', EMAIL); await submit()
    expect(alertText()).toContain(authT('ko', 'emailRateLimited'))
    expect(logger.warn).toHaveBeenLastCalledWith('auth.password.failed', { code: 'over_email_send_rate_limit', step: 'forgot' })
    await act(async () => root.render(el('div')))
    h.results.updateUser = { error: supabaseError('same_password', 'New password should be different from the old password.') }
    await render(reset, 'ko'); type('new-password', PASSWORD); type('confirm-password', PASSWORD); await submit()
    expect(alertText()).toContain(authT('ko', 'samePassword'))
    expect(container.textContent).not.toContain('should be different')
    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenLastCalledWith('auth.password.failed', { code: 'same_password', step: 'reset' })
    expect(loggedText()).not.toContain(EMAIL)
  })

  it('OAuth start refused: oauth.start.error carries the code only (no message), the line is translated', async () => {
    h.results.signInWithOAuth = { error: supabaseError('provider_disabled', 'Unsupported provider: provider is not enabled') }
    await render(login, 'ko')
    await act(async () => button('Google').click())
    await settle()
    expect(logger.error).toHaveBeenCalledTimes(1)
    const [event, err, labels] = vi.mocked(logger.error).mock.calls[0]
    expect(event).toBe('oauth.start.error')
    expect(err).toEqual({ code: 'provider_disabled' })
    expect(labels).toEqual({ provider: 'google' })
    expect(alertText()).toContain(authT('ko', 'oauthStartFailed'))
    expect(container.textContent).not.toContain('Unsupported provider')
  })

  it('sign up: OAuth start refused shows the translated line, code-only row', async () => {
    h.results.signInWithOAuth = { error: supabaseError('provider_disabled', 'Unsupported provider: provider is not enabled') }
    await render(signup, 'ar')
    await act(async () => button('Apple').click())
    await settle()
    expect(logger.error).toHaveBeenCalledWith('oauth.start.error', { code: 'provider_disabled' }, { provider: 'apple' })
    expect(alertText()).toContain(authT('ar', 'oauthStartFailed'))
    expect(container.textContent).not.toContain('Unsupported provider')
  })

  it('the sign-in audit row carries no email address', async () => {
    await signIn('en')
    const audit = vi.mocked(logPredefinedEvent).mock.calls.find((c) => c[0] === 'AUTH_LOGIN_SUCCESS')
    expect(audit?.[1]).toEqual({ action: 'verify', details: { method: 'password' } })
    expect(JSON.stringify(vi.mocked(logPredefinedEvent).mock.calls)).not.toContain(EMAIL)
  })
})

describe('keyboard and screen reader', () => {
  it('one always-mounted alert; two identical failures insert two nodes', async () => {
    h.results.signInWithPassword = { error: supabaseError('invalid_credentials', 'x') }
    await render(login, 'ko')
    const regions = document.querySelectorAll('[role="alert"]')
    expect(regions).toHaveLength(1)
    const inserted: string[] = []
    const observer = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
    observer.observe(regions[0], { childList: true, subtree: true })
    type('email', EMAIL); type('password', PASSWORD)
    await submit()
    await submit()
    await Promise.resolve()
    observer.disconnect()
    expect(inserted).toEqual([authT('ko', 'invalidCredentials'), authT('ko', 'invalidCredentials')])
  })

  it('a busy submit stays focusable (aria-disabled, never disabled) and a second press sends nothing', async () => {
    let open!: () => void
    h.gate = new Promise<void>((r) => { open = r })
    await render(login, 'ko')
    type('email', EMAIL); type('password', PASSWORD)
    await submit()
    const busy = button(authT('ko', 'signingIn'))
    expect(busy.getAttribute('aria-disabled')).toBe('true')
    expect(busy.disabled).toBe(false)
    expect(byId('email').readOnly).toBe(true)
    expect(byId('email').disabled).toBe(false)
    await submit()
    open()
    await settle()
    expect(h.calls.filter((c) => c[0] === 'signInWithPassword')).toHaveLength(1)
  })

  it('sign up succeeds: focus moves to "Check your email"; Use a different email returns it to the email field', async () => {
    await signUp('ko')
    expect(document.activeElement?.textContent).toBe(authT('ko', 'checkEmailTitle'))
    expect(container.querySelector('strong[dir="ltr"]')?.textContent).toBe(EMAIL)
    await act(async () => button(authT('ko', 'useDifferentEmail')).click())
    await settle()
    expect(document.activeElement).toBe(byId('email'))
  })

  it('forgot password sent: focus moves to the confirmation', async () => {
    await render(forgot, 'ar'); type('email', EMAIL); await submit()
    expect(document.activeElement?.textContent).toBe(authT('ar', 'forgotSent'))
  })

  it('required fields, autocomplete tokens, LTR email and password fields', async () => {
    await render(login, 'ko')
    expect(byId('email')).toMatchObject({ required: true, autocomplete: 'email', dir: 'ltr' })
    expect(byId('email').getAttribute('aria-required')).toBe('true')
    expect(byId('password')).toMatchObject({ required: true, autocomplete: 'current-password' })
    await act(async () => root.render(el('div')))
    await render(signup, 'ko')
    expect(byId('firstName')).toMatchObject({ required: true, autocomplete: 'given-name' })
    expect(byId('lastName').autocomplete).toBe('family-name')
    expect(byId('password').autocomplete).toBe('new-password')
    expect(byId('confirmPassword').autocomplete).toBe('new-password')
    for (const id of ['firstName', 'email', 'password', 'confirmPassword']) expect(byId(id).getAttribute('aria-required'), id).toBe('true')
    await act(async () => root.render(el('div')))
    await render(reset, 'ko')
    expect(byId('new-password').autocomplete).toBe('new-password')
  })

  it.each(LOCALES)('%s: every control is named by the words on it (Label in Name); every field has a visible label', async (l) => {
    for (const page of [login, signup, forgot, reset]) {
      await render(page, l)
      for (const b of container.querySelectorAll('button')) {
        expect(b.getAttribute('aria-label'), b.outerHTML.slice(0, 80)).toBeNull()
        expect(b.textContent?.trim()).toBeTruthy()
      }
      for (const input of container.querySelectorAll('input:not([type="hidden"])')) {
        const label = container.querySelector(`label[for="${input.id}"]`)
        expect(label?.textContent?.trim(), input.id).toBeTruthy()
      }
      await act(async () => root.render(el('div')))
    }
  })
})

describe('the two-factor prompt (translation only)', () => {
  it('Korean: title, label, hint and buttons in Korean; a wrong code reads in Korean in the same alert', async () => {
    await render(() => el(MFAVerify, { factorId: 'f1', onSuccess: () => null }), 'ko')
    expect(container.querySelector('h1')?.textContent).toBe(authT('ko', 'mfaTitle'))
    expect(container.querySelector('label[for="mfa-code"]')?.textContent).toBe(authT('ko', 'mfaCodeLabel'))
    expect(byId('mfa-code-hint').textContent).toBe(authT('ko', 'mfaCodeHint'))
    expect(button(authT('ko', 'mfaUseBackup'))).toBeDefined()
    expect(container.textContent).not.toMatch(/Two-Factor|Use Backup Code/)
    type('mfa-code', '123456')
    await act(async () => { await new Promise((r) => setTimeout(r, 150)) })
    await settle()
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(alertText()).toContain(authT('ko', 'mfaInvalidCode'))
  })
})

describe('PR #256 review fixes', () => {
  // 37 × "Ж" (2 bytes each) + "Aa1!" = 41 characters but 78 bytes: over the 72-byte limit while
  // well under 72 characters, and strong enough to pass the strength rule.
  const LONG = 'Ж'.repeat(37) + 'Aa1!'
  const updateCalls = () => h.calls.filter((c) => c[0] === 'updateUser' || c[0] === 'signUp')

  it('sign up: a password over 72 bytes shows passwordTooLong before any Supabase call', async () => {
    await render(signup, 'ko')
    type('firstName', 'Ada'); type('email', EMAIL); type('password', LONG); type('confirmPassword', LONG); check('terms')
    await submit()
    expect(alertText()).toContain(authT('ko', 'passwordTooLong'))
    expect(updateCalls()).toHaveLength(0)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('reset: a password over 72 bytes shows passwordTooLong before any Supabase call', async () => {
    await render(reset, 'ar')
    type('new-password', LONG); type('confirm-password', LONG)
    await submit()
    expect(alertText()).toContain(authT('ar', 'passwordTooLong'))
    expect(updateCalls()).toHaveLength(0)
  })

  it('validation_failed with a password within the limit reads the page\'s general line, never an email line', async () => {
    h.results.updateUser = { error: supabaseError('validation_failed', 'Unable to validate input') }
    await render(reset, 'ko'); type('new-password', PASSWORD); type('confirm-password', PASSWORD); await submit()
    expect(alertText()).toContain(authT('ko', 'resetFailed'))
    expect(alertText()).not.toContain(authT('ko', 'emailInvalid'))
    await act(async () => root.render(el('div')))
    h.results.signUp = { error: supabaseError('validation_failed', 'Unable to validate input') }
    await signUp('ko')
    expect(alertText()).toContain(authT('ko', 'signupFailed'))
  })

  it('F2: the password field is described by the real rule and the strength block; the live line speaks only when the word changes', async () => {
    await render(signup, 'ko')
    const pw = byId('password')
    expect(pw.getAttribute('aria-describedby')).toBe('password-hint password-strength')
    expect(byId<HTMLElement>('password-hint').textContent).toBe(authT('ko', 'signupPasswordHint'))
    const live = byId<HTMLElement>('password-strength').querySelector('[aria-live="polite"]') as HTMLElement
    expect(live).not.toBeNull()
    let changes = 0
    const observer = new MutationObserver((records) => { changes += records.length })
    observer.observe(live, { childList: true, subtree: true, characterData: true })
    for (const v of ['a', 'ab', 'abc', 'abcd']) type('password', v) // all "weak"
    type('password', 'abcdefghiJK1!') // strong
    await Promise.resolve()
    observer.disconnect()
    expect(changes).toBe(2) // the line appears once (weak) and changes once (strong): five keystrokes, two updates
    expect(live.textContent).toContain(authT('ko', 'strengthStrong'))
  })

  it('F5: submit buttons grow with their words (no clipped label in long languages)', async () => {
    for (const [page, key] of [[login, null], [signup, 'createAccount'], [forgot, 'sendResetLink'], [reset, 'updatePassword']] as const) {
      await render(page, 'ru')
      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(submitButton.className, String(key)).toMatch(/\bh-auto\b/)
      expect(submitButton.className).toMatch(/\bmin-h-9\b/)
      expect(submitButton.className).toMatch(/\bwhitespace-normal\b/)
      await act(async () => root.render(el('div')))
    }
  })

  it('P7: a resend that worked is said in the always-mounted status line', async () => {
    await signUp('ko')
    const status = container.querySelector('[role="status"]') as HTMLElement
    expect(status).not.toBeNull()
    expect(status.textContent).toBe('')
    await act(async () => button(authT('ko', 'resendEmail')).click())
    await settle()
    expect(status.textContent).toBe(authT('ko', 'resendSent'))
  })

  it('P4 / F3: backup-code verify is aria-disabled when empty, refocuses the field on failure; the back arrow mirrors in RTL', async () => {
    await render(() => el(MFAVerify, { factorId: 'f1', onSuccess: () => null }), 'ar')
    await act(async () => button(authT('ar', 'mfaUseBackup')).click())
    await settle()
    const verify = button(authT('ar', 'mfaVerifyBackup'))
    expect(verify.getAttribute('aria-disabled')).toBe('true')
    expect(verify.disabled).toBe(false)
    const back = button(authT('ar', 'mfaBackToApp'))
    const arrow = back.querySelector('svg') as SVGElement
    expect(arrow.getAttribute('class')).toMatch(/rtl:-scale-x-100/)
    expect(arrow.getAttribute('class')).not.toMatch(/\bmr-2\b/)
    type('mfa-backup-code', 'abcd-1234')
    verify.focus()
    await act(async () => verify.click())
    await settle()
    expect(alertText()).toContain(authT('ar', 'mfaInvalidBackup'))
    expect(document.activeElement).toBe(byId('mfa-backup-code'))
  })
})
