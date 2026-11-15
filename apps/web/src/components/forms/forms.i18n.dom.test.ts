// @vitest-environment jsdom
// apps/web/src/components/forms/forms.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W9 — Documents & Forms › Applications, the form wizard, the vault prompt and the PDF annotator
// in the member's language, in a real DOM (jsdom, createRoot, act):
//   - FEED's own words in Korean with lang/dir on each root (Arabic rtl); the SNAP / Medicaid
//     templates' official labels, headings and option labels stay as written, marked lang="en"
//     (owner decision pending), and so do a government form's official name and number;
//   - what the member types stays their own text (lang="" dir="auto");
//   - the submitted answers, the autofilled values, the vault's setup / unlock arguments and the
//     PDF fields Fill from Profile writes are the same in English and Korean;
//   - Label in Name in all 14 locales; required fields carry required + aria-required;
//   - focus: the wizard's heading on open, the step heading on each step; a failed submission or
//     vault setup is a translated line in an always-mounted alert (never the server's or the crypto
//     layer's text), with one code-only row where nothing else logs it; deleting a draft announces it
//     and moves focus to the In Progress tab.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  submits: [] as unknown[][],
  drafts: [] as unknown[],
  submitOk: true,
  setupArgs: [] as string[],
  unlockArgs: [] as string[],
  setupFails: false,
  vaultError: null as string | null,
  setText: [] as Array<[string, string]>,
  submissions: [] as Array<Record<string, unknown>>,
  deleteError: null as null | { code: string; message: string },
  locale: 'en' as string,
  vaultLoading: false,
  unlockOk: true,
  draftOk: true,
  subLoading: false,
  subsLoading: false,
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _labels: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ profile: { full_name: 'Ana Ruiz', location_city: null, location_state: null, zip_code: null, preferred_language: h.locale }, user: { id: 'me', email: 'ana@example.org' }, isAnonymous: false }),
}))
vi.mock('@/contexts/vault-context', () => ({
  useVault: () => ({
    isUnlocked: true, isSetup: false, loading: h.vaultLoading, error: h.vaultError,
    clearError: () => { h.vaultError = null },
    setup: async (pw: string) => {
      h.setupArgs.push(pw)
      if (h.setupFails) { h.vaultError = 'OperationError: wrapKey failed for key ab12'; const e = new Error('wrapKey failed for key ab12'); e.name = 'OperationError'; throw e }
    },
    unlock: async (pw: string) => {
      h.unlockArgs.push(pw)
      if (!h.unlockOk) h.vaultError = 'Incorrect password'
      return h.unlockOk
    },
    registerPreLockFlush: () => () => {},
  }),
}))
vi.mock('@/hooks/use-vault-secure-profile', () => ({
  useVaultSecureProfile: () => ({ profile: { residential_address: { line1: '12 Elm St', city: 'Oakland', state: 'CA', zip_code: '94601' } } }),
}))
vi.mock('@/hooks/use-vault-form-submission', () => ({
  useVaultFormSubmission: () => ({
    createDraft: async () => 'sub1',
    loadSubmission: vi.fn(),
    saveDraft: async (data: unknown) => { h.drafts.push(JSON.parse(JSON.stringify(data))); return h.draftOk },
    submitForm: async (...args: unknown[]) => { h.submits.push(JSON.parse(JSON.stringify(args))); return h.submitOk },
    loading: h.subLoading,
    error: h.submitOk ? null : 'insert or update on table "form_submissions" violates foreign key constraint',
  }),
  useUserSubmissions: () => ({ submissions: h.submissions, loading: h.subsLoading, error: null, refresh: async () => {} }),
}))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: {}, setPanelParams: vi.fn(), setActivePanel: vi.fn() }) }))
vi.mock('@/hooks/use-encrypted-upload', () => ({ useEncryptedUpload: () => ({ uploadFile: async () => ({ documentId: 'd9' }) }) }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ list: async () => ({ data: [], error: null }), download: async () => ({ data: null, error: null }) }) },
    from: () => ({ delete: () => ({ eq: async () => ({ error: h.deleteError }) }) }),
  }),
}))
vi.mock('@/components/forms/pdf-annotator-dynamic', async () => {
  const { createElement } = await import('react')
  return {
    // A stand-in annotator: one Save button that hands back what the real one would.
    PdfAnnotator: ({ onSave }: { onSave: (d: { sourceBytes: Uint8Array; annotations: unknown[] }) => Promise<void> }) =>
      createElement('button', { type: 'button', 'data-testid': 'stub-save-pdf', onClick: () => void onSave({ sourceBytes: new Uint8Array([37]), annotations: [] }) }, 'save'),
  }
})
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children }: { children?: unknown }) => children ?? null,
  Page: () => null,
}))
vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}))
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}))
vi.mock('@/hooks/use-pdf-annotation', () => ({
  usePdfAnnotation: () => ({
    pdfBytes: new Uint8Array([37, 80, 68, 70]), numPages: 1, annotations: [], isLoading: false, isSaving: false, error: null,
    loadPdf: async () => {}, addAnnotation: vi.fn(), updateAnnotation: vi.fn(), removeAnnotation: vi.fn(), savePdf: async () => ({ sourceBytes: new Uint8Array(), annotations: [] }),
  }),
}))
vi.mock('@cantoo/pdf-lib', () => {
  class PDFTextField { constructor(public n: string) {} getName() { return this.n } setText(v: string) { h.setText.push([this.n, v]) } }
  return {
    PDFDocument: {
      load: async () => ({
        getForm: () => ({ getFields: () => ['First Name', 'Last_Name', 'E-mail', 'Street Address', 'City', 'ZIP', 'SSN'].map((n) => new PDFTextField(n)) }),
        save: async () => new Uint8Array([1]),
      }),
    },
  }
})

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { messages, type Locale } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import { formsT } from '@/lib/i18n-forms'
import { documentsT } from '@/lib/i18n-documents'
import { allTemplates, snapApplicationTemplate } from '@/lib/form-templates'
import { GOVERNMENT_FORMS } from '@/lib/government-forms'
import { FormWizard } from './form-wizard'
import { PdfAnnotator } from './pdf-annotator'
import { FormsPanel, mapSubmissionStatus } from '@/components/panels/forms-panel'
import { VaultUnlockModal } from '@/components/vault/vault-unlock-modal'

const LOCALES = Object.keys(messages) as Locale[]
let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO
if (!('PointerEvent' in globalThis)) (globalThis as { PointerEvent?: unknown }).PointerEvent = MouseEvent
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

beforeEach(() => {
  h.submits = []
  h.drafts = []
  h.submitOk = true
  h.setupArgs = []
  h.unlockArgs = []
  h.setupFails = false
  h.vaultError = null
  h.setText = []
  h.submissions = []
  h.deleteError = null
  h.vaultLoading = false
  h.unlockOk = true
  h.draftOk = true
  h.subLoading = false
  h.subsLoading = false
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
async function render(locale: Locale, node: ReturnType<typeof el>) {
  h.locale = locale
  await act(async () => root.render(el(InitialLocaleContext.Provider, { value: locale }, node)))
  await settle()
}
const remount = () => { act(() => root.unmount()); root = createRoot(container) }
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement
const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const labelInName = (scope: ParentNode, l: Locale) => {
  for (const c of [...scope.querySelectorAll('button, a, [role="tab"], [role="radio"]')] as HTMLElement[]) {
    const visible = c.textContent?.trim() ?? ''
    const name = c.getAttribute('aria-label')
    if (!visible || name === null) continue
    expect(name.startsWith(visible), `${l}: "${name}" vs "${visible}"`).toBe(true)
  }
}

describe('the form wizard', () => {
  const wizard = () => el(FormWizard, { templateId: snapApplicationTemplate.id, onComplete: vi.fn(), onCancel: vi.fn() })

  it('Korean chrome around the official English template; lang on each; the heading takes focus', async () => {
    await render('ko', wizard())
    const rootEl = byTestId('form-wizard-container')
    expect(rootEl).toMatchObject({ lang: 'ko', dir: 'ltr' })
    const title = byTestId('form-wizard-title')
    expect(title).toMatchObject({ lang: 'en', textContent: 'SNAP Benefits Application' })
    expect(document.activeElement).toBe(title)
    expect(byTestId('form-wizard-step').textContent).toContain('9단계 중 1단계')
    expect(byTestId('form-next-button').textContent).toContain(formsT('ko', 'next'))
    expect(byTestId('form-back-button').getAttribute('aria-disabled')).toBe('true')
    // Every field label of the step is the template's own English, marked so.
    const first = document.getElementById('first_name') as HTMLInputElement
    const label = document.querySelector('label[for="first_name"] span[lang="en"]')
    expect(label?.textContent).toBe('First Name')
    expect(first.required).toBe(true)
    expect(first.getAttribute('aria-required')).toBe('true')
    expect(first.getAttribute('dir')).toBe('auto')
    expect(document.querySelector('label[for="first_name"] .sr-only')?.textContent).toContain(formsT('ko', 'requiredMark'))
    const stepHeading = rootEl.querySelector('h2')!
    expect(stepHeading).toMatchObject({ lang: 'en', textContent: 'Personal Information' })
    expect(byTestId('form-autofill-banner').textContent).toBe(formsT('ko', 'autofillBanner'))
  })

  it('Arabic: dir="rtl" on the wizard', async () => {
    await render('ar', wizard())
    expect(byTestId('form-wizard-container')).toMatchObject({ lang: 'ar', dir: 'rtl' })
  })

  async function walkAndSubmit(l: Locale) {
    await render(l, wizard())
    await type(document.getElementById('middle_name') as HTMLInputElement, 'María')
    const headings: string[] = []
    for (let i = 0; i < 9; i++) {
      await act(async () => byTestId('form-next-button')?.click())
      await settle()
      headings.push(document.activeElement?.textContent ?? '')
      if (byTestId('form-submit-button')) break
    }
    await act(async () => byTestId('form-submit-button').click())
    await settle()
    return headings
  }

  it.each(['snap-application-v1', 'medicaid-application-v1'])('%s: on every step each official label, heading, hint and option stays English (lang="en") in Korean', async (id) => {
    const tmpl = allTemplates.find((t) => t.id === id)!
    await render('ko', el(FormWizard, { templateId: id, onComplete: vi.fn(), onCancel: vi.fn() }))
    let checked = 0
    for (const section of tmpl.sections) {
      const rootEl = byTestId('form-wizard-container')
      const official = new Set<string>([section.title, section.description ?? ''])
      for (const fid of section.fields) {
        const f = tmpl.fields.find((x) => x.id === fid)!
        official.add(f.label)
        if (f.helpText) official.add(f.helpText)
        for (const o of f.options ?? []) if (f.type === 'radio') official.add(o.label)
      }
      official.delete('')
      for (const text of official) {
        const nodes = [...rootEl.querySelectorAll('*')].filter((n) => n.children.length === 0 && n.textContent === text)
        expect(nodes.length, `${id}: "${text}" rendered`).toBeGreaterThan(0)
        for (const n of nodes) expect(n.closest('[lang]')?.getAttribute('lang'), `${id}: "${text}"`).toBe('en')
        checked++
      }
      await act(async () => byTestId('form-next-button').click())
      await settle()
    }
    expect(checked).toBeGreaterThan(60)
  })

  it('focus moves to each step heading; the review step is in the member language', async () => {
    const headings = await walkAndSubmit('ko')
    expect(headings[0]).toBe('Contact Information')
    expect(headings.at(-1)).toBe(formsT('ko', 'reviewSubmit'))
  })

  it('the submitted answers (typed and autofilled) and each saved draft are the same in English and Korean', async () => {
    await walkAndSubmit('en')
    const en = { submits: h.submits, drafts: h.drafts }
    h.submits = []
    h.drafts = []
    remount()
    await walkAndSubmit('ko')
    expect(en.submits).toHaveLength(1)
    const [data, signature, templateId] = en.submits[0] as [Record<string, unknown>, unknown, string]
    expect(templateId).toBe('snap-application-v1')
    expect(signature ?? undefined).toBeUndefined()
    expect(data).toMatchObject({ first_name: 'Ana', last_name: 'Ruiz', email: 'ana@example.org', middle_name: 'María', address: { line1: '12 Elm St', city: 'Oakland', state: 'CA', zip: '94601' } })
    expect(h.submits).toEqual(en.submits)
    expect(h.drafts).toEqual(en.drafts)
  })

  it('a failed submission is a translated line in the always-mounted alert, never the server text', async () => {
    h.submitOk = false
    await walkAndSubmit('ko')
    const alert = byTestId('form-submit-alert')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toBe(formsT('ko', 'submitFailed'))
    expect(document.body.textContent).not.toContain('foreign key')
  })

  it.each(LOCALES)('%s: Label in Name in the wizard', async (l) => {
    await render(l, wizard())
    labelInName(byTestId('form-wizard-container'), l)
  })
})

describe('the Forms & Applications hub', () => {
  it('Korean chrome; template and government form names official English (lang="en")', async () => {
    await render('ko', el(FormsPanel))
    const hub = byTestId('forms-panel')
    expect(hub).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(hub.querySelector('h1')?.textContent).toBe(formsT('ko', 'title'))
    const tmplName = [...hub.querySelectorAll('h3')].find((n) => n.textContent === 'SNAP Benefits Application')
    expect(tmplName?.getAttribute('lang')).toBe('en')
    const gov = [...hub.querySelectorAll('[data-testid="gov-form-card"] h3')].find((n) => n.textContent === GOVERNMENT_FORMS[0].programName)
    expect(gov?.getAttribute('lang')).toBe('en')
    expect(hub.querySelector('[data-testid="gov-form-card"] bdi')?.getAttribute('lang')).toBe('en')
    expect(hub.textContent).toContain(formsT('ko', 'startApplication'))
    expect(hub.textContent).not.toMatch(/Available Forms|Start Application|Government Forms|Required Documents/)
  })

  it('Arabic: dir="rtl" on the hub', async () => {
    await render('ar', el(FormsPanel))
    expect(byTestId('forms-panel')).toMatchObject({ lang: 'ar', dir: 'rtl' })
  })

  it.each(LOCALES)('%s: Label in Name in the hub', async (l) => {
    await render(l, el(FormsPanel))
    labelInName(byTestId('forms-panel'), l)
  })

  const draft = (id: string) => ({ id, templateId: snapApplicationTemplate.id, status: 'draft', formData: { first_name: 'Ana' }, createdAt: '2026-11-10T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z' })

  it('deleting the last draft: announced, focus to the In Progress tab; the dialog is in the member language', async () => {
    h.submissions = [draft('s1')]
    await render('ko', el(FormsPanel))
    await act(async () => (document.getElementById('forms-tab-in-progress') as HTMLButtonElement).click())
    await settle()
    const del = document.querySelector('[data-return-id="delete-s1"]') as HTMLButtonElement
    expect(del.getAttribute('aria-label')).toBe(formsT('ko', 'deleteDraft'))
    await act(async () => del.click())
    await settle()
    expect(byTestId('delete-draft-dialog')).toMatchObject({ lang: 'ko' })
    const status = byTestId('forms-status')
    const inserted: string[] = []
    const o = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
    o.observe(status, { childList: true, subtree: true })
    h.submissions = []
    await act(async () => byTestId('delete-draft-confirm').click())
    await settle()
    o.disconnect()
    expect(inserted).toEqual([formsT('ko', 'draftDeleted')])
    expect(document.activeElement).toBe(document.getElementById('forms-tab-in-progress'))
  })

  it('a failed draft delete: translated line in the dialog, one code-only row', async () => {
    h.submissions = [draft('s1')]
    h.deleteError = { code: '42501', message: 'permission denied for table form_submissions' }
    await render('ko', el(FormsPanel))
    await act(async () => (document.getElementById('forms-tab-in-progress') as HTMLButtonElement).click())
    await settle()
    await act(async () => (document.querySelector('[data-return-id="delete-s1"]') as HTMLButtonElement).click())
    await settle()
    await act(async () => byTestId('delete-draft-confirm').click())
    await settle()
    expect(byTestId('delete-draft-alert').textContent).toBe(formsT('ko', 'draftDeleteFailed'))
    expect(document.body.textContent).not.toContain('permission denied')
    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith('error_surface.shown', { surface: 'forms', kind: '42501', locale: 'ko' })
  })
})

describe('the vault prompt', () => {
  const modal = () => el(VaultUnlockModal, { open: true, onOpenChange: vi.fn(), mode: 'setup' })

  it('Korean words, lang on the portalled dialog; labelled required fields; the alert line always mounted', async () => {
    await render('ko', modal())
    const dialog = byTestId('vault-unlock-modal')
    expect(dialog).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(dialog.textContent).toContain(documentsT('ko', 'setupTitle'))
    const pw = byTestId('vault-unlock-password-input') as HTMLInputElement
    expect(document.querySelector('label[for="password"]')?.textContent).toBe(documentsT('ko', 'masterPassword'))
    expect(pw.getAttribute('aria-required')).toBe('true')
    expect(byTestId('vault-unlock-alert').getAttribute('role')).toBe('alert')
    expect(byTestId('vault-unlock-submit-button').getAttribute('aria-disabled')).toBe('true')
  })

  it('setup sends the same password in English and Korean; a failure is a translated line and one code-only row', async () => {
    const run = async (l: Locale) => {
      await render(l, modal())
      await type(byTestId('vault-unlock-password-input') as HTMLInputElement, 'correct horse battery')
      await type(document.getElementById('confirm-password') as HTMLInputElement, 'correct horse battery')
      await act(async () => byTestId('vault-unlock-submit-button').click())
      await settle()
    }
    await run('en')
    remount()
    h.setupFails = true
    await run('ko')
    expect(h.setupArgs).toEqual(['correct horse battery', 'correct horse battery'])
    remount()
    await render('ko', modal())
    expect(byTestId('vault-unlock-alert').textContent).toBe(documentsT('ko', 'setupFailed'))
    expect(document.body.textContent).not.toMatch(/wrapKey|OperationError/)
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith('error_surface.shown', { surface: 'vault-setup', kind: 'OperationError', locale: 'ko' })
  })

  it('a short password is not sent: the reason under the field, focus there', async () => {
    await render('ko', modal())
    const pw = byTestId('vault-unlock-password-input') as HTMLInputElement
    await type(pw, 'short')
    await act(async () => byTestId('vault-unlock-submit-button').click())
    await settle()
    expect(h.setupArgs).toEqual([])
    expect(document.getElementById('vault-password-error')?.textContent).toBe(documentsT('ko', 'passwordTooShort'))
    expect(document.activeElement).toBe(pw)
  })
})

describe('the PDF annotator', () => {
  const annotator = () => el(PdfAnnotator, {
    file: new File(['%PDF'], 'form.pdf', { type: 'application/pdf' }),
    onSave: async () => {}, onCancel: vi.fn(),
    autofillValues: { first_name: 'Ana', last_name: 'Ruiz', email: 'ana@example.org', address: { line1: '12 Elm St', city: 'Oakland', state: 'CA', zip: '94601' } },
  })

  it('Korean toolbar, lang on the root; the sizes are one radio group', async () => {
    await render('ko', annotator())
    const rootEl = byTestId('pdf-annotator')
    expect(rootEl).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(rootEl.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(formsT('ko', 'toolbarLabel'))
    const radios = rootEl.querySelectorAll('[role="radiogroup"] [role="radio"]')
    expect(radios).toHaveLength(5)
    expect(rootEl.querySelectorAll('[role="radio"][tabindex="0"]')).toHaveLength(1)
    expect(rootEl.textContent).toContain(formsT('ko', 'savePdf'))
    labelInName(rootEl, 'ko')
  })

  it('Fill from Profile writes the same PDF fields in English and Korean, and announces the count', async () => {
    const run = async (l: Locale) => {
      await render(l, annotator())
      const status = byTestId('pdf-annotator-status')
      const inserted: string[] = []
      const o = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
      o.observe(status, { childList: true, subtree: true })
      await act(async () => byTestId('pdf-fill-from-profile-btn').click())
      await settle()
      o.disconnect()
      remount()
      return inserted
    }
    const en = await run('en')
    const enFields = h.setText
    h.setText = []
    const ko = await run('ko')
    expect(enFields).toEqual([['First Name', 'Ana'], ['Last_Name', 'Ruiz'], ['E-mail', 'ana@example.org'], ['Street Address', '12 Elm St'], ['City', 'Oakland'], ['ZIP', '94601']])
    expect(h.setText).toEqual(enFields)
    expect(en).toEqual(['Filled 6 of 7 fields'])
    expect(ko).toEqual(['입력란 7개 중 6개를 채웠습니다'])
  })
})

// ── PR #259 fix round: focus, announcements, autofill tokens, review, busy fields ──────────────
const watchRegion = (region: Element) => {
  const inserted: string[] = []
  const o = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
  o.observe(region, { childList: true, subtree: true })
  return { inserted, stop: () => o.disconnect() }
}

describe('fix round: the wizard', () => {
  const wizard = () => el(FormWizard, { templateId: snapApplicationTemplate.id, onComplete: vi.fn(), onCancel: vi.fn() })

  it('B2: while the draft loads the heading is not there; once it has loaded, focus is on the form’s heading', async () => {
    h.subLoading = true
    await render('ko', wizard())
    expect(byTestId('form-wizard-title')).toBeNull()
    h.subLoading = false
    await render('ko', wizard())
    expect(document.activeElement).toBe(byTestId('form-wizard-title'))
  })

  it('B5: personal fields carry autofill tokens by field name; the names are unchanged', async () => {
    await render('ko', wizard())
    const tokens: Record<string, string> = { first_name: 'given-name', last_name: 'family-name', middle_name: 'additional-name', date_of_birth: 'bday' }
    for (const [name, token] of Object.entries(tokens)) {
      const input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement
      expect(input, name).not.toBeNull()
      expect(input.getAttribute('autocomplete'), name).toBe(token)
    }
    // Step 2 holds email and phone.
    await act(async () => byTestId('form-next-button').click())
    await settle()
    expect((document.querySelector('input[name="email"]') as HTMLInputElement).getAttribute('autocomplete')).toBe('email')
    expect((document.querySelector('input[name="phone"]') as HTMLInputElement).getAttribute('autocomplete')).toBe('tel')
  })

  it('L6: the wizard’s fields use readOnly / aria-disabled, never disabled, while busy', async () => {
    await render('ko', wizard())
    // Source guard over the step fields (a live busy state needs a held save; the attribute is the contract).
    const src = readFileSync(`${process.cwd()}/src/components/forms/form-wizard.tsx`, 'utf8')
    expect(src).not.toMatch(/disabled=\{disabled\}/)
    expect(src.match(/readOnly=\{disabled\}/g)?.length).toBeGreaterThanOrEqual(4)
    expect((document.getElementById('middle_name') as HTMLInputElement).disabled).toBe(false)
  })

  it('H1: a failed draft save on Next is said in the alert line, once per failure, with one code-only row each', async () => {
    h.draftOk = false
    await render('ko', wizard())
    const w = watchRegion(byTestId('form-submit-alert'))
    await act(async () => byTestId('form-next-button').click())
    await settle()
    await act(async () => byTestId('form-next-button').click())
    await settle()
    w.stop()
    expect(w.inserted).toEqual([formsT('ko', 'draftSaveFailed'), formsT('ko', 'draftSaveFailed')])
    const rows = vi.mocked(logger.warn).mock.calls.filter((c) => c[0] === 'error_surface.shown')
    expect(rows).toEqual([
      ['error_surface.shown', { surface: 'form-wizard', kind: 'draft_save_failed', locale: 'ko' }],
      ['error_surface.shown', { surface: 'form-wizard', kind: 'draft_save_failed', locale: 'ko' }],
    ])
  })

  it('H2: on Review an unanswered required field shows “—” and says it is not answered', async () => {
    await render('ko', wizard())
    for (let i = 0; i < 9 && !byTestId('form-submit-button'); i++) {
      await act(async () => byTestId('form-next-button').click())
      await settle()
    }
    const unanswered = [...document.querySelectorAll('[data-unanswered]')] as HTMLElement[]
    expect(unanswered.length).toBeGreaterThan(0)
    const gender = unanswered.find((n) => n.querySelector('dt')?.textContent === 'Gender')!
    expect(gender.querySelector('dd')?.textContent).toBe(`— ${formsT('ko', 'notAnswered')}`)
    expect(gender.querySelector('dd [aria-hidden="true"]')?.textContent).toBe('—')
    // An answered field is not marked.
    expect(unanswered.some((n) => n.querySelector('dt')?.textContent === 'First Name')).toBe(false)
  })
})

describe('fix round: the hub', () => {
  it('B1: a refresh keeps the tabs and the status line mounted (no spinner after the first load)', async () => {
    await render('ko', el(FormsPanel))
    const tab = document.getElementById('forms-tab-submitted') as HTMLButtonElement
    tab.focus()
    h.subsLoading = true
    await render('ko', el(FormsPanel))
    expect(document.getElementById('forms-tab-submitted')).toBe(tab)
    expect(document.activeElement).toBe(tab)
    expect(byTestId('forms-status')).not.toBeNull()
    expect(document.body.textContent).not.toContain(formsT('ko', 'checking'))
  })

  it('B1: after a submission, “submitted” is said once and focus is on the Submitted tab', async () => {
    await render('ko', el(FormsPanel))
    const start = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === formsT('ko', 'startApplication'))!
    await act(async () => start.click())
    await settle()
    for (let i = 0; i < 9 && !byTestId('form-submit-button'); i++) {
      await act(async () => byTestId('form-next-button').click())
      await settle()
    }
    h.subsLoading = true
    await act(async () => byTestId('form-submit-button').click())
    await settle()
    h.subsLoading = false
    const status = byTestId('forms-status')
    await render('ko', el(FormsPanel))
    expect(document.activeElement).toBe(document.getElementById('forms-tab-submitted'))
    expect(status.textContent).toBe(formsT('ko', 'applicationSubmitted'))
    expect(status.querySelectorAll('span')).toHaveLength(1)
  })

  it('H1: saving a filled PDF tells the host, which announces it', async () => {
    const onPdfSaved = vi.fn()
    await render('ko', el(FormsPanel, { onPdfSaved }))
    const input = document.querySelector('input[type="file"][accept="application/pdf"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [new File(['%PDF'], 'w9.pdf', { type: 'application/pdf' })], configurable: true })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    await settle()
    await act(async () => byTestId('stub-save-pdf').click())
    await settle()
    expect(onPdfSaved).toHaveBeenCalledTimes(1)
  })

  it('mapSubmissionStatus covers the live enum', () => {
    expect(['draft', 'in_progress', 'submitted', 'under_review', 'approved', 'denied', 'pending_info', 'expired'].map(mapSubmissionStatus))
      .toEqual(['pending', 'pending', 'pending', 'under-review', 'approved', 'denied', 'needs-info', 'expired'])
  })
})

describe('fix round: the vault prompt', () => {
  it('B4: while busy the fields are readOnly + aria-disabled (focus stays), never disabled', async () => {
    h.vaultLoading = true
    await render('ko', el(VaultUnlockModal, { open: true, onOpenChange: vi.fn(), mode: 'unlock' }))
    const pw = byTestId('vault-unlock-password-input') as HTMLInputElement
    expect(pw.disabled).toBe(false)
    expect(pw.readOnly).toBe(true)
    expect(pw.getAttribute('aria-disabled')).toBe('true')
  })

  it('B4: a wrong password keeps focus in the field; a second one is said again; unlock sends the same password in en and ko', async () => {
    h.unlockOk = false
    await render('ko', el(VaultUnlockModal, { open: true, onOpenChange: vi.fn(), mode: 'unlock' }))
    const pw = byTestId('vault-unlock-password-input') as HTMLInputElement
    await type(pw, 'wrong horse battery')
    const w = watchRegion(byTestId('vault-unlock-alert'))
    for (let i = 0; i < 2; i++) {
      await act(async () => byTestId('vault-unlock-submit-button').click())
      await settle()
    }
    w.stop()
    expect(document.activeElement).toBe(pw)
    expect(w.inserted.filter((x) => x === documentsT('ko', 'incorrectPassword'))).toHaveLength(2)
    remount()
    h.unlockOk = true
    h.vaultError = null
    await render('en', el(VaultUnlockModal, { open: true, onOpenChange: vi.fn(), mode: 'unlock' }))
    await type(byTestId('vault-unlock-password-input') as HTMLInputElement, 'wrong horse battery')
    await act(async () => byTestId('vault-unlock-submit-button').click())
    await settle()
    expect(h.unlockArgs).toEqual(['wrong horse battery', 'wrong horse battery', 'wrong horse battery'])
  })
})

describe('fix round: the annotator', () => {
  it('B3: once loaded, focus is on the first tool; the Fill from Profile hint is its description, not its name', async () => {
    await render('ko', el(PdfAnnotator, { file: new File(['%PDF'], 'f.pdf', { type: 'application/pdf' }), onSave: async () => {}, onCancel: vi.fn(), autofillValues: { first_name: 'Ana' } }))
    const first = byTestId('pdf-annotator').querySelector('[role="toolbar"] button') as HTMLButtonElement
    expect(document.activeElement).toBe(first)
    const fill = byTestId('pdf-fill-from-profile-btn')
    expect(fill.textContent?.trim()).toBe(formsT('ko', 'fillFromProfile'))
    expect(document.getElementById(fill.getAttribute('aria-describedby')!)?.textContent).toBe(formsT('ko', 'fillFromProfileHint'))
  })
})
