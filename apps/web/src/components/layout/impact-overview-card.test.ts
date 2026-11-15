// apps/web/src/components/layout/impact-overview-card.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a visitor or member sees in the Impact overview card (specs/impact-metrics-contract.md):
//   - directory figures in full; a suppressed community figure is the line "Not enough activity yet to share",
//     never a number (not 0, not the value a malformed answer carried);
//   - titled Community reach until an outcome figure is shown, then Community impact (an output alone keeps Reach);
//   - the reader's language, direction and digits (es, ar);
//   - a loading line; a failed read says so with Retry, and Retry reads again;
//   - one read per shell mount however often the shell re-renders (panel switches), one fetch row per read
//     and one impact.view row per mount;
//   - the shell shows this card in place of the old placeholder.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({
  calls: [] as string[],
  replies: [] as Array<{ data: unknown; error: unknown }>,
  rows: [] as Array<{ event: string; attrs: Record<string, unknown> }>,
  views: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => h.views.push({ name, attrs: { ...attrs } }),
  // Same contract as the real one: exactly one row per operation, attrs read when the row is written.
  withMetric: async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>) => {
    try {
      const out = await fn()
      h.rows.push({ event: `${op}.complete`, attrs: { ...attrs } })
      return out
    } catch (e) {
      h.rows.push({ event: `${op}.error`, attrs: { ...attrs, error_code: (e as { code?: string }).code ?? (e as Error).message } })
      throw e
    }
  },
}))

vi.mock('@/lib/supabase/client', () => {
  const client = {
    rpc(fn: string) {
      h.calls.push(fn)
      return Promise.resolve(h.replies.shift() ?? { data: null, error: { code: 'PGRST202', message: 'not found' } })
    },
  }
  return { createClient: () => client }
})

vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { mount } from '@/test/mini-react'
import { ImpactOverview, ImpactOverviewCard } from './impact-overview-card'
import { useCommunityImpact, type ImpactState } from '@/hooks/use-community-impact'
import { formatCount } from '@/lib/i18n-intl'
import { impactMessages } from '@/lib/i18n-impact'
import type { ImpactSummary } from '@/lib/community-impact'

const fig = (value: number | null, suppressed = value === null, window: 'all_time' | 'next_30_days' = 'all_time') => ({ value, suppressed, unit: 'x', window })

/** Prod on 2026-11-15: directory figures shown, every community figure suppressed. */
const TODAY = {
  resources_available: fig(19121),
  resources_curated: fig(181),
  snap_retailers: fig(251574),
  zip_codes_covered: fig(16704),
  organizations_listed: fig(2),
  event_dates_next_30_days: fig(5, false, 'next_30_days'),
  petition_signers: fig(null),
  needs_met: fig(null),
  people_served_at_events: fig(null),
  alerts_verified: fig(null),
  member_resources_approved: fig(null),
}

const html = (state: ImpactState, locale: Parameters<typeof ImpactOverview>[0]['locale'] = 'en') =>
  renderToStaticMarkup(createElement(ImpactOverview, { state, locale, onRetry: () => {} })).replace(/&#x27;/g, "'")
const ready = (summary: ImpactSummary): ImpactState => ({ status: 'ready', summary })
const en = impactMessages.en
const count = (s: string, needle: string) => s.split(needle).length - 1
const liOf = (s: string, id: string) => s.match(new RegExp(`<li data-figure="${id}"[^>]*>(.*?)</li>`))?.[1] ?? ''

beforeEach(() => {
  h.calls.length = 0
  h.replies.length = 0
  h.rows.length = 0
  h.views.length = 0
})

describe('figures as the server answered them', () => {
  it('today: directory figures in full, every community figure as the suppressed line, titled Community reach', () => {
    const out = html(ready(TODAY))
    expect(out).toContain(`>${en.titleReach}</h3>`)
    expect(out).not.toContain(en.titleImpact)
    expect(liOf(out, 'resources_available')).toContain(formatCount(19121, 'en'))
    expect(liOf(out, 'snap_retailers')).toContain(formatCount(251574, 'en'))
    expect(liOf(out, 'event_dates_next_30_days')).toContain('>5<')
    expect(count(out, en.suppressed)).toBe(5)
    for (const id of ['petition_signers', 'needs_met', 'people_served_at_events', 'alerts_verified', 'member_resources_approved']) {
      expect(liOf(out, id)).toContain(en.suppressed)
      expect(liOf(out, id)).not.toMatch(/>\d/)
    }
  })

  it('a suppressed figure never shows a number, whatever value came with it', () => {
    const out = html(ready({ ...TODAY, needs_met: { value: 12, suppressed: true, unit: 'x', window: 'all_time' }, alerts_verified: fig(0, true) }))
    expect(liOf(out, 'needs_met')).toContain(en.suppressed)
    expect(liOf(out, 'needs_met')).not.toContain('12')
    expect(liOf(out, 'alerts_verified')).toContain(en.suppressed)
    expect(liOf(out, 'alerts_verified')).not.toContain('>0<')
  })

  it('a figure marked shown but carrying no number is the suppressed line too', () => {
    const out = html(ready({ ...TODAY, member_resources_approved: { value: null, suppressed: false, unit: 'x', window: 'all_time' } }))
    expect(liOf(out, 'member_resources_approved')).toContain(en.suppressed)
  })

  it('one outcome figure shown: titled Community impact, its rounded count in place', () => {
    const out = html(ready({ ...TODAY, needs_met: fig(15) }))
    expect(out).toContain(`>${en.titleImpact}</h3>`)
    expect(out).not.toContain(en.titleReach)
    expect(liOf(out, 'needs_met')).toContain('>15<')
    expect(count(out, en.suppressed)).toBe(4)
  })

  it('an output shown alone (petition signers) keeps the card titled Community reach', () => {
    const out = html(ready({ ...TODAY, petition_signers: fig(10) }))
    expect(out).toContain(`>${en.titleReach}</h3>`)
    expect(out).not.toContain(en.titleImpact)
  })

  it('the card is a region named by its title, with the How we count notes as text', () => {
    const out = html(ready(TODAY))
    const id = out.match(/<section aria-labelledby="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(out).toContain(`<h3 id="${id}"`)
    expect(out).toContain(`>${en.howWeCount}</summary>`)
    expect(out).toContain(en.noteGeneral)
    expect(out).toContain(en.noteNeedsMet)
  })
})

describe('in the reader language', () => {
  it('es: Spanish title, labels and suppressed line; Spanish digit grouping', () => {
    const out = html(ready(TODAY), 'es')
    expect(out).toContain('lang="es"')
    expect(out).toContain('dir="ltr"')
    expect(out).toContain(`>${impactMessages.es.titleReach}</h3>`)
    expect(out).toContain(impactMessages.es.label_snap_retailers)
    expect(liOf(out, 'snap_retailers')).toContain(formatCount(251574, 'es'))
    expect(count(out, impactMessages.es.suppressed)).toBe(5)
    expect(out).not.toContain(en.suppressed)
  })

  it('ar: right-to-left, Arabic title and the locale digits', () => {
    const out = html(ready(TODAY), 'ar')
    expect(out).toContain('lang="ar"')
    expect(out).toContain('dir="rtl"')
    expect(out).toContain(`>${impactMessages.ar.titleReach}</h3>`)
    expect(liOf(out, 'resources_available')).toContain(formatCount(19121, 'ar'))
  })
})

describe('loading and failure', () => {
  it('loading: a status line, no figures', () => {
    const out = html({ status: 'loading' })
    expect(out).toContain(`<p role="status"`)
    expect(out).toContain(en.loading)
    expect(out).not.toContain('data-figure')
  })

  it('failed: the failure sentence as an alert and a Retry button, never server text', () => {
    const out = html({ status: 'error' })
    expect(out).toContain(`<p role="alert"`)
    expect(out).toContain(en.loadFailed)
    expect(out).toMatch(new RegExp(`<button type="button"[^>]*>${en.retry}</button>`))
  })
})

describe('one read per shell mount', () => {
  const probe = () => {
    let panel = 'overview'
    const m = mount(() => {
      void panel // the shell re-renders with every panel switch; the card's inputs do not change
      return useCommunityImpact('overview')
    })
    return { m, switchTo: (p: string) => ((panel = p), m.rerender()) }
  }

  it('re-renders across panel switches make one RPC call and reuse the answer', async () => {
    h.replies.push({ data: TODAY, error: null })
    const { m, switchTo } = probe()
    for (const p of ['map', 'feed', 'chat', 'settings', 'overview']) switchTo(p)
    await m.flush()
    for (const p of ['map', 'feed']) switchTo(p)
    expect(h.calls).toEqual(['community_impact_summary'])
    expect(m.tree().state.status).toBe('ready')
  })

  it('writes one impact.summary.fetch.complete row with surface, outcome and suppressed_count', async () => {
    h.replies.push({ data: TODAY, error: null })
    const { m } = probe()
    await m.flush()
    expect(h.rows).toEqual([{ event: 'impact.summary.fetch.complete', attrs: { surface: 'overview', outcome: 'ok', suppressed_count: 5 } }])
  })

  it('a failed read shows the error state and writes one .error row; Retry makes one new read that succeeds', async () => {
    h.replies.push({ data: null, error: { code: '42501', message: 'permission denied' } })
    const { m } = probe()
    await m.flush()
    expect(m.tree().state.status).toBe('error')
    expect(h.rows).toEqual([{ event: 'impact.summary.fetch.error', attrs: { surface: 'overview', outcome: 'failed', suppressed_count: 0, error_code: '42501' } }])

    h.replies.push({ data: TODAY, error: null })
    m.tree().retry()
    expect(m.rerender().state.status).toBe('loading')
    await m.flush()
    expect(h.calls).toHaveLength(2)
    expect(m.tree().state.status).toBe('ready')
  })

  it('an answer with no known figure is a failed read, not an empty card', async () => {
    h.replies.push({ data: { something_else: 1 }, error: null })
    const { m } = probe()
    await m.flush()
    expect(m.tree().state.status).toBe('error')
    expect(h.rows[0].event).toBe('impact.summary.fetch.error')
  })

  it('the card writes one impact.view row per mount, however often it re-renders', async () => {
    h.replies.push({ data: TODAY, error: null })
    const m = mount(() => ImpactOverviewCard({ surface: 'overview' }))
    await m.flush()
    m.rerender()
    m.rerender()
    expect(h.views).toEqual([{ name: 'impact.view', attrs: { surface: 'overview', suppressed_count: 5 } }])
    expect((m.tree().props as { state: ImpactState }).state.status).toBe('ready')
  })
})

describe('the shell', () => {
  it('MetricsSection renders the Impact overview card in place of the placeholder', () => {
    const src = readFileSync(fileURLToPath(new URL('./feed-shell.tsx', import.meta.url)), 'utf8')
    const section = src.slice(src.indexOf('function MetricsSection'), src.indexOf('// MOBILE BOTTOM NAV'))
    expect(section).toContain('<ImpactOverviewCard surface="overview" />')
    expect(src).not.toContain('Community impact metrics are on the way')
  })
})
