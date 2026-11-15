// proxy.mfa.test.ts — AAL2 is required on admin surfaces only.
// Members at `/` (and every member route) keep working at AAL1 whether or not they enrolled a factor;
// an MFA-enrolled session that has not verified this session is sent to /login?step=mfa from an
// admin route. Both directions run through the real proxy() with a mocked Supabase client.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NextRequest } from 'next/server'

type Aal = { currentLevel: 'aal1' | 'aal2'; nextLevel: 'aal1' | 'aal2' }
const state: { aal: Aal } = { aal: { currentLevel: 'aal1', nextLevel: 'aal2' } }

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1', is_anonymous: false } } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: state.aal }) },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed: true } }) }) }) }),
  }),
}))

import { proxy } from './proxy'
import { requiresMfa } from '@/lib/mfa-routes'

const ENROLLED_UNVERIFIED: Aal = { currentLevel: 'aal1', nextLevel: 'aal2' }
const NOT_ENROLLED: Aal = { currentLevel: 'aal1', nextLevel: 'aal1' }
const VERIFIED: Aal = { currentLevel: 'aal2', nextLevel: 'aal2' }

async function hit(path: string) {
  const res = await proxy(new NextRequest('http://localhost' + path))
  return { status: res.status, location: res.headers.get('location') }
}
const isMfaRedirect = (r: { status: number; location: string | null }) =>
  r.status === 307 && !!r.location && new URL(r.location).pathname === '/login' && new URL(r.location).searchParams.get('step') === 'mfa'

beforeEach(() => { state.aal = ENROLLED_UNVERIFIED })

describe('members are not asked for MFA', () => {
  it.each([['enrolled, unverified', ENROLLED_UNVERIFIED], ['not enrolled', NOT_ENROLLED], ['verified', VERIFIED]])(
    'a member at / is served the app (%s)', async (_l, aal) => {
      state.aal = aal
      expect(await hit('/')).toEqual({ status: 200, location: null })
    })

  it.each(['/onboarding', '/federation/directory', '/s/post/abc', '/api/client-log', '/auth/callback'])(
    'an enrolled, unverified member reaches %s without an MFA redirect', async (path) => {
      expect(isMfaRedirect(await hit(path))).toBe(false)
    })

  it('/login for an enrolled, unverified member goes to / and stops there (no redirect loop)', async () => {
    const first = await hit('/login')
    expect(first.status).toBe(307)
    expect(new URL(first.location!).pathname).toBe('/')
    expect(await hit('/')).toEqual({ status: 200, location: null })
  })
})

describe('admin surfaces still require MFA', () => {
  it.each(['/moderation', '/moderation/org/123', '/federation', '/federation/dashboard', '/federation/sync-config', '/api/admin/users/x/ban'])(
    'an enrolled, unverified session at %s is sent to /login?step=mfa', async (path) => {
      const r = await hit(path)
      expect(isMfaRedirect(r)).toBe(true)
      expect(new URL(r.location!).searchParams.get('redirectTo')).toBe(path)
    })

  it.each([['verified', VERIFIED], ['not enrolled', NOT_ENROLLED]])('a %s session reaches /moderation (the layout gates the tier)', async (_l, aal) => {
    state.aal = aal
    expect(isMfaRedirect(await hit('/moderation'))).toBe(false)
  })
})

// Every route in the app is classified from the filesystem: admin iff it sits in the (admin)
// group or under api/admin. A new admin page that the list misses, or a member page it
// over-matches, turns this red.
describe('requiresMfa matches exactly the admin routes on disk', () => {
  const appDir = fileURLToPath(new URL('./app', import.meta.url))
  const routes: { url: string; admin: boolean }[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/^(page|route)\.tsx?$/.test(name)) {
        const segs = relative(appDir, dir).split(sep).filter(Boolean)
        const admin = segs[0] === '(admin)' || (segs[0] === 'api' && segs[1] === 'admin')
        const url = '/' + segs.filter((s) => !/^\(.*\)$/.test(s)).map((s) => (s.startsWith('[') ? 'x' : s)).join('/')
        routes.push({ url, admin })
      }
    }
  }
  walk(appDir)

  it('finds both admin and member routes (control)', () => {
    expect(routes.some((r) => r.admin)).toBe(true)
    expect(routes.some((r) => !r.admin && r.url === '/')).toBe(true)
  })

  it('classifies every route', () => {
    for (const r of routes) expect({ url: r.url, mfa: requiresMfa(r.url) }).toEqual({ url: r.url, mfa: r.admin })
  })
})
