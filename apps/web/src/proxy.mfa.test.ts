// proxy.mfa.test.ts — AAL2 is required on admin surfaces only.
// Members at `/` (and every member route) keep working at AAL1 whether or not they enrolled a factor;
// an MFA-enrolled session that has not verified this session is sent to /login?step=mfa from an
// admin route. Both directions run through the real proxy() with a mocked Supabase client.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NextRequest } from 'next/server'

type Aal = { currentLevel: 'aal1' | 'aal2'; nextLevel: 'aal1' | 'aal2' }
// state.aal is what the session cookie says; state.factor is what the auth server (getUser) says.
// By default the server agrees with the cookie (a verified factor iff nextLevel is aal2).
const state: { aal: Aal | 'error' | 'returned-error'; signedIn: boolean; factor: boolean | null; aalCalls: number } = {
  aal: { currentLevel: 'aal1', nextLevel: 'aal2' }, signedIn: true, factor: null, aalCalls: 0,
}
const serverHasFactor = () => state.factor ?? (typeof state.aal === 'string' || state.aal.nextLevel === 'aal2')

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: state.signedIn
            ? { id: 'u1', is_anonymous: false, factors: serverHasFactor() ? [{ id: 'f1', status: 'verified' }] : [] }
            : null,
        },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => {
          state.aalCalls++
          if (state.aal === 'error') throw new Error('aal lookup failed')
          if (state.aal === 'returned-error') return { data: null, error: { message: 'aal lookup failed' } }
          return { data: state.aal, error: null }
        },
      },
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

beforeEach(() => { state.aal = ENROLLED_UNVERIFIED; state.signedIn = true; state.factor = null; state.aalCalls = 0 })

describe('members are not asked for MFA', () => {
  it.each([['enrolled, unverified', ENROLLED_UNVERIFIED], ['not enrolled', NOT_ENROLLED], ['verified', VERIFIED]])(
    'a member at / is served the app (%s)', async (_l, aal) => {
      state.aal = aal
      expect(await hit('/')).toEqual({ status: 200, location: null })
    })

  it.each(['/onboarding', '/s/post/abc', '/api/client-log', '/api/geocode', '/auth/callback'])(
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
  it.each(['/moderation', '/moderation/org/123', '/federation', '/federation/dashboard', '/federation/sync-config', '/federation/directory',
    '/api/admin/users/x/ban', '/api/community-summary'])(
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
const ADMIN_GATE = /rpc\(\s*['"](is_current_user_admin|current_user_tier|is_org_admin_any)['"]/

describe('requiresMfa matches exactly the admin routes on disk', () => {
  const appDir = fileURLToPath(new URL('./app', import.meta.url))
  const routes: { url: string; admin: boolean }[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/^(page|route)\.tsx?$/.test(name)) {
        const segs = relative(appDir, dir).split(sep).filter(Boolean)
        // Admin-only = in the (admin) group, or gated by an admin RPC in the file itself or in a
        // layout above it (is_current_user_admin / current_user_tier / is_org_admin_any).
        const gated = [join(dir, name), ...segs.map((_, i) => join(appDir, ...segs.slice(0, i + 1), 'layout.tsx'))]
          .some((f) => { try { return ADMIN_GATE.test(readFileSync(f, 'utf8')) } catch { return false } })
        const admin = segs[0] === '(admin)' || gated
        const url = '/' + segs.filter((s) => !/^\(.*\)$/.test(s)).map((s) => (s.startsWith('[') ? 'x' : s)).join('/')
        routes.push({ url, admin })
      }
    }
  }
  walk(appDir)

  it('finds both admin and member routes (control)', () => {
    expect(routes.some((r) => r.admin)).toBe(true)
    // the gate grep finds the admin pages and APIs outside the (admin) group
    expect(routes.filter((r) => r.admin && !r.url.startsWith('/moderation')).map((r) => r.url)).toEqual(
      expect.arrayContaining(['/federation/directory', '/api/community-summary', '/api/admin/users/x/ban']))
    expect(routes.some((r) => !r.admin && r.url === '/')).toBe(true)
  })

  it('classifies every route', () => {
    for (const r of routes) expect({ url: r.url, mfa: requiresMfa(r.url) }).toEqual({ url: r.url, mfa: r.admin })
  })
})

describe('MFA step-up prompt at /login?step=mfa', () => {
  it('is served to an enrolled, unverified session (with and without redirectTo)', async () => {
    expect(await hit('/login?step=mfa&redirectTo=%2Fmoderation')).toEqual({ status: 200, location: null })
    expect(await hit('/login?step=mfa')).toEqual({ status: 200, location: null })
  })

  it('the admin redirect keeps the query, so the code brings the admin back to that view', async () => {
    const r = await hit('/moderation?tab=businesses')
    expect(new URL(r.location!).searchParams.get('redirectTo')).toBe('/moderation?tab=businesses')
  })

  it.each([['not enrolled', NOT_ENROLLED], ['verified', VERIFIED]])('a %s member at /login?step=mfa still goes to /', async (_l, aal) => {
    state.aal = aal
    const r = await hit('/login?step=mfa&redirectTo=%2Fmoderation')
    expect(r.status).toBe(307)
    expect(new URL(r.location!).pathname).toBe('/')
  })

  it('an enrolled, unverified member at /login without step=mfa still goes to /', async () => {
    const r = await hit('/login')
    expect(new URL(r.location!).pathname).toBe('/')
  })

  it.each(['//evil.com', 'https://evil.com', '/\\evil', '/\t/evil.com'])('drops an off-origin redirectTo %j', async (bad) => {
    const r = await hit('/login?step=mfa&redirectTo=' + encodeURIComponent(bad))
    expect(r.status).toBe(307)
    const to = new URL(r.location!)
    expect(to.origin).toBe('http://localhost')
    expect(to.pathname).toBe('/login')
    expect(to.searchParams.get('step')).toBe('mfa')
    expect(to.searchParams.has('redirectTo')).toBe(false)
    // and the cleaned URL is then served (no loop)
    expect(await hit(to.pathname + to.search)).toEqual({ status: 200, location: null })
  })
})

describe('an unreadable assurance level fails closed', () => {
  it.each(['error', 'returned-error'] as const)('%s: an admin route sends to / and / is served', async (kind) => {
    state.aal = kind
    const r = await hit('/moderation')
    expect(new URL(r.location!).pathname).toBe('/')
    expect(await hit('/')).toEqual({ status: 200, location: null })
  })
})

describe('no redirect loop from any assurance level and route', () => {
  const STATES: Array<[string, () => void]> = [
    ['signed out', () => { state.signedIn = false }],
    ['not enrolled', () => { state.aal = NOT_ENROLLED }],
    ['enrolled, unverified', () => { state.aal = ENROLLED_UNVERIFIED }],
    ['verified', () => { state.aal = VERIFIED }],
    ['aal lookup error', () => { state.aal = 'error' }],
    ['aal returned error', () => { state.aal = 'returned-error' }],
  ]
  const ROUTES = ['/', '/login', '/login?step=mfa', '/login?step=mfa&redirectTo=%2Fmoderation', '/signup', '/onboarding',
    '/moderation', '/moderation?tab=people', '/federation', '/federation/dashboard', '/federation/directory', '/api/admin/users/x/ban', '/s/post/x']

  for (const [label, setup] of STATES) {
    it.each(ROUTES)(`${label}: %s settles within 4 hops, and an admin route is served only without a pending step-up`, async (start) => {
      setup()
      let path = start
      const seen = new Set<string>()
      for (let hop = 0; hop < 4; hop++) {
        expect(seen.has(path)).toBe(false)
        seen.add(path)
        const r = await hit(path)
        if (r.status !== 307) {
          // Signed out, the proxy passes /api/* through and the admin handlers answer 401 themselves
          // (api/admin/users/[id]/{ban,delete}/route.ts); signed-out pages go to /login.
          if (requiresMfa(path.split('?')[0]) && !(label === 'signed out' && path.startsWith('/api/'))) {
            expect(['not enrolled', 'verified']).toContain(label)
          }
          return
        }
        const to = new URL(r.location!)
        expect(to.origin).toBe('http://localhost')
        path = to.pathname + to.search
      }
      throw new Error(`no terminal response from ${start}`)
    })
  }
})

describe('whether the user holds a verified factor comes from the auth server, not the cookie', () => {
  it('a verified factor on the server with a cookie claiming none still needs step-up', async () => {
    state.aal = NOT_ENROLLED // cookie: nextLevel aal1
    state.factor = true // server: verified factor
    expect(isMfaRedirect(await hit('/moderation'))).toBe(true)
  })

  it('a member with no factor on the server is never asked, and the cookie is not read', async () => {
    state.aal = ENROLLED_UNVERIFIED
    state.factor = false
    expect(isMfaRedirect(await hit('/moderation'))).toBe(false)
    expect(await hit('/')).toEqual({ status: 200, location: null })
    expect(state.aalCalls).toBe(0)
  })
})
