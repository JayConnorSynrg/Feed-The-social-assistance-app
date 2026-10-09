// apps/web/src/app/(admin)/moderation/admin-focus.wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 wiring: each admin screen an "Edit in admin" link opens is connected to the focus session —
//   - the owning tabs claim their kind on the tab ADMIN_FOCUS_TAB names (post and safety_alert on
//     moderation, event on events);
//   - the main shell runs the gate only once its tabs are final (tier AND organization roles loaded);
//     the organization page runs it with its own tabs (events only);
//   - the Moderation tab mounts the single-post view.
// The decisions themselves are tested in admin-focus-session.test.ts / use-admin-focus.test.ts.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ADMIN_FOCUS_TAB } from '@/lib/admin-url'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('owning tabs claim their kind on the contract tab', () => {
  it.each([
    ['./focused-post.tsx', 'post'],
    ['./safety-alerts-review.tsx', 'safety_alert'],
    ['./event-scheduler.tsx', 'event'],
  ] as const)('%s claims %s', (file, kind) => {
    expect(read(file)).toContain(`useAdminFocusSession('${kind}', '${ADMIN_FOCUS_TAB[kind]}')`)
  })

  it('the Moderation tab mounts the single-post view and picks its sub-tab from the link', () => {
    const src = read('./moderation-tab.tsx')
    expect(src).toMatch(/<FocusedPost\b/)
    expect(src).toContain('setActiveSubtab(initialModerationSubtab(window.location.search))')
  })
})

describe('the shells run the gate', () => {
  it('main shell: once tier and organization roles are loaded, with its visible tabs', () => {
    const src = read('./admin-shell.tsx')
    expect(src).toContain('useAdminFocusGate(!tierLoading && orgAdminLoaded, tabs, shellOwnerTab)')
    expect(src).toContain('const { isOrgAdmin, loaded: orgAdminLoaded } = useIsOrgAdminState()')
  })

  it('organization page: with its own tabs and the events-only owner', () => {
    expect(read('./org/[id]/org-admin-shell.tsx')).toContain('useAdminFocusGate(true, ORG_ADMIN_TABS, orgPageOwnerTab)')
  })

  it('the organization page Events tab is the shared scheduler (it claims the event focus)', () => {
    expect(read('./org/[id]/org-events-tab.tsx')).toMatch(/<EventScheduler selectedOrgId=\{orgId\}/)
  })
})
