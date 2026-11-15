// @vitest-environment jsdom
// apps/web/src/components/panels/documents-panel.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W9 — Documents & Forms › My Documents in the member's language, in a real DOM (jsdom,
// createRoot, act):
//   - Korean words with lang/dir on the panel root (Arabic rtl); the folders are one radio group;
//   - a document's name is the member's own text (lang="" dir="auto"), never marked as the
//     viewer's language;
//   - Label in Name in all 14 locales: no control's accessible name differs from the words on it;
//   - the same stored values go out in every language: moving sends the folder value, renaming the
//     typed name, deleting the id, uploading the file and the folder value (en and ko compared);
//   - a failure shows the translated line, never the server's text, and writes one code-only row;
//   - focus never falls to <body>: after delete it moves to the next document's menu button, after
//     a move out of the open folder to the heading, after Dismiss to the heading, after a rename
//     back to the menu button; each result is announced in the one always-mounted status line.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  unlocked: true,
  downloadError: null as string | null,
  deleteFails: false,
  calls: [] as Array<[string, ...unknown[]]>,
  uploadFile: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _labels: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/audit-logger', () => ({ logPredefinedEvent: vi.fn() }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: { id: 'me' } }) }))
vi.mock('@/providers/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'me', email: 'me@example.org' }, profile: null, isAnonymous: false }) }))
vi.mock('@/contexts/vault-context', () => ({
  useVault: () => ({
    isUnlocked: h.unlocked, isSetup: true, loading: false, error: null,
    clearError: vi.fn(), setup: vi.fn(), unlock: vi.fn(), registerPreLockFlush: () => () => {},
  }),
}))
vi.mock('@/hooks/use-encrypted-upload', () => ({
  useEncryptedUpload: () => ({
    downloadFile: vi.fn(),
    downloadForEdit: async (id: string) => { h.calls.push(['downloadForEdit', id]); return { sourceFile: new File(['%PDF'], 'x.pdf', { type: 'application/pdf' }), annotations: [] } },
    updateAnnotations: async (id: string, annotations: unknown) => { h.calls.push(['updateAnnotations', id, annotations]) },
    renameEncrypted: async (id: string, name: string) => { h.calls.push(['renameEncrypted', id, name]) },
    deleteFile: async (id: string) => {
      h.calls.push(['deleteFile', id])
      if (h.deleteFails) {
        const err = new Error('Failed to delete document: permission denied for table user_documents')
        throw err
      }
    },
    uploadFile: h.uploadFile,
    isDownloading: false, isUploading: false, progress: 0,
    error: h.downloadError, clearError: () => { h.downloadError = null },
  }),
}))
vi.mock('@/hooks/use-documents', () => ({
  useDocuments: () => ({ updateDocument: async (id: string, patch: unknown) => { h.calls.push(['updateDocument', id, patch]); return true } }),
}))
vi.mock('@/hooks/use-vault-secure-profile', () => ({ useVaultSecureProfile: () => ({ profile: null }) }))
vi.mock('@/hooks/use-saved-resources', () => ({ useSavedResources: () => ({ savedResources: [], isLoading: false, removeResource: vi.fn() }) }))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {}, setPanelParams: vi.fn(), setActivePanel: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: h.rows, error: null }) }) }) }),
  }),
}))
vi.mock('@/lib/document-encryption', () => ({ decryptString: async () => 'decrypted' }))
vi.mock('@/hooks/use-pdf-annotation', () => ({ exportFlattened: vi.fn() }))
vi.mock('@/components/documents/resource-detail-dialog', () => ({ ResourceDetailDialog: () => null }))
vi.mock('@/components/documents/pdf-document-viewer-dynamic', () => ({ PdfDocumentViewer: () => null }))
vi.mock('@/components/forms/pdf-annotator-dynamic', async () => {
  const { createElement } = await import('react')
  return {
    PdfAnnotator: ({ onSave }: { onSave: (d: { sourceBytes: Uint8Array; annotations: unknown[] }) => Promise<void> }) =>
      createElement('button', { type: 'button', 'data-testid': 'stub-annotator-save', onClick: () => void onSave({ sourceBytes: new Uint8Array([1]), annotations: [] }) }, 'save'),
  }
})
vi.mock('./forms-panel', async () => {
  const { createElement } = await import('react')
  return { FormsPanel: ({ onPdfSaved }: { onPdfSaved?: () => void }) => createElement('button', { type: 'button', 'data-testid': 'stub-forms-saved', onClick: () => onPdfSaved?.() }, 'saved') }
})

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { messages, type Locale } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import { documentCategoryLabel, documentsT } from '@/lib/i18n-documents'
import { DocumentsPanel } from './documents-panel'

const LOCALES = Object.keys(messages) as Locale[]
let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Radix Popper / Dialog in jsdom.
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO
if (!('PointerEvent' in globalThis)) (globalThis as { PointerEvent?: unknown }).PointerEvent = MouseEvent
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

const ROW = (id: string, name: string, category: string) => ({
  id, name, mime_type: 'application/pdf', category, file_size: 2048, created_at: new Date().toISOString(), is_encrypted: false,
})

beforeEach(() => {
  h.rows = [ROW('d1', 'Lease 2026.pdf', 'residence'), ROW('d2', 'عقد الإيجار.pdf', 'residence')]
  h.unlocked = true
  h.downloadError = null
  h.deleteFails = false
  h.calls = []
  h.uploadFile.mockReset()
  h.uploadFile.mockResolvedValue({ documentId: 'new1' })
  vi.mocked(logger.warn).mockClear()
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
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
}
async function render(locale: Locale) {
  await act(async () => root.render(el(InitialLocaleContext.Provider, { value: locale }, el(DocumentsPanel))))
  await settle()
}
const panel = () => container.querySelector('[data-testid="documents-panel"]') as HTMLElement
const menuButton = (id: string) => container.querySelector(`[data-document-id="${id}"] [data-testid="doc-overflow-menu-btn"]`) as HTMLButtonElement
async function openMenu(id: string) {
  const trigger = menuButton(id)
  await act(async () => { trigger.focus(); trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  await settle()
}
async function choose(testId: string) {
  const item = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement
  expect(item, testId).not.toBeNull()
  await act(async () => item.click())
  await settle()
}
function watch(region: Element) {
  const inserted: string[] = []
  const o = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
  o.observe(region, { childList: true, subtree: true })
  return { inserted, stop: () => o.disconnect() }
}

describe('My Documents in the member language', () => {
  it('Korean: words, lang on the root, the folders one radio group, translated chips', async () => {
    await render('ko')
    expect(panel()).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(container.querySelector('#docs-tab-documents')?.textContent).toContain(documentsT('ko', 'tabDocuments'))
    const groups = container.querySelectorAll(`[role="radiogroup"][aria-label="${documentsT('ko', 'foldersLabel')}"]`)
    expect(groups.length).toBe(2)
    const checked = groups[0].querySelectorAll('[role="radio"][aria-checked="true"]')
    expect(checked).toHaveLength(1)
    expect(checked[0].getAttribute('tabindex')).toBe('0')
    expect(container.textContent).toContain(documentCategoryLabel('residence', 'ko'))
    expect(container.textContent).not.toMatch(/My Documents|Upload Encrypted Document|Search documents|Residence|More options/)
  })

  it('Arabic: dir="rtl" on the panel', async () => {
    await render('ar')
    expect(panel()).toMatchObject({ lang: 'ar', dir: 'rtl' })
  })

  it('a document name is the member’s own text: lang="" dir="auto"', async () => {
    await render('ko')
    for (const name of ['Lease 2026.pdf', 'عقد الإيجار.pdf']) {
      const node = [...container.querySelectorAll('[data-testid="document-card"] h3 span')].find((n) => n.textContent === name)
      expect(node?.getAttribute('lang'), name).toBe('')
      expect(node?.getAttribute('dir'), name).toBe('auto')
    }
  })

  it.each(LOCALES)('%s: Label in Name — no control is named differently from the words on it', async (l) => {
    await render(l)
    const controls = [...panel().querySelectorAll('button, a, [role="tab"], [role="radio"]')] as HTMLElement[]
    expect(controls.length).toBeGreaterThan(8)
    for (const c of controls) {
      const visible = c.textContent?.trim() ?? ''
      const name = c.getAttribute('aria-label')
      if (!visible || name === null) continue
      expect(name.startsWith(visible), `${l}: "${name}" vs "${visible}"`).toBe(true)
    }
    // Icon-only buttons are named in the viewer's language and point at the document's name.
    const view = container.querySelector('[data-document-id="d1"] [data-testid="doc-view-btn"]')!
    expect(view.getAttribute('aria-label')).toBe(documentsT(l, 'view'))
    expect(document.getElementById(view.getAttribute('aria-describedby')!)?.textContent).toContain('Lease 2026.pdf')
  })
})

describe('the same values go out in every language', () => {
  async function moveDeleteRename(l: Locale) {
    h.calls = []
    await render(l)
    await openMenu('d1')
    await choose('doc-move-to-income')
    await openMenu('d2')
    await choose('doc-rename-btn')
    const input = document.querySelector('[data-testid="rename-input"]') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Bail 2026.pdf')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => (document.querySelector('[data-testid="rename-submit-btn"]') as HTMLButtonElement).click())
    await settle()
    await openMenu('d1')
    await choose('doc-delete-btn')
    await act(async () => (document.querySelector('[data-testid="delete-document-confirm"]') as HTMLButtonElement).click())
    await settle()
    const out = h.calls
    act(() => root.unmount())
    root = createRoot(container)
    return out
  }

  it('move, rename and delete send the same folder value, name and id in English and Korean', async () => {
    const en = await moveDeleteRename('en')
    const ko = await moveDeleteRename('ko')
    expect(en).toEqual([
      ['updateDocument', 'd1', { category: 'income' }],
      ['updateDocument', 'd2', { name: 'Bail 2026.pdf' }],
      ['deleteFile', 'd1'],
    ])
    expect(ko).toEqual(en)
  })

  it('upload sends the same file and the folder value in English and Korean', async () => {
    const file = new File(['%PDF-1.4'], 'Pay stub.pdf', { type: 'application/pdf' })
    const run = async (l: Locale) => {
      await render(l)
      await act(async () => (container.querySelector(`[data-testid="doc-folder-income"]`) as HTMLButtonElement).click())
      const input = container.querySelector('[data-testid="encrypted-upload-input"]') as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
      await settle()
      const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === documentsT(l, 'encryptAndUpload'))!
      await act(async () => button.click())
      await settle()
      act(() => root.unmount())
      root = createRoot(container)
    }
    await run('en')
    await run('ko')
    expect(h.uploadFile.mock.calls).toEqual([[file, 'income'], [file, 'income']])
  })
})

describe('keyboard, focus and announcements', () => {
  it('delete: the dialog is in the member language; afterwards focus is on the next document’s menu button and the result is announced', async () => {
    await render('ko')
    const status = container.querySelector('[data-testid="documents-status"]')!
    const w = watch(status)
    await openMenu('d1')
    await choose('doc-delete-btn')
    const dialog = document.querySelector('[data-testid="delete-document-dialog"]') as HTMLElement
    expect(dialog).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(dialog.querySelector('bdi')?.getAttribute('dir')).toBe('auto')
    await act(async () => (dialog.querySelector('[data-testid="delete-document-confirm"]') as HTMLButtonElement).click())
    await settle()
    w.stop()
    expect(container.querySelector('[data-document-id="d1"]')).toBeNull()
    expect(document.activeElement).toBe(menuButton('d2'))
    expect(w.inserted).toEqual([documentsT('ko', 'deleted')])
  })

  it('a failed delete shows the translated line (never the server text), one code-only row; Dismiss returns focus to the heading', async () => {
    h.deleteFails = true
    await render('ko')
    await openMenu('d1')
    await choose('doc-delete-btn')
    await act(async () => (document.querySelector('[data-testid="delete-document-confirm"]') as HTMLButtonElement).click())
    await settle()
    const alert = container.querySelector('[data-testid="documents-alert"]')!
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toContain(documentsT('ko', 'deleteFailed'))
    expect(container.textContent).not.toContain('permission denied')
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith('error_surface.shown', { surface: 'documents', kind: 'Error', locale: 'ko' })
    const dismiss = [...alert.querySelectorAll('button')].find((b) => b.textContent === documentsT('ko', 'dismiss'))!
    await act(async () => dismiss.click())
    await settle()
    expect(document.activeElement?.id).toBe('documents-heading')
    expect(alert.textContent).toBe('')
  })

  it('moving the only document out of the open folder moves focus to the heading and announces the move', async () => {
    h.rows = [ROW('d1', 'Lease 2026.pdf', 'residence')]
    await render('ko')
    await act(async () => (container.querySelector('[data-testid="doc-folder-residence"]') as HTMLButtonElement).click())
    const w = watch(container.querySelector('[data-testid="documents-status"]')!)
    await openMenu('d1')
    await choose('doc-move-to-income')
    w.stop()
    expect(document.activeElement?.id).toBe('documents-heading')
    expect(w.inserted).toEqual([`${documentCategoryLabel('income', 'ko')}(으)로 이동했습니다.`])
  })

  it('rename: a labelled, required field; after saving focus returns to the menu button', async () => {
    await render('ko')
    await openMenu('d1')
    await choose('doc-rename-btn')
    const input = document.querySelector('[data-testid="rename-input"]') as HTMLInputElement
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(documentsT('ko', 'nameLabel'))
    expect(input.required).toBe(true)
    expect(input.getAttribute('aria-required')).toBe('true')
    expect(input.getAttribute('dir')).toBe('auto')
    expect(document.activeElement).toBe(input)
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Lease (signed).pdf')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => (document.querySelector('[data-testid="rename-submit-btn"]') as HTMLButtonElement).click())
    await settle()
    expect(document.querySelector('[data-testid="rename-dialog"]')).toBeNull()
    expect(document.activeElement).toBe(menuButton('d1'))
  })

  it('folders: Arrow keys move the choice in reading direction (Arabic: ArrowLeft goes forward)', async () => {
    await render('ar')
    const group = container.querySelectorAll('[role="radiogroup"]')[0]
    const radios = [...group.querySelectorAll('[role="radio"]')] as HTMLButtonElement[]
    radios[0].focus()
    await act(async () => radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    const now = [...container.querySelectorAll('[role="radiogroup"]')[0].querySelectorAll('[role="radio"]')] as HTMLButtonElement[]
    expect(now[1].getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(now[1])
  })

  it('upload: the result is announced and focus returns to the file chooser', async () => {
    await render('ko')
    const file = new File(['%PDF'], 'ID card.pdf', { type: 'application/pdf' })
    const input = container.querySelector('[data-testid="encrypted-upload-input"]') as HTMLInputElement
    const w = watch(container.querySelector('[data-testid="upload-status"]')!)
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()
    const selected = [...container.querySelectorAll('p')].find((p) => p.textContent === 'ID card.pdf')
    expect(selected?.getAttribute('lang')).toBe('')
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === documentsT('ko', 'encryptAndUpload'))!
    expect(document.activeElement).toBe(button)
    await act(async () => button.click())
    await settle()
    w.stop()
    expect(w.inserted).toEqual([documentsT('ko', 'uploaded')])
    expect(document.activeElement).toBe(container.querySelector('[data-testid="encrypted-upload-input"]'))
  })
})

// ── PR #259 fix round ────────────────────────────────────────────────────────────────────────
describe('fix round: results said once, labels, encrypted rows, repeated failures', () => {
  const statusOf = () => container.querySelector('[data-testid="documents-status"]')!

  it('H1: saving annotations returns to the list and says “Changes saved.” once', async () => {
    await render('ko')
    await act(async () => (container.querySelector('[data-document-id="d1"] [data-testid="doc-edit-btn"]') as HTMLButtonElement).click())
    await settle()
    await act(async () => (container.querySelector('[data-testid="stub-annotator-save"]') as HTMLButtonElement).click())
    await settle()
    expect(h.calls).toContainEqual(['updateAnnotations', 'd1', []])
    const status = statusOf()
    expect(status.textContent).toBe(documentsT('ko', 'annotationsSaved'))
    expect(status.querySelectorAll('span')).toHaveLength(1)
    expect(document.activeElement).toBe(menuButton('d1'))
  })

  it('H1: a PDF saved from Applications is said in the panel’s status line', async () => {
    await render('ko')
    await act(async () => (container.querySelector('#docs-tab-applications') as HTMLButtonElement).click())
    await settle()
    const w = watch(statusOf())
    await act(async () => (container.querySelector('[data-testid="stub-forms-saved"]') as HTMLButtonElement).click())
    await settle()
    w.stop()
    expect(w.inserted).toEqual([documentsT('ko', 'pdfSaved')])
  })

  it('B6: the upload chooser is named by its visible title', async () => {
    await render('ko')
    const input = container.querySelector('[data-testid="encrypted-upload-input"]') as HTMLInputElement
    expect(input.getAttribute('aria-label')).toBe(documentsT('ko', 'uploadTitle'))
    expect(container.textContent).toContain(documentsT('ko', 'uploadTitle'))
  })

  it('L2: the same failure twice is said twice (a new node each time)', async () => {
    h.deleteFails = true
    await render('ko')
    const w = watch(container.querySelector('[data-testid="documents-alert"]')!)
    for (let i = 0; i < 2; i++) {
      await openMenu('d1')
      await choose('doc-delete-btn')
      await act(async () => (document.querySelector('[data-testid="delete-document-confirm"]') as HTMLButtonElement).click())
      await settle()
    }
    w.stop()
    expect(w.inserted.filter((x) => x.includes(documentsT('ko', 'deleteFailed')))).toHaveLength(2)
  })

  it('an encrypted document: rename sends the same id and name in en and ko; with the vault locked it says why', async () => {
    const encRow = { ...ROW('e1', 'Encrypted document', 'id'), is_encrypted: true, encrypted_original_name: 'c1', encrypted_name_iv: 'iv1' }
    const run = async (l: Locale) => {
      h.rows = [encRow]
      await render(l)
      await openMenu('e1')
      await choose('doc-rename-btn')
      const input = document.querySelector('[data-testid="rename-input"]') as HTMLInputElement
      expect(input.value).toBe('decrypted')
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Pasaporte.pdf')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => (document.querySelector('[data-testid="rename-submit-btn"]') as HTMLButtonElement).click())
      await settle()
      act(() => root.unmount())
      root = createRoot(container)
    }
    await run('en')
    await run('ko')
    expect(h.calls.filter((c) => c[0] === 'renameEncrypted')).toEqual([['renameEncrypted', 'e1', 'Pasaporte.pdf'], ['renameEncrypted', 'e1', 'Pasaporte.pdf']])
    expect(h.calls.some((c) => c[0] === 'updateDocument')).toBe(false)
  })

  it('an encrypted document with the vault locked: rename is not sent; the dialog says to unlock', async () => {
    h.unlocked = false
    h.rows = [{ ...ROW('e1', 'Encrypted document', 'id'), is_encrypted: true, encrypted_original_name: 'c1', encrypted_name_iv: 'iv1' }]
    await render('ko')
    await openMenu('e1')
    await choose('doc-rename-btn')
    const input = document.querySelector('[data-testid="rename-input"]') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Pasaporte.pdf')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => (document.querySelector('[data-testid="rename-submit-btn"]') as HTMLButtonElement).click())
    await settle()
    expect(h.calls.some((c) => c[0] === 'renameEncrypted')).toBe(false)
    expect(document.getElementById('rename-document-error')?.textContent).toBe(documentsT('ko', 'renameLocked'))
    expect(document.activeElement).toBe(input)
  })
})
