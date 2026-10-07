// apps/web/src/app/(admin)/moderation/org/org-overview-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The org Overview counts only this organization's rows: every one of its queries carries the org
// filter (directly on org_id, or on the org_id of an inner-joined event). "Event dates, next 30
// days" counts only dates starting in the next 30 days (a repeating event holds ~6 months of
// generated dates). The ending-soon list comes from org_events_ending_soon for this org; a
// failed load is a logged warning and an error state, never an empty list.

import { describe, it, expect, vi } from 'vitest'

const warn = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } }))

import { fetchEndingSoon, fetchOrgOverview } from './org-overview-data'

const ORG = '11111111-1111-4111-8111-111111111111'

function fakeSupabase(counts: Record<string, number>) {
  const queries: Array<{ table: string; calls: Array<[string, ...unknown[]]> }> = []
  const client = {
    from: (table: string) => {
      const q = { table, calls: [] as Array<[string, ...unknown[]]> }
      queries.push(q)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gte', 'lt']) {
        chain[m] = (...args: unknown[]) => {
          q.calls.push([m, ...args])
          return chain
        }
      }
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ count: counts[table], error: null }).then(res)
      return chain
    },
  }
  return { client: client as never, queries }
}

describe('fetchOrgOverview', () => {
  it("returns this org's four numbers", async () => {
    const { client } = fakeSupabase({ organization_members: 3, assistance_events: 2, event_occurrences: 5, event_checkins: 40 })
    await expect(fetchOrgOverview(client, ORG)).resolves.toEqual({
      members: 3,
      activeEvents: 2,
      upcomingDates: 5,
      checkinsLast30Days: 40,
    })
  })

  it('every query is filtered to this org (inner joins for nested org ids)', async () => {
    const { client, queries } = fakeSupabase({})
    await fetchOrgOverview(client, ORG)
    expect(queries.map((q) => q.table).sort()).toEqual(['assistance_events', 'event_checkins', 'event_occurrences', 'organization_members'])
    for (const q of queries) {
      const filter = q.calls.find((c) => c[0] === 'eq' && /(^|\.)org_id$/.test(String(c[1])))
      expect(filter, q.table).toBeDefined()
      expect(filter![2], q.table).toBe(ORG)
      const nested = String(filter![1]).includes('.')
      if (nested) {
        const select = String(q.calls.find((c) => c[0] === 'select')?.[1])
        expect(select, q.table).toMatch(/!inner/)
      }
    }
  })

  it('a failed count is an error, not a zero', async () => {
    const client = {
      from: () => {
        const chain: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'gte', 'lt']) chain[m] = () => chain
        chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ count: null, error: { message: 'denied' } }).then(res)
        return chain
      },
    }
    await expect(fetchOrgOverview(client as never, ORG)).rejects.toThrow('denied')
  })
})

describe('upcoming dates = the next 30 days', () => {
  it('counts upcoming, not-ended dates that START within 30 days of now', async () => {
    const { client, queries } = fakeSupabase({})
    const now = new Date('2026-10-07T12:00:00.000Z')
    await fetchOrgOverview(client, ORG, now)
    const dates = queries.find((q) => q.table === 'event_occurrences')!
    expect(dates.calls).toContainEqual(['eq', 'status', 'upcoming'])
    expect(dates.calls).toContainEqual(['gte', 'ends_at', '2026-10-07T12:00:00.000Z'])
    expect(dates.calls).toContainEqual(['lt', 'starts_at', '2026-11-06T12:00:00.000Z'])
  })
})

describe('fetchEndingSoon', () => {
  function rpcClient(result: { data: unknown; error: { code?: string; message: string } | null }) {
    const calls: Array<[string, unknown]> = []
    return {
      calls,
      client: { rpc: (name: string, args: unknown) => (calls.push([name, args]), Promise.resolve(result)) } as never,
    }
  }

  it("asks for THIS org's series ending within 30 days and maps the rows", async () => {
    const sb = rpcClient({
      data: [
        { event_id: 'e-1', title: 'Saturday pantry', last_local_date: '2026-10-31', remaining_dates: 4 },
        { event_id: 'e-2', title: 'Clinic', last_local_date: '2026-09-30', remaining_dates: 0 },
      ],
      error: null,
    })
    await expect(fetchEndingSoon(sb.client, ORG)).resolves.toEqual({
      ok: true,
      series: [
        { eventId: 'e-1', title: 'Saturday pantry', lastDate: '2026-10-31', remaining: 4 },
        { eventId: 'e-2', title: 'Clinic', lastDate: '2026-09-30', remaining: 0 },
      ],
    })
    expect(sb.calls).toEqual([['org_events_ending_soon', { p_org_id: ORG, p_within_days: 30 }]])
  })

  it('a refused / failed load: warn row admin.event.ending_soon.load_failed with the SQLSTATE, and an error (not an empty list)', async () => {
    warn.mockClear()
    const sb = rpcClient({ data: null, error: { code: '42501', message: 'event_denied: ...' } })
    await expect(fetchEndingSoon(sb.client, ORG)).resolves.toEqual({ ok: false })
    expect(warn).toHaveBeenCalledWith('admin.event.ending_soon.load_failed', { code: '42501', org_id: ORG })
  })
})
