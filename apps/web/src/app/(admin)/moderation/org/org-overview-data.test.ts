// apps/web/src/app/(admin)/moderation/org/org-overview-data.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The org Overview counts only this organization's rows: every one of its queries carries the org
// filter (directly on org_id, or on the org_id of an inner-joined event).

import { describe, it, expect } from 'vitest'
import { fetchOrgOverview } from './org-overview-data'

const ORG = '11111111-1111-4111-8111-111111111111'

function fakeSupabase(counts: Record<string, number>) {
  const queries: Array<{ table: string; calls: Array<[string, ...unknown[]]> }> = []
  const client = {
    from: (table: string) => {
      const q = { table, calls: [] as Array<[string, ...unknown[]]> }
      queries.push(q)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gte']) {
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
        for (const m of ['select', 'eq', 'gte']) chain[m] = () => chain
        chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ count: null, error: { message: 'denied' } }).then(res)
        return chain
      },
    }
    await expect(fetchOrgOverview(client as never, ORG)).rejects.toThrow('denied')
  })
})
