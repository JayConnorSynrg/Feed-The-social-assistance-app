// apps/web/src/app/(admin)/moderation/event-scheduler.scope.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Security: on an organization's own page (EventScheduler given a real org id) the scheduler
// reads ONLY that org's events and never calls get_admin_org_list (which would read every
// org's name). In the main admin ('all') it reads the orgs the caller administers.
//
// No DOM here (vitest env node): React's hooks are replaced by synchronous stand-ins so the
// component function runs its effects once, against a recording Supabase client.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const rec = vi.hoisted(() => ({ rpc: [] as string[], from: [] as string[], eq: [] as Array<[string, unknown]>, inCalls: [] as string[] }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, () => {}],
    useEffect: (fn: () => void) => {
      fn()
    },
    useMemo: (fn: () => unknown) => fn(),
    useRef: (v: unknown) => ({ current: v }),
    useCallback: (fn: unknown) => fn,
  }
})

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ loading: false, profile: null }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, withMetric: vi.fn(), logEvent: vi.fn() }))

vi.mock('@/lib/supabase/client', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    order: self,
    limit: self,
    eq: (col: string, v: unknown) => {
      rec.eq.push([col, v])
      return chain
    },
    in: (col: string) => {
      rec.inCalls.push(col)
      return chain
    },
    then: () => undefined,
  })
  return {
    createClient: () => ({
      from: (t: string) => {
        rec.from.push(t)
        return chain
      },
      rpc: (name: string) => {
        rec.rpc.push(name)
        return { then: () => undefined }
      },
    }),
  }
})

import { EventScheduler } from './event-scheduler'

beforeEach(() => {
  rec.rpc.length = 0
  rec.from.length = 0
  rec.eq.length = 0
  rec.inCalls.length = 0
})

describe('EventScheduler scope', () => {
  it('a real org id: no get_admin_org_list call; events filtered to that org only', () => {
    EventScheduler({ selectedOrgId: '705c100e-77f3-4807-9788-ff1ab4b26bb1' })
    expect(rec.rpc).not.toContain('get_admin_org_list')
    expect(rec.from).toEqual(['assistance_events'])
    expect(rec.eq).toEqual([['org_id', '705c100e-77f3-4807-9788-ff1ab4b26bb1']])
    expect(rec.inCalls).toEqual([])
  })

  it("'all' (main admin): reads the caller's admin org list", () => {
    EventScheduler({ selectedOrgId: 'all' })
    expect(rec.rpc).toEqual(['get_admin_org_list'])
  })
})
