// apps/web/src/app/(admin)/moderation/orgs-section.org-admin.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Entry points into the organization admin page from the platform Organizations list, and the
// shared roster. Rendered with react-dom/server (the test environment has no DOM): an org row's
// name is a link to /moderation/org/<id>; its More menu offers "Open admin" to the same place; the
// roster in read-only mode shows members without any add / role / remove control; every roster read
// and write is filtered by the organization id.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DropdownMenu as Menu } from 'radix-ui'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { OrgNameLink, OrgRowMenuItems, OrgMembersView, type OrgMembersViewProps } from './orgs-section'
import { addOrgMember, changeOrgMemberRole, fetchOrgMembers, removeOrgMember } from './org-members-data'
import { orgFormT } from '@/lib/i18n-org-forms'

const ORG = '11111111-1111-4111-8111-111111111111'
const tr = (k: Parameters<typeof orgFormT>[1]) => orgFormT('en', k)

describe('platform Organizations list → org admin page', () => {
  it("an org row's name is an underlined link to its admin page, read as '<name> – admin page'", () => {
    const html = renderToStaticMarkup(h(OrgNameLink, { org: { id: ORG, name: 'Rutland Food Shelf' }, tr }))
    expect(html).toMatch(new RegExp(`^<a [^>]*href="/moderation/org/${ORG}"[^>]*>Rutland Food Shelf<span class="sr-only"> – admin page</span></a>$`))
    const cls = html.match(/class="([^"]*)"/)![1].split(/\s+/)
    expect(cls).toContain('underline')
  })

  it('the screen-reader suffix is translated', () => {
    const es = (k: Parameters<typeof orgFormT>[1]) => orgFormT('es', k)
    const html = renderToStaticMarkup(h(OrgNameLink, { org: { id: ORG, name: 'X' }, tr: es }))
    expect(html).toContain('<span class="sr-only"> – página de administración</span>')
  })

  it('the More menu offers "Open admin" linking to the same page (active and inactive orgs)', () => {
    for (const is_active of [true, false]) {
      const html = renderToStaticMarkup(
        h(Menu.Root, { open: true, modal: false }, h(Menu.Trigger, null, 'More'), h(Menu.Content, null, h(OrgRowMenuItems, { org: { id: ORG, is_active }, tr, onToggle: () => {} })))
      )
      const link = html.match(/<a [^>]*role="menuitem"[^>]*>.*?<\/a>/g)?.find((a) => a.includes('Open admin'))
      expect(link, `is_active=${is_active}`).toBeDefined()
      expect(link).toContain(`href="/moderation/org/${ORG}"`)
    }
  })

  it('the list renders those two pieces for every row', () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'orgs-section.tsx'), 'utf8')
    expect(src).toMatch(/<OrgNameLink org=\{org\} tr=\{tr\} \/>/)
    expect(src).toMatch(/<OrgRowMenuItems org=\{org\}/)
  })
})

const MEMBERS = [
  { id: 'm1', user_id: 'u-admin', role: 'admin', joined_at: '2026-10-01T00:00:00Z' },
  { id: 'm2', user_id: 'u-member', role: 'member', joined_at: '2026-10-02T00:00:00Z' },
]
const view = (readOnly: boolean) =>
  renderToStaticMarkup(
    h(OrgMembersView, {
      members: MEMBERS,
      loading: false,
      loadError: null,
      rosterError: null,
      readOnly,
      add: { userId: '', role: 'member', adding: false, error: null },
      onAddUserIdChange: () => {},
      onAddRoleChange: () => {},
      onAdd: () => {},
      onRemove: () => {},
      onChangeRole: () => {},
    } satisfies OrgMembersViewProps)
  )

describe('Members roster', () => {
  it('read-only (organization admin): lists members and roles, offers no add / role change / remove', () => {
    const html = view(true)
    expect(html).toContain('u-admin')
    expect(html).toContain('u-member')
    expect(html).toContain('>Admin<')
    expect(html).toContain('>Member<')
    expect(html).not.toContain('Add Member')
    expect(html).not.toContain('User UUID')
    expect(html).not.toContain('Remove')
    expect(html).not.toContain('role="combobox"')
  })

  it('platform admin: keeps add, a role picker per member, and remove', () => {
    const html = view(false)
    expect(html).toContain('Add Member')
    expect((html.match(/aria-label="Remove member /g) ?? []).length).toBe(2)
    // One role picker per member plus the add-row picker.
    expect((html.match(/role="combobox"/g) ?? []).length).toBe(3)
  })
})

/** Records every builder call; awaiting it resolves to `result`. */
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = []
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m] = (...args: unknown[]) => {
      calls.push([m, ...args])
      return chain
    }
  }
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
  const client = {
    from: (table: string) => {
      calls.push(['from', table])
      return chain
    },
  }
  return { client: client as never, calls }
}

describe('roster reads and writes are scoped to the organization', () => {
  it('reading the roster filters by org_id', async () => {
    const { client, calls } = fakeSupabase({ data: MEMBERS, error: null })
    await expect(fetchOrgMembers(client, ORG)).resolves.toHaveLength(2)
    expect(calls).toContainEqual(['from', 'organization_members'])
    expect(calls).toContainEqual(['eq', 'org_id', ORG])
  })

  it('removing a member filters by member id AND org_id', async () => {
    const { client, calls } = fakeSupabase({ data: [{ id: 'm2' }], error: null })
    await expect(removeOrgMember(client, ORG, 'm2')).resolves.toBeNull()
    expect(calls).toContainEqual(['delete'])
    expect(calls).toContainEqual(['eq', 'id', 'm2'])
    expect(calls).toContainEqual(['eq', 'org_id', ORG])
  })

  it('changing a role filters by member id AND org_id', async () => {
    const { client, calls } = fakeSupabase({ data: [{ id: 'm2' }], error: null })
    await expect(changeOrgMemberRole(client, ORG, 'm2', 'admin')).resolves.toBeNull()
    expect(calls).toContainEqual(['update', { role: 'admin' }])
    expect(calls).toContainEqual(['eq', 'id', 'm2'])
    expect(calls).toContainEqual(['eq', 'org_id', ORG])
  })

  it('a write that matches no row (another org, or refused) reports failure', async () => {
    const { client } = fakeSupabase({ data: [], error: null })
    await expect(removeOrgMember(client, ORG, 'foreign')).resolves.toMatch(/Could not remove/)
    await expect(changeOrgMemberRole(client, ORG, 'foreign', 'member')).resolves.toMatch(/Could not change/)
  })

  it('adding a member writes this org id', async () => {
    const { client, calls } = fakeSupabase({ data: null, error: null })
    await expect(addOrgMember(client, ORG, 'u-new', 'member', 'u-pa')).resolves.toBeNull()
    expect(calls).toContainEqual(['insert', { org_id: ORG, user_id: 'u-new', role: 'member', invited_by: 'u-pa' }])
  })
})
