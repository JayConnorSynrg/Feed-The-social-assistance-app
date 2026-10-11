// apps/web/src/components/panels/businesses-panel.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the Businesses sub-tab — the showcase and the "Add a local
// business" form — in that language. The REAL panel, mounted through its effects; only auth, the
// data layer and the uploader are faked.
//   - heading, form labels, section titles, options, weekday names and buttons in the member's
//     language; the root marked with it (Arabic: rtl);
//   - category, cost model and attribute labels come from the stored values' one translation;
//   - a business's own name, description and place keep their direction, no page language;
//   - the panel's own failure fallbacks read in the member's language; text from the server or
//     from lib/business-data.ts is English and marked English;
//   - each day switch is named by the day shown beside it, in all 14 locales, and the name does
//     not change when the switch is flipped;
//   - a business's own words are never handed to a translation function;
//   - data fields in US formats read left to right, an empty text field takes the page
//     direction, the photo pickers can be reached with the keyboard, loading says so.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state } = vi.hoisted(() => ({
  state: {
    language: 'en',
    guest: false,
    rows: [] as unknown[],
    loadError: null as unknown,
    outcome: { ok: true, id: 'new' } as unknown,
    submitThrows: null as unknown,
    upload: { url: null, path: null, error: null } as { url: string | null; path: string | null; error: string | null },
  },
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'me' }, isAnonymous: state.guest, profile: { preferred_language: state.language }, loading: false }),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = { rpc: () => Promise.resolve({ data: null, error: null }) }
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/hooks/use-geolocation', () => ({ useGeolocation: () => ({ position: null, getCurrentPosition: vi.fn() }), calculateDistance: () => 0 }))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ panelParams: { businessSubmit: true } }) }))
vi.mock('@/lib/post-image-upload', () => ({ uploadPostImage: async () => state.upload, deletePostImage: vi.fn() }))
vi.mock('@/lib/business-data', () => ({
  fetchApprovedBusinesses: async () => {
    if (state.loadError) throw state.loadError
    return state.rows
  },
  submitBusiness: async () => {
    if (state.submitThrows) throw state.submitThrows
    return state.outcome
  },
  withPhotoUploadMetric: async (_t: unknown, _s: unknown, fn: () => Promise<unknown>) => fn(),
  photoImageType: () => 'webp',
}))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { BUSINESS_ATTRIBUTES, BUSINESS_CATEGORIES } from '@/lib/business-vocab'
import { businessAttributeLabel, businessCategoryLabel, businessFailure, businessesT, costModelLabel } from '@/lib/i18n-feed-businesses'
import { BusinessesPanel, hoursDayName } from './businesses-panel'

const LOCALES = Object.keys(messages) as Locale[]
type El = { type: unknown; props: Record<string, unknown> }
const row = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111', name: 'مخبز الحي', description: 'خبز طازج كل صباح', org_type: 'business', address: null, city: 'Winooski', state: 'VT',
  zip_code: null, location: null, logo_url: null, ...over,
})

/** Mount, let the list load, open every form section, and return the tree and its HTML. */
async function panel(language: string) {
  state.language = language
  const c = mount(() => BusinessesPanel())
  await c.flush()
  for (const section of findAll(c.rerender(), (e: El) => typeof e.props.onToggle === 'function') as El[]) (section.props.onToggle as () => void)()
  const tree = c.rerender() as unknown as ReactElement
  return { c, tree, html: renderToStaticMarkup(tree) }
}

beforeEach(() => {
  state.guest = false
  state.rows = [row()]
  state.loadError = null
  state.outcome = { ok: true, id: 'new' }
  state.submitThrows = null
  state.upload = { url: null, path: null, error: null }
})

describe('Businesses sub-tab in the member language', () => {
  it('es: heading, form, sections, options, weekdays and buttons; root marked es, ltr', async () => {
    const { html } = await panel('es')
    expect(html).toMatch(/^<div lang="es" dir="ltr"/)
    expect(html).toContain('>Negocios locales</h1>')
    expect(html).toContain('aria-label="Enviar un negocio local"')
    expect(html).toContain('>Añadir un negocio local</h2>')
    expect(html).toMatch(/<label for="biz-name"[^>]*>Nombre del negocio <span/)
    expect(html).toContain('placeholder="Café de la Esquina"')
    for (const title of ['Detalles', 'Horario', 'Fotos', 'Servicios', 'Características', 'Redes sociales']) expect(html, title).toContain(`${title}</span>`)
    expect(html).toMatch(/<option value=""[^>]*>Seleccionar…<\/option>/)
    expect(html).toContain('<option value="childcare">Cuidado infantil</option>')
    expect(html).toMatch(/role="group" aria-label="Tipo de costo"/)
    expect(html).toMatch(/>Escala móvil<\/button>/)
    expect(html).toContain('>domingo</span>')
    expect(html).toContain('>lunes</span>')
    expect(html).toContain('Copiar el lunes a los días laborables')
    expect(html).toMatch(/>Acepta EBT<\/button>/)
    expect(html).toContain('+ Añadir servicio')
    expect(html).toMatch(/>Enviar para revisión<\/button>/)
    expect(html).toMatch(/>Cancelar<\/button>/)
    expect(html).not.toMatch(/Local Businesses|Business name|>Details<|>Hours<|>Sun<|>Mon<|>Sunday<|>Monday<|Sliding scale|Accepts EBT|Submit for review|>Cancel<|Select…/)
  })

  it('ar: Arabic copy, dir="rtl", logical spacing and a mirrored disclosure arrow', async () => {
    state.language = 'ar'
    const closed = renderToStaticMarkup(h(BusinessesPanel))
    expect(closed).toMatch(/^<div lang="ar" dir="rtl"/)
    expect(closed).toContain('>الأعمال التجارية المحلية</h1>')
    const { html } = await panel('ar')
    expect(html).toContain('>ساعات العمل</span>')
    const src = readFileSync(fileURLToPath(new URL('./businesses-panel.tsx', import.meta.url)), 'utf8')
    expect(src).toContain('<ChevronRight className="h-4 w-4 text-stone-400 rtl:rotate-180" />')
    expect(src).not.toMatch(/\bmr-1\b|\btext-left\b|\bright-1\b|\bright-0\.5\b/)
  })

  it('a guest gets the translated account prompt and link', async () => {
    state.guest = true
    const { html } = await panel('vi')
    expect(html).toContain('Tạo tài khoản miễn phí để thêm doanh nghiệp địa phương vào bản đồ')
    expect(html).toMatch(/data-testid="create-account-prompt-link"[^>]*>Tạo tài khoản miễn phí</)
    expect(html).not.toContain('<form')
  })

  it('no business yet: the empty sentence, with the invitation only for a member who can add one', async () => {
    state.rows = []
    expect((await panel('ht')).html).toContain('Poko gen biznis lokal. Se ou ki ka premye ajoute youn.')
    state.guest = true
    const guest = (await panel('ht')).html
    expect(guest).toContain('Poko gen biznis lokal.')
    expect(guest).not.toContain('Se ou ki ka premye ajoute youn.')
  })

  it('the photo slots read whole phrases (no English word joined to a label)', async () => {
    const { html } = await panel('fr')
    expect(html).toContain('>Logo</span>')
    expect(html).toContain('>Ajouter un logo</span>')
    expect(html).toContain('>Ajouter une couverture</span>')
    expect(html).not.toMatch(/Add logo|Add cover/)
  })
})

describe('member-written text', () => {
  it("a business's own name, description and place keep their direction and take no page language", async () => {
    const { html } = await panel('en')
    expect(html).toContain('<h3 lang="" dir="auto" class="truncate font-semibold text-stone-800">مخبز الحي</h3>')
    expect(html).toMatch(/<p lang="" dir="auto"[^>]*>خبز طازج كل صباح<\/p>/)
    expect(html).toContain('<span lang="" dir="auto">Winooski, VT</span>')
  })

  it('is never handed to a translation function: a name or description that equals a code is shown as written', async () => {
    // A business named, word for word, like this panel's own failure codes.
    state.rows = [row({ name: 'load_failed', description: 'upload_failed' })]
    const { html } = await panel('ko')
    expect(html).toContain('<h3 lang="" dir="auto" class="truncate font-semibold text-stone-800">load_failed</h3>')
    expect(html).toMatch(/<p lang="" dir="auto"[^>]*>upload_failed<\/p>/)
    expect(html).not.toContain('업체를 불러오지 못했습니다')
    expect(html).not.toContain('업로드하지 못했습니다')
  })
})

describe('direction of the form fields', () => {
  it('address, phone, website, email, ZIP and social links read left to right in a right-to-left locale', async () => {
    const { html } = await panel('ar')
    for (const id of ['biz-address', 'biz-phone', 'biz-website', 'biz-email', 'biz-zip', 'social-facebook', 'social-instagram', 'social-x', 'social-linkedin', 'social-youtube', 'social-tiktok']) {
      expect(html, id).toMatch(new RegExp(`<input id="${id}"[^>]*dir="ltr"`))
    }
  })

  it('an empty name, description or service field takes the page direction (the placeholder sits on its side); typed text takes its own', async () => {
    const { c, html } = await panel('ar')
    expect(html).toMatch(/<input id="biz-name"[^>]*dir="rtl"/)
    expect(html).toMatch(/<textarea id="biz-desc"[^>]*dir="rtl"/)
    const field = (id: string) => (findAll(c.tree(), (e: El) => e.props.id === id) as El[])[0]
    ;(field('biz-name').props.onChange as (e: unknown) => void)({ target: { value: 'Corner Cafe' } })
    ;(field('biz-desc').props.onChange as (e: unknown) => void)({ target: { value: 'Coffee' } })
    // Add a service row: empty at first.
    const addService = (findAll(c.tree(), (e: El) => e.type === 'button' && Array.isArray(e.props.children) && (e.props.children as unknown[]).includes('إضافة خدمة')) as El[])[0]
    ;(addService.props.onClick as () => void)()
    const after = renderToStaticMarkup(c.rerender() as unknown as ReactElement)
    expect(after).toMatch(/<input id="biz-name"[^>]*dir="auto"/)
    expect(after).toMatch(/<textarea id="biz-desc"[^>]*dir="auto"/)
    expect(after).toMatch(/<input aria-label="اسم الخدمة 1"[^>]*dir="rtl"/)
    expect(after).toMatch(/<input aria-label="وصف الخدمة 1"[^>]*dir="rtl"/)
  })
})

describe('photo pickers and loading', () => {
  it('each file input stays in the tab order (sr-only, not hidden) and its label shows the focus', async () => {
    const { html } = await panel('en')
    const inputs = html.match(/<input type="file"[^>]*>/g) ?? []
    expect(inputs).toHaveLength(3)
    for (const input of inputs) {
      expect(input).toContain('class="sr-only"')
      expect(input).not.toMatch(/class="[^"]*\bhidden\b/)
    }
    expect(html.match(/<label class="[^"]*focus-within:ring-2 focus-within:ring-lime-600[^"]*">/g)).toHaveLength(3)
  })

  it('the list spinner is a status with the word "Loading" for a screen reader', () => {
    // First render, before the list has answered.
    state.language = 'fr'
    const html = renderToStaticMarkup(h(BusinessesPanel))
    expect(html).toMatch(/<div role="status" class="flex items-center justify-center py-10 text-stone-600"><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span class="sr-only">Chargement…<\/span><\/div>/)
  })
})

describe('failures', () => {
  it("the panel's own fallback reads in the member language, unmarked", async () => {
    state.loadError = 'not an Error object'
    const { html } = await panel('ko')
    expect(html).toMatch(/<div role="alert" class="rounded-lg bg-red-100[^"]*">업체를 불러오지 못했습니다<\/div>/)
  })

  it("the server's own text is shown as received and marked English", async () => {
    state.loadError = new Error('permission denied for table organizations')
    const { html } = await panel('ko')
    expect(html).toMatch(/<div role="alert" lang="en" dir="ltr" class="rounded-lg bg-red-100[^"]*">permission denied for table organizations<\/div>/)
  })

  async function submit(language: string) {
    const { c } = await panel(language)
    const input = (findAll(c.tree(), (e: El) => e.props.id === 'biz-name') as El[])[0]
    ;(input.props.onChange as (e: unknown) => void)({ target: { value: 'Corner Cafe' } })
    const form = (findAll(c.rerender(), (e: El) => e.type === 'form') as El[])[0]
    await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault: () => {} })
    await c.flush()
    return renderToStaticMarkup(c.rerender() as unknown as ReactElement)
  }

  it('a refused submit: the sentence is translated around the data layer’s English message, which is marked', async () => {
    state.outcome = { ok: false, error: 'Submission did not persist' }
    const html = await submit('pt')
    expect(html).toContain('Não foi possível enviar: <span lang="en" dir="ltr">Submission did not persist</span>. Tente novamente.')
  })

  it('a submit that throws something that is no Error reads as the plain translated failure', async () => {
    state.submitThrows = 'boom'
    const html = await submit('pt')
    expect(html).toMatch(/<div role="alert"[^>]*>Não foi possível enviar\. Tente novamente\.<\/div>/)
    expect(html).not.toContain('submit_failed')
  })

  it('submitted: the confirmation is translated; the data layer’s English warning is marked English', async () => {
    state.outcome = { ok: true, id: 'new', partial: 'Your business was submitted, but some details could not be saved (hours). You can add them later.' }
    const html = await submit('zh')
    expect(html).toContain('>已提交审核</p>')
    expect(html).toContain('您的商家正在等待审核。')
    expect(html).toMatch(/<p lang="en" dir="ltr" class="mt-1 flex items-start gap-1 text-amber-700">.*Your business was submitted, but some details/)
    expect(html).toMatch(/>完成<\/button>/)
  })

  async function pickLogo(language: string) {
    const { c } = await panel(language)
    const slot = (findAll(c.tree(), (e: El) => typeof e.props.onSelect === 'function') as El[])[0]
    ;(slot.props.onSelect as (f: unknown) => void)({ type: 'image/png', size: 9_000_000 })
    await c.flush()
    return renderToStaticMarkup(c.rerender() as unknown as ReactElement)
  }

  it("a refused photo: the uploader's own message reaches the photo alert, marked English", async () => {
    state.upload = { url: null, path: null, error: 'That image is too large. The limit is 5 MB.' }
    const html = await pickLogo('vi')
    expect(html).toContain('<p role="alert" lang="en" dir="ltr" class="text-xs text-red-600">That image is too large. The limit is 5 MB.</p>')
  })

  it('a refused photo with no message from the uploader reads as the translated failure, unmarked', async () => {
    state.upload = { url: null, path: null, error: null }
    const html = await pickLogo('vi')
    expect(html).toContain('<p role="alert" class="text-xs text-red-600">Tải ảnh lên không thành công. Vui lòng thử lại.</p>')
  })

  it.each(LOCALES)('%s: each of the three codes has its own sentence; other text passes through flagged', (locale) => {
    const texts = ['load_failed', 'upload_failed', 'submit_failed'].map((code) => businessFailure(code, locale))
    expect(texts.every((t) => t.translated)).toBe(true)
    expect(new Set(texts.map((t) => t.text)).size).toBe(3)
    expect(businessFailure('Bucket not found', locale)).toEqual({ text: 'Bucket not found', translated: false })
  })
})

describe('the day switches: label in name (WCAG 2.5.3) and a stable name', () => {
  it('has the 14 locales', () => expect(LOCALES).toHaveLength(14))

  it.each(LOCALES)('%s: each switch is named exactly by the day shown beside it; the seven names differ', async (locale) => {
    const { html } = await panel(locale)
    // <span aria-hidden>DAY</span> … <button role="switch" aria-checked aria-label="DAY">
    const rows = [...html.matchAll(/<span aria-hidden="true" class="text-xs font-semibold text-stone-700">([^<]+)<\/span><span class="inline-flex items-center gap-2"><button type="button" role="switch" aria-checked="(true|false)" aria-label="([^"]+)"/g)]
    expect(rows).toHaveLength(7)
    rows.forEach((m, dow) => {
      expect(m[3], `${locale} day ${dow}`).toBe(m[1])
      expect(m[1]).toBe(hoursDayName(locale, dow))
    })
    expect(new Set(rows.map((m) => m[3])).size).toBe(7)
    // The name holds neither state word.
    for (const m of rows) {
      expect(m[3]).not.toContain(businessesT(locale, 'hoursOpen'))
      expect(m[3]).not.toContain(businessesT(locale, 'hoursClosed'))
    }
  })

  it('flipping a switch changes aria-checked and the word beside it, never the name', async () => {
    const { c } = await panel('es')
    const monday = () => (findAll(c.tree(), (e: El) => e.props.role === 'switch') as El[])[1]
    expect(monday().props['aria-label']).toBe('lunes')
    expect(monday().props['aria-checked']).toBe(false)
    ;(monday().props.onClick as () => void)()
    c.rerender()
    expect(monday().props['aria-label']).toBe('lunes')
    expect(monday().props['aria-checked']).toBe(true)
    const html = renderToStaticMarkup(c.tree() as unknown as ReactElement)
    // The state word is for sighted members: outside the button, hidden from assistive tech.
    expect(html).toMatch(/aria-label="lunes"[^>]*><span[^>]*aria-hidden="true"><\/span><\/button><span aria-hidden="true" class="[^"]*">Abierto<\/span>/)
    expect(html).toMatch(/aria-label="martes"[^>]*><span[^>]*aria-hidden="true"><\/span><\/button><span aria-hidden="true" class="[^"]*">Cerrado<\/span>/)
    // The time fields of the open day name the day too.
    expect(html).toContain('aria-label="Hora de apertura, lunes"')
    expect(html).toContain('aria-label="Hora de cierre, lunes"')
  })

  it('the switch thumb mirrors in a right-to-left locale', async () => {
    const { html } = await panel('ar')
    expect(html).toContain('translate-x-1 rtl:-translate-x-1')
  })

  it('the cost model group is named by its visible label', async () => {
    const { html } = await panel('ru')
    expect(html).toContain('>Вид оплаты</span>')
    expect(html).toContain('role="group" aria-label="Вид оплаты"')
  })
})

describe('vocabulary (lib/business-vocab.ts stored values)', () => {
  it('English labels are the vocabulary file’s own', () => {
    for (const c of BUSINESS_CATEGORIES) expect(businessCategoryLabel(c.value, 'en')).toBe(c.label)
    for (const a of BUSINESS_ATTRIBUTES) expect(businessAttributeLabel(a.key, 'en')).toBe(a.label)
    expect(['free', 'sliding_scale', 'paid'].map((v) => costModelLabel(v, 'en'))).toEqual(['Free', 'Sliding scale', 'Paid'])
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s: every category, attribute and cost model has its own translated label', (locale) => {
    const categories = BUSINESS_CATEGORIES.map((c) => businessCategoryLabel(c.value, locale))
    const attributes = BUSINESS_ATTRIBUTES.map((a) => businessAttributeLabel(a.key, locale))
    const costs = ['free', 'sliding_scale', 'paid'].map((v) => costModelLabel(v, locale))
    expect(new Set(categories).size).toBe(BUSINESS_CATEGORIES.length)
    expect(new Set(attributes).size).toBe(BUSINESS_ATTRIBUTES.length)
    expect(new Set(costs).size).toBe(3)
    for (const [i, label] of attributes.entries()) expect(label, BUSINESS_ATTRIBUTES[i].key).not.toBe(BUSINESS_ATTRIBUTES[i].label)
    for (const [i, label] of costs.entries()) expect(label).not.toBe(['Free', 'Sliding scale', 'Paid'][i])
  })

  it('an unknown stored value is shown as stored', () => {
    expect(businessCategoryLabel('pet_care', 'fr')).toBe('pet_care')
    expect(businessAttributeLabel('constructor', 'fr')).toBe('constructor')
  })
})

describe('businesses-panel.tsx source', () => {
  const src = readFileSync(fileURLToPath(new URL('./businesses-panel.tsx', import.meta.url)), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('no English copy is left in the component', () => {
    for (const literal of [
      'Local Businesses', 'Add a local business', 'Submit a local business', 'Could not submit', 'Submitted for review', 'Business name', 'Corner Cafe',
      'Street address', 'title="', "label: '", 'Cost model', 'ZIP code', 'Service radius', 'Copy Monday', "'Closed'", "'Open'", ' open time', 'Remove interval', 'className="hidden"',
      'Add interval', 'label="', 'Remove gallery photo', 'Service name', 'Remove service', 'Short description', 'Add service', 'Submitting…', "'Submit for review'",
      'No local businesses yet', 'Be the first', 'Failed to load businesses', 'Upload failed', "'Submission failed'", '.toLowerCase()', '{c.label}', '{attr.label}', '{opt.label}', 'DAY_LABELS[dow]',
    ]) {
      expect(code, literal).not.toContain(literal)
    }
  })

  it('no translation reader is given a business\'s own words', () => {
    const READERS = 't|businessesT|feedChromeT|businessFailure|businessCategoryLabel|businessAttributeLabel|costModelLabel'
    const MEMBER_TEXT = 'b\\.name|b\\.description|b\\.city|b\\.state|addr|form\\.name|form\\.description|s\\.name|s\\.description'
    expect(code).not.toMatch(new RegExp(`\\b(${READERS})\\([^()]*\\b(${MEMBER_TEXT})\\b`))
  })

  it('example data placeholders (US formats) stay as written', () => {
    for (const example of ['123 Main St', 'Burlington', '(802) 555-0100', 'https://example.com', 'hello@example.com', '05401']) expect(code).toContain(`placeholder="${example}"`)
  })
})
