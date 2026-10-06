// apps/web/src/app/(admin)/moderation/org/page.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Settings → organization admin routing. An organization admin with no tier is sent from Settings
// to /moderation/org; that page sends a person who administers exactly one organization straight to
// its admin page and shows a list of links to someone who administers several. Any admin tier keeps
// the moderation dashboard entry.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ orgs: [] as Array<{ id: string; name: string; org_type: string }> }))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`)
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (name: string) =>
      name === 'get_admin_org_list' ? { data: state.orgs, error: null } : { data: null, error: { message: 'unexpected' } },
  }),
}))

import OrgAdminIndexPage from './page'
import { adminEntryHref } from '@/lib/org-admin-paths'

const ORG_1 = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Rutland Food Shelf', org_type: 'food_bank' }
const ORG_2 = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Westside Pantry', org_type: 'pantry' }

beforeEach(() => {
  state.orgs = []
})

describe('Settings Administration entry', () => {
  it('no tier (organization admin) → /moderation/org; any tier → /moderation (unchanged)', () => {
    expect(adminEntryHref(null)).toBe('/moderation/org')
    expect(adminEntryHref('community_moderator')).toBe('/moderation')
    expect(adminEntryHref('resource_admin')).toBe('/moderation')
    expect(adminEntryHref('platform_admin')).toBe('/moderation')
  })

  it('the Settings admin link uses that destination', () => {
    const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
    const src = fs.readFileSync(path.join(SRC, 'components/panels/settings-panel.tsx'), 'utf8')
    expect(src).toMatch(/<Link\s+href=\{adminEntryHref\(tier\)\}/)
    expect(src).not.toMatch(/href="\/moderation"/)
  })
})

describe('/moderation/org', () => {
  it('one organization → straight to its admin page', async () => {
    state.orgs = [ORG_1]
    await expect(OrgAdminIndexPage()).rejects.toThrow(`NEXT_REDIRECT;/moderation/org/${ORG_1.id}`)
  })

  it('several organizations → a list linking each one', async () => {
    state.orgs = [ORG_1, ORG_2]
    const html = renderToStaticMarkup(await OrgAdminIndexPage())
    expect(html).toContain(`href="/moderation/org/${ORG_1.id}"`)
    expect(html).toContain(`href="/moderation/org/${ORG_2.id}"`)
    expect(html).toContain('Rutland Food Shelf')
    expect(html).toContain('Westside Pantry')
  })

  it('none → says so, links nothing', async () => {
    const html = renderToStaticMarkup(await OrgAdminIndexPage())
    expect(html).toContain('You do not manage any active organization right now.')
    expect(html).not.toContain('href="/moderation/org/')
  })
})
