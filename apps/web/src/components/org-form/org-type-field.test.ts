// apps/web/src/components/org-form/org-type-field.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization type in the setup panel: a platform admin can change it (a picker); on the
// organization admin page an organization admin sees the type but cannot change it (a read-only
// field), so a save never asks the server for a type change it refuses (42501 org_save_denied).
// Rendered with react-dom/server; the Sheet is a pass-through so the open panel's form renders.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/components/ui/sheet', () => {
  const pass = (p: { children?: ReactNode }) => h('div', null, p.children)
  return { Sheet: pass, SheetContent: pass, SheetTitle: (p: { children?: ReactNode }) => h('h2', null, p.children) }
})

import { OrgFormPanel } from './org-form-panel'

const render = (canChangeType: boolean | undefined, locale: 'en' | 'es' = 'en') =>
  renderToStaticMarkup(
    h(OrgFormPanel, {
      open: true,
      mode: 'create',
      kind: 'org',
      orgId: null,
      locale,
      onOpenChange: () => {},
      onSaved: () => {},
      ...(canChangeType === undefined ? {} : { canChangeType }),
    })
  )

/** The control labelled "Type" (the label's `for` target). */
function typeControl(html: string): string {
  const label = html.match(/<label for="([^"]+)"[^>]*>(?:Type|Tipo)<\/label>/)
  expect(label, 'type label').not.toBeNull()
  const id = label![1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const ctrl = html.match(new RegExp(`<(select|input)[^>]*id="${id}"[^>]*>`))
  expect(ctrl, 'type control').not.toBeNull()
  return ctrl![0]
}

describe('organization type field', () => {
  it('platform admin (default): a picker offering every organization type', () => {
    for (const html of [render(undefined), render(true)]) {
      const ctrl = typeControl(html)
      expect(ctrl.startsWith('<select')).toBe(true)
      expect(html).toContain('>Food bank</option>')
      expect(html).toContain('>Government</option>')
      expect(ctrl).not.toContain('aria-describedby')
      expect(html).not.toContain('Only a platform admin can change the type.')
      const cls = ctrl.match(/class="([^"]*)"/)![1].split(/\s+/)
      expect(cls).toContain('bg-white')
      expect(cls).not.toContain('bg-stone-100')
    }
  })

  it('organization admin: the current type is shown in a read-only field, with no picker', () => {
    const html = render(false)
    const ctrl = typeControl(html)
    expect(ctrl.startsWith('<input')).toBe(true)
    expect(ctrl).toMatch(/readOnly=""|readonly=""/)
    expect(ctrl).toContain('value="Community"')
    expect(html).not.toContain('>Food bank</option>')
    // Exactly one background: the read-only grey.
    const cls = ctrl.match(/class="([^"]*)"/)![1].split(/\s+/)
    expect(cls).toContain('bg-stone-100')
    expect(cls).not.toContain('bg-white')
  })

  it('organization admin: a visible hint, tied to the field, says who can change the type (translated)', () => {
    for (const [locale, text] of [
      ['en', 'Only a platform admin can change the type.'],
      ['es', 'Solo un administrador de la plataforma puede cambiar el tipo.'],
    ] as const) {
      const html = render(false, locale)
      const ctrl = typeControl(html)
      const hintId = ctrl.match(/aria-describedby="([^"]+)"/)?.[1]
      expect(hintId, locale).toBeDefined()
      const hint = html.match(new RegExp(`<p id="${hintId!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([^<]*)</p>`))
      expect(hint?.[1], locale).toBe(text)
      expect(hint![0]).not.toContain('sr-only')
    }
  })
})
