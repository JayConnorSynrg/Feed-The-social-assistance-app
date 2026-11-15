// apps/web/src/app/(admin)/moderation/petition-export-section.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What an admin in any of the 14 locales hears in the petition download section:
//   F1  the section carries the admin's language and direction;
//   F2  a download announces "Preparing CSV…" in the status line, then the count; an error clears
//       the status line before the alert speaks; aria-busy sits on the button only;
//   F3  the picker holds member text (petition titles) of unknown language: lang="" dir="auto",
//       while its label keeps the section's language;
//   F4  the button is dimmed only when no petition is selected, never just because it is busy;
//   F6  a load failure is written into the one always-mounted alert region.

import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/privileged-action', () => ({ privilegedFetch: vi.fn() }))

import { PetitionExportView, type PetitionExportViewProps } from './petition-export-section'
import { IDLE_UI, finishedUi, startedUi, type ExportUi } from './petition-export-run'
import { adminPetitionsMessages } from '@/lib/i18n-admin-petitions'

const P1 = { id: '11111111-2222-4333-8444-555555555555', title: 'Save the library', exported_at: null }
const P2 = { id: '22222222-2222-4333-8444-555555555555', title: 'حديقة الحي', exported_at: null }

function render(over: Partial<PetitionExportViewProps> = {}): string {
  const props: PetitionExportViewProps = {
    locale: 'en',
    pickerId: 'pk',
    petitions: [P1, P2],
    loadFailed: false,
    selectedId: P1.id,
    ui: IDLE_UI,
    onSelect: () => {},
    onDownload: () => {},
    ...over,
  }
  return renderToStaticMarkup(createElement(PetitionExportView, props))
}

const tag = (html: string, name: string) => html.match(new RegExp(`<${name}\\b[^>]*>`))?.[0] ?? ''
const alertRegion = (html: string) => html.match(/<div role="alert"[^>]*>([\s\S]*?)<\/div>/)
const statusLine = (html: string) => html.match(/<p role="status"[^>]*>([\s\S]*?)<\/p>/)?.[1]

describe('F1 — the section speaks the admin language', () => {
  it('Arabic: lang="ar" dir="rtl" on the section, copy in Arabic', () => {
    const html = render({ locale: 'ar' })
    expect(tag(html, 'section')).toMatch(/lang="ar"/)
    expect(tag(html, 'section')).toMatch(/dir="rtl"/)
    expect(html).toContain(adminPetitionsMessages.ar.heading)
  })

  it('Hmong: lang="hmn" dir="ltr"', () => {
    const s = tag(render({ locale: 'hmn' }), 'section')
    expect(s).toMatch(/lang="hmn"/)
    expect(s).toMatch(/dir="ltr"/)
  })
})

describe('F3 — petition titles are member text of unknown language', () => {
  it('the select carries lang="" dir="auto"; the label carries no lang of its own (inherits the section)', () => {
    const html = render({ locale: 'es' })
    const select = tag(html, 'select')
    expect(select).toMatch(/lang=""/)
    expect(select).toMatch(/dir="auto"/)
    expect(tag(html, 'label')).not.toMatch(/lang=/)
    expect(html).toContain(`>${adminPetitionsMessages.es.petitionLabel}</label>`)
  })

  it('F5: the select border is stone-500', () => {
    expect(tag(render(), 'select')).toMatch(/border-stone-500/)
  })
})

describe('F2 — every state is heard', () => {
  const text = { downloaded: (n: number) => `Downloaded. Signatures in the file: ${n}`, error: () => 'The download failed.' }

  it('starting a download puts "Preparing CSV…" in the status line and clears the alert', () => {
    const ui = startedUi(adminPetitionsMessages.en.downloading)
    expect(ui).toEqual({ busy: true, status: 'Preparing CSV…', error: null })
    const html = render({ ui })
    expect(statusLine(html)).toBe('Preparing CSV…')
    expect(alertRegion(html)?.[1]).toBe('')
  })

  it('an error clears the status line, then the alert speaks', () => {
    const ui = finishedUi(startedUi('Preparing CSV…'), { status: 'error', code: 'incomplete' }, text)
    expect(ui).toEqual({ busy: false, status: null, error: 'The download failed.' })
    const html = render({ ui })
    expect(statusLine(html)).toBe('')
    expect(alertRegion(html)?.[1]).toBe('The download failed.')
  })

  it('done: the status line gives the count', () => {
    const ui = finishedUi(startedUi('x'), { status: 'done', rowCount: 1200 }, text)
    expect(statusLine(render({ ui }))).toBe('Downloaded. Signatures in the file: 1200')
  })

  it('a refused second tap changes nothing', () => {
    const ui: ExportUi = startedUi('Preparing CSV…')
    expect(finishedUi(ui, { status: 'busy' }, text)).toBe(ui)
  })

  it('aria-busy is on the button only', () => {
    const html = render({ ui: startedUi('Preparing CSV…') })
    expect(html.match(/aria-busy/g)).toHaveLength(1)
    expect(tag(html, 'button')).toMatch(/aria-busy="true"/)
  })
})

describe('F4 — dimmed only without a selection', () => {
  it('busy with a petition selected: not dimmed', () => {
    expect(tag(render({ ui: startedUi('x') }), 'button')).not.toMatch(/opacity-70/)
  })

  it('no petition selected: dimmed and aria-disabled', () => {
    const button = tag(render({ selectedId: '' }), 'button')
    expect(button).toMatch(/opacity-70/)
    expect(button).toMatch(/aria-disabled="true"/)
  })
})

describe('F6 — load failure goes to the one always-mounted alert region', () => {
  it('the failure text is inside the single alert region; no second alert is mounted', () => {
    const html = render({ loadFailed: true, petitions: null, locale: 'fr' })
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(alertRegion(html)?.[1]).toBe(adminPetitionsMessages.fr.loadFailed)
  })

  it('the alert region is mounted (empty) before anything goes wrong', () => {
    const html = render({ petitions: null })
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(alertRegion(html)?.[1]).toBe('')
  })
})
