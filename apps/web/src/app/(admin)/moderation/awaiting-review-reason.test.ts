// apps/web/src/app/(admin)/moderation/awaiting-review-reason.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 on the "Awaiting review" queues: a pending business or resource is invisible to members, so its
// row shows the reason ("Not approved — hidden from members") and never a link. The queues load in
// effects (not rendered by react-dom/server), so the row wiring is read from source — aimed at the
// pending block of each file, with a control proving the block is found — and the shared component
// is rendered with the visibility each row passes.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { MemberViewLink } from '@/components/admin/member-view-link'
import { businessVisibility, resourceVisibility } from '@/lib/member-visibility'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (f: string) => fs.readFileSync(path.join(HERE, f), 'utf8')
const between = (src: string, start: string, end: string) => {
  const i = src.indexOf(start)
  const j = src.indexOf(end, i)
  expect(i, `start marker ${start}`).toBeGreaterThan(0) // CONTROL: the block is found
  expect(j, `end marker ${end}`).toBeGreaterThan(i)
  return src.slice(i, j)
}

describe('Awaiting review rows show why members cannot see them', () => {
  it('pending businesses: every row renders the shared control with a pending (not approved) visibility', () => {
    const block = between(read('businesses-tab.tsx'), 'pending.map((item)', 'approved.map((item)')
    expect(block).toContain('<MemberViewLink')
    expect(block).toContain("businessVisibility({ status: 'pending'")
    expect(block).toContain("to={{ kind: 'business', id: item.id }}")
  })

  it('pending resources: every row renders the shared control with its status (forms: not approved)', () => {
    const block = between(read('resources-tab.tsx'), 'filtered.map((item)', '{/* Actions */}')
    expect(block).toContain('<MemberViewLink')
    expect(block).toContain('resourceVisibility(item)')
    expect(block).toContain("contentType === 'form' ? { visible: false, reason: 'not_approved' }")
  })

  it('that visibility renders the reason and no link', () => {
    for (const visibility of [businessVisibility({ status: 'pending', is_active: true }), resourceVisibility({ status: 'pending' })]) {
      const html = renderToStaticMarkup(
        h(MemberViewLink, { to: { kind: 'resource', id: 'r1' }, visibility, label: 'View public page', itemName: 'X', source: 'resources_queue' })
      )
      expect(html).toBe('<span class="inline-flex min-h-6 items-center text-xs text-stone-600">Not approved — hidden from members</span>')
    }
  })

  it('the Removed & Held row text (status, date, reason) uses stone-600 for 1.4.3 contrast on stone-100', () => {
    const block = between(read('reports-queue.tsx'), 'heldPosts.map((post)', 'Authorize Post')
    expect(block).toContain('gap-2 text-xs text-stone-600')
    expect(block).not.toContain('text-stone-500')
  })
})
