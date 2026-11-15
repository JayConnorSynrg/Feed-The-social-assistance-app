// @vitest-environment jsdom
// apps/web/src/components/documents/documents-dialogs.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W9 — the saved resource's detail dialog, the in-app viewer and the vault guard in the member's
// language (jsdom):
//   - lang/dir on each portalled dialog (Korean; Arabic rtl); the category from its one source;
//   - the resource's name and address, tasks, dates' titles, file names, notes, posts and their
//     authors are the member's or the community's own text (lang="" dir="auto");
//   - a failure is a translated line in an always-mounted alert, never the database's, pdf.js's or
//     the browser's text, with one code-only row;
//   - every icon button is named in the member's language (Label in Name for the rest, 14 locales).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  error: null as string | null,
  actionOk: true,
  pdfPages: 0,
  pdfLoaded: false,
  postsError: null as null | { code: string; message: string },
  unlocked: true,
}))

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: (_o: string, _l: unknown, fn: () => unknown) => fn() }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: { id: 'me' } }) }))
vi.mock('@/contexts/vault-context', () => ({
  useVault: () => ({ isUnlocked: h.unlocked, isSetup: true, loading: false, error: null, clearError: vi.fn(), setup: vi.fn(), unlock: vi.fn(), registerPreLockFlush: () => () => {} }),
}))
vi.mock('@/hooks/use-resource-detail', () => ({
  useResourceDetail: () => ({
    resource: { resource_id: 'r1', resource_name: 'Despensa Comunitaria', resource_category: 'food', resource_address: '12 Calle Mayor', resource_phone: '+1 510 555 0100', resource_website: 'https://pantry.example.org' },
    tasks: [{ id: 't1', title: 'Llamar el lunes', is_completed: false }],
    events: [{ id: 'e1', title: 'Cita', event_date: '2026-11-20', event_time: '10:30:00' }],
    documents: [{ id: 'f1', file_name: 'carta.pdf', file_path: 'x/y', file_size: 1572864 }],
    notes: 'Traer identificación',
    addTask: async () => h.actionOk, toggleTask: async () => h.actionOk, deleteTask: async () => h.actionOk,
    addEvent: async () => h.actionOk, deleteEvent: async () => h.actionOk,
    uploadDocument: async () => h.actionOk, deleteDocument: async () => h.actionOk, getDocumentUrl: vi.fn(), updateNotes: async () => h.actionOk,
    completedTasks: 0, totalTasks: 1, progress: 0, isLoading: false, error: h.error,
  }),
}))
vi.mock('@/lib/supabase/client', () => {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = () => chain
  chain.abortSignal = async () => (h.postsError
    ? { data: null, error: h.postsError }
    : { data: [{ id: 'p1', content: 'Muy amables', created_at: '2026-11-15T10:00:00Z', user: { first_name: 'Lupe', avatar_url: null } }], error: null })
  const client = { from: () => chain }
  return { createClient: () => client }
})
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ onLoadError, onLoadSuccess, children }: { onLoadError?: (e: Error) => void; onLoadSuccess?: (d: { numPages: number }) => void; children?: unknown }) => {
    if (h.pdfPages) {
      // react-pdf reports a load once per document.
      if (!h.pdfLoaded) { h.pdfLoaded = true; queueMicrotask(() => onLoadSuccess?.({ numPages: h.pdfPages })) }
      return children ?? null
    }
    onLoadError?.(new Error('InvalidPDFException: Invalid PDF structure at offset 1024'))
    return null
  },
  Page: () => null,
}))
vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}))
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}))

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { messages, type Locale } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import { documentsT } from '@/lib/i18n-documents'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { ResourceDetailDialog } from './resource-detail-dialog'
import { PdfDocumentViewer } from './pdf-document-viewer'
import { VaultGuard } from '@/components/vault/vault-guard'

const LOCALES = Object.keys(messages) as Locale[]
let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
URL.createObjectURL ??= () => 'blob:test'
URL.revokeObjectURL ??= () => {}
// jsdom's Blob has no arrayBuffer().
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.readAsArrayBuffer(this)
  })
}

beforeEach(() => {
  h.error = null
  h.actionOk = true
  h.pdfPages = 0
  h.pdfLoaded = false
  h.postsError = null
  h.unlocked = true
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.error).mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})
const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
async function render(locale: Locale, node: ReturnType<typeof el>) {
  await act(async () => root.render(el(InitialLocaleContext.Provider, { value: locale }, node)))
  await settle()
}
const detail = () => el(ResourceDetailDialog, { savedResourceId: 's1', open: true, onOpenChange: vi.fn() })
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement

describe('a saved resource’s detail dialog', () => {
  it('Korean words and lang on the dialog; the category from its one source; dates in the locale', async () => {
    await render('ko', detail())
    expect(dialog()).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(dialog().textContent).toContain(resourceCategoryLabel('food', 'ko'))
    expect(dialog().textContent).toContain(documentsT('ko', 'tasks'))
    expect(dialog().textContent).toContain('11월 20일')
    expect(dialog().textContent).toContain('1.5MB')
    expect(dialog().textContent).not.toMatch(/Tasks|Schedule|Save Notes|Community Posts|Nov/)
  })

  it('Arabic: dir="rtl" on the dialog', async () => {
    await render('ar', detail())
    expect(dialog()).toMatchObject({ lang: 'ar', dir: 'rtl' })
  })

  it('the member’s and the community’s text keeps its own language and direction', async () => {
    await render('ko', detail())
    for (const text of ['Despensa Comunitaria', '12 Calle Mayor', 'Llamar el lunes', 'Cita', 'carta.pdf', 'Muy amables', 'Lupe']) {
      const node = [...dialog().querySelectorAll('[lang=""]')].find((n) => n.textContent === text)
      expect(node?.getAttribute('dir'), text).toBe('auto')
    }
    expect((dialog().querySelector('textarea') as HTMLTextAreaElement).getAttribute('lang')).toBe('')
  })

  it.each(LOCALES)('%s: every icon button is named in the member language; Label in Name for the rest', async (l) => {
    await render(l, detail())
    for (const key of ['addTask', 'deleteTask', 'addEvent', 'deleteEvent', 'downloadAttachment', 'deleteAttachment'] as const) {
      expect(dialog().querySelector(`button[aria-label="${documentsT(l, key)}"]`), `${l}.${key}`).not.toBeNull()
    }
    for (const c of [...dialog().querySelectorAll('button, a')] as HTMLElement[]) {
      const visible = c.textContent?.trim() ?? ''
      const name = c.getAttribute('aria-label')
      if (visible && name !== null) expect(name.startsWith(visible), `${l}: ${name}`).toBe(true)
    }
  })

  it('a failure is the translated line, never the database text, and one code-only row', async () => {
    h.error = 'duplicate key value violates unique constraint "resource_tasks_pkey"'
    h.postsError = { code: '42501', message: 'permission denied for table posts' }
    await render('ko', detail())
    const alert = document.querySelector('[data-testid="resource-detail-alert"]')!
    expect(alert.textContent).toBe(documentsT('ko', 'detailFailed'))
    expect(dialog().textContent).toContain(documentsT('ko', 'postsFailed'))
    expect(document.body.textContent).not.toMatch(/duplicate key|permission denied/)
    expect(vi.mocked(logger.warn).mock.calls).toEqual([
      ['error_surface.shown', { surface: 'resource-detail', kind: 'load_failed', locale: 'ko' }],
      ['error_surface.shown', { surface: 'resource-posts', kind: '42501', locale: 'ko' }],
    ])
  })
})

describe('the in-app viewer', () => {
  it('Korean words, lang on the dialog, the document name the member’s own; pdf.js text never shown', async () => {
    const file = new File(['%PDF'], 'Carta de empleo.pdf', { type: 'application/pdf' })
    await render('ko', el(PdfDocumentViewer, { open: true, onOpenChange: vi.fn(), file }))
    const d = document.querySelector('[data-testid="document-viewer"]') as HTMLElement
    expect(d).toMatchObject({ lang: 'ko', dir: 'ltr' })
    const title = [...d.querySelectorAll('[lang=""]')].find((n) => n.textContent === 'Carta de empleo.pdf')
    expect(title?.getAttribute('dir')).toBe('auto')
    expect(d.querySelector(`button[aria-label="${documentsT('ko', 'close')}"]`)).not.toBeNull()
    expect(d.querySelectorAll('button[aria-label]')).toHaveLength(1)
    expect(d.textContent).toContain(documentsT('ko', 'renderFailed'))
    expect(d.textContent).not.toContain('InvalidPDFException')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith('pdf.viewer.error', expect.any(Error), { byte_size: 4 })
  })
})

describe('the vault guard', () => {
  it('its placeholder line is in the member language', async () => {
    h.unlocked = false
    await render('ko', el('div', { lang: 'ko' }, el(VaultGuard, { onDismiss: vi.fn() }, el('p', null, 'secret'))))
    expect(container.textContent).toContain(documentsT('ko', 'guardLocked'))
    expect(container.textContent).not.toContain('secret')
  })
})

// ── PR #259 fix round ────────────────────────────────────────────────────────────────────────
const typeIn = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const watchRegion = (region: Element) => {
  const inserted: string[] = []
  const o = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
  o.observe(region, { childList: true, subtree: true })
  return { inserted, stop: () => o.disconnect() }
}

describe('fix round: the detail dialog', () => {
  it('H3: the task and date inputs have visible, persistent labels', async () => {
    await render('ko', detail())
    for (const [id, key] of [['resource-new-task', 'newTask'], ['resource-event-title', 'eventTitle'], ['resource-event-date', 'eventDate'], ['resource-event-time', 'eventTime']] as const) {
      const label = document.querySelector(`label[for="${id}"]`)
      expect(label?.textContent, id).toBe(documentsT('ko', key))
      expect(label?.classList.contains('sr-only'), id).toBe(false)
      expect(document.getElementById(id)?.getAttribute('aria-label'), id).toBeNull()
    }
  })

  it('H1: adding and deleting a task, a date and a file are each said once in the status line', async () => {
    await render('ko', detail())
    const status = document.querySelector('[data-testid="resource-detail-status"]')!
    const w = watchRegion(status)
    await typeIn(document.getElementById('resource-new-task') as HTMLInputElement, 'Llevar recibos')
    await act(async () => (dialog().querySelector(`button[aria-label="${documentsT('ko', 'addTask')}"]`) as HTMLButtonElement).click())
    await settle()
    await act(async () => (dialog().querySelector(`button[aria-label="${documentsT('ko', 'deleteTask')}"]`) as HTMLButtonElement).click())
    await settle()
    await typeIn(document.getElementById('resource-event-title') as HTMLInputElement, 'Cita')
    await typeIn(document.getElementById('resource-event-date') as HTMLInputElement, '2026-11-30')
    await act(async () => (dialog().querySelector(`button[aria-label="${documentsT('ko', 'addEvent')}"]`) as HTMLButtonElement).click())
    await settle()
    await act(async () => (dialog().querySelector(`button[aria-label="${documentsT('ko', 'deleteEvent')}"]`) as HTMLButtonElement).click())
    await settle()
    const file = dialog().querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(file, 'files', { value: [new File(['x'], 'carta.pdf')], configurable: true })
    await act(async () => file.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()
    await act(async () => (dialog().querySelector(`button[aria-label="${documentsT('ko', 'deleteAttachment')}"]`) as HTMLButtonElement).click())
    await settle()
    w.stop()
    expect(w.inserted).toEqual(['taskAdded', 'taskDeleted', 'eventAdded', 'eventDeleted', 'fileUploaded', 'fileDeleted'].map((k) => documentsT('ko', k as never)))
  })

  it('L2: the same failed action twice is said twice, with one code-only row each', async () => {
    h.actionOk = false
    await render('ko', detail())
    const w = watchRegion(document.querySelector('[data-testid="resource-detail-alert"]')!)
    for (let i = 0; i < 2; i++) {
      await act(async () => (dialog().querySelector(`button[aria-label="${documentsT('ko', 'deleteTask')}"]`) as HTMLButtonElement).click())
      await settle()
    }
    w.stop()
    expect(w.inserted).toEqual([documentsT('ko', 'detailFailed'), documentsT('ko', 'detailFailed')])
    expect(vi.mocked(logger.warn).mock.calls).toEqual([
      ['error_surface.shown', { surface: 'resource-detail', kind: 'task_delete', locale: 'ko' }],
      ['error_surface.shown', { surface: 'resource-detail', kind: 'task_delete', locale: 'ko' }],
    ])
  })
})

describe('fix round: the viewer', () => {
  it('L8: Next and Previous scroll to that page and say which page it is', async () => {
    h.pdfPages = 3
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.getAttribute('data-page') ?? '') }
    const file = new File(['%PDF'], 'tres.pdf', { type: 'application/pdf' })
    await render('ko', el(PdfDocumentViewer, { open: true, onOpenChange: vi.fn(), file }))
    await settle()
    const status = document.querySelector('[data-testid="document-viewer-status"]')!
    const next = document.querySelector(`button[aria-label="${documentsT('ko', 'nextPage')}"]`) as HTMLButtonElement
    await act(async () => next.click())
    await act(async () => next.click())
    await act(async () => next.click())
    const prev = document.querySelector(`button[aria-label="${documentsT('ko', 'previousPage')}"]`) as HTMLButtonElement
    await act(async () => prev.click())
    expect(scrolled).toEqual(['2', '3', '2'])
    expect(status.textContent).toBe('3페이지 중 2페이지')
    expect(next.getAttribute('aria-disabled')).toBe('false')
    expect(document.querySelector('[data-testid="document-viewer-alert"]')?.getAttribute('role')).toBe('alert')
  })
})

