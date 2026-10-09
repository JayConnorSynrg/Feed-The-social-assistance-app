// apps/web/src/app/(admin)/moderation/resource-edit-dialog.a11y.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The resource edit dialog an "Edit in admin" link lands on (the REAL dialog, driven by the SSR hook
// harness; the Radix dialog shell is rendered inline):
//   - every one of its 12 field labels names its control (<label for> = the control's id), so the
//     focused field announces "Name", "City", …;
//   - the caller's onCloseAutoFocus reaches Radix's DialogContent (a link-opened dialog has no trigger,
//     so the Manage tab decides where focus returns — see manage-resources-tab.focus.test.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactNode } from 'react'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  return reactWithHarness(await importOriginal<typeof import('react')>())
})
const { contentProps } = vi.hoisted(() => ({ contentProps: [] as Array<Record<string, unknown>> }))
vi.mock('@/components/ui/dialog', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  const pass = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  return {
    Dialog: pass,
    DialogHeader: pass,
    DialogTitle: pass,
    DialogDescription: pass,
    DialogFooter: pass,
    DialogContent: (props: Record<string, unknown> & { children?: ReactNode }) => {
      contentProps.push(props)
      return createElement('div', { role: 'dialog' }, props.children)
    },
  }
})
vi.mock('@/lib/supabase/client', () => {
  const client = {}
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/privileged-action', () => ({ privilegedRpc: vi.fn() }))

import { harness } from '@/test-utils/ssr-hook-harness'
import { ResourceEditDialog, type ResourceEditDialogInput } from './resource-edit-dialog'

const resource: ResourceEditDialogInput = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Riverside Pantry',
  description: '',
  category: 'food',
  address_line1: '1 Main St',
  city: 'Burlington',
  state: 'VT',
  zip_code: '05401',
  phone: '',
  email: '',
  website: '',
  status: 'approved',
  service_mode: 'physical',
  lat: 44.48,
  lng: -73.21,
  geocode_accuracy: 'rooftop',
}

beforeEach(() => {
  harness.reset()
  contentProps.length = 0
})

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('ResourceEditDialog accessibility', () => {
  it('all 12 labels name their control (for = id), each id unique', async () => {
    const html = await harness.settle(
      h(ResourceEditDialog, { open: true, resource, mode: 'edit', onOpenChange: () => {}, onSaved: () => {} })
    )
    const labels = [...html.matchAll(/<label[^>]*for="([^"]+)"[^>]*>([^<]+)<\/label>/g)].map((m) => ({ id: m[1], text: m[2] }))
    expect(labels.map((l) => l.text)).toEqual([
      'Name', 'Description', 'Category', 'Status', 'Service mode', 'Address', 'City', 'State', 'ZIP', 'Phone', 'Email', 'Website',
    ])
    expect(new Set(labels.map((l) => l.id)).size).toBe(12)
    for (const { id, text } of labels) {
      const controls = html.match(new RegExp(`<(input|textarea|select)[^>]*\\bid="${escapeRegExp(id)}"`, 'g')) ?? []
      expect(controls, text).toHaveLength(1)
    }
    expect(html).toMatch(/<input[^>]*id="[^"]*-name"[^>]*value="Riverside Pantry"/)
  })

  it("passes the caller's onCloseAutoFocus to DialogContent", async () => {
    const onCloseAutoFocus = vi.fn()
    await harness.settle(
      h(ResourceEditDialog, { open: true, resource, mode: 'edit', onOpenChange: () => {}, onSaved: () => {}, onCloseAutoFocus })
    )
    expect(contentProps.at(-1)?.onCloseAutoFocus).toBe(onCloseAutoFocus)
  })
})
