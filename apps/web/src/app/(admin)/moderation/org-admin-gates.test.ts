// apps/web/src/app/(admin)/moderation/org-admin-gates.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Organization create/edit entry points are visible to platform admins only. The rule lives in
// canCreateOrganizations (lib/admin-tier.ts); the two UI call sites must route through it. The vitest
// environment has no DOM, so the call-site wiring is asserted on the source of those two files.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canCreateOrganizations } from '@/lib/admin-tier'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

describe('canCreateOrganizations', () => {
  it('is true only for platform admins', () => {
    expect(canCreateOrganizations('platform_admin')).toBe(true)
    for (const t of ['resource_admin', 'community_moderator', null, undefined] as const) {
      expect(canCreateOrganizations(t)).toBe(false)
    }
  })

  it('gates the feed Organizations "Add organization" link', () => {
    const src = read('components/panels/organizations-panel.tsx')
    const links = src.match(/href="\/moderation\?tab=organizations&org=new"/g) ?? []
    expect(links).toHaveLength(1)
    expect(src).toMatch(/\{canCreateOrganizations\(tier\) && \(\s*<a\s+href="\/moderation\?tab=organizations&org=new"/)
  })

  it('gates the admin shell panel and the Overview quick action', () => {
    const src = read('app/(admin)/moderation/admin-shell.tsx')
    expect(src).toMatch(/const canManageOrgs = canCreateOrganizations\(tier\)\n/)
    expect(src).toMatch(/onCreateOrganization=\{canManageOrgs \? /)
    expect(src).toMatch(/\{canManageOrgs && \(\s*<OrgFormPanel\b/)
    expect((src.match(/<OrgFormPanel\b/g) ?? []).length).toBe(1)
  })
})
