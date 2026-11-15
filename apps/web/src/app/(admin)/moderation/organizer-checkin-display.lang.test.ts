// apps/web/src/app/(admin)/moderation/organizer-checkin-display.lang.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The check-in kiosk is portalled to <body>, so it would inherit the member's <html lang dir>
// (Arabic: right to left). Its copy is English: the content says so itself, and the date line
// carries the viewer's locale.

import { describe, it, expect, vi } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: async () => ({ data: null, error: null }) }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { mount, findAll } from '@/test/mini-react'
import { OrganizerCheckinDisplay } from './organizer-checkin-display'

describe('organizer check-in display', () => {
  it('Arabic viewer: the kiosk content is lang="en" dir="ltr"; the date line is Arabic', () => {
    const occurrence = { id: 'o1', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T17:00:00Z', event_title: 'Pantry', org_name: 'Org', time_zone: 'America/New_York' }
    const m = mount(() => OrganizerCheckinDisplay({ occurrence, open: false, onOpenChange: () => {}, locale: 'ar' }))
    const content = findAll(m.tree(), (el) => el.type === DialogPrimitive.Content)[0]
    expect(content.props).toMatchObject({ lang: 'en', dir: 'ltr' })
    const dated = findAll(content, (el) => el.props.lang === 'ar')
    expect(dated.length).toBeGreaterThan(0)
    expect(dated[0].props.dir).toBe('rtl')
  })
})
