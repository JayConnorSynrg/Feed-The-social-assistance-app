// apps/web/src/components/panels/petitions-panel.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the Petitions sub-tab in that language. The REAL panel,
// rendered with a faked usePetitions:
//   - every state (loading, failed, empty, list, signed list) in the member's language, the root
//     marked with it (Arabic: rtl);
//   - a count reads in the language's plural form with its own digits and grouping;
//   - the hook's failure codes become sentences; no English sentence reaches the screen;
//   - a petition's title and summary and the member's name keep their own direction;
//   - each button's accessible name starts with the text on the button;
//   - ArrowLeft / ArrowRight on the All / Signed tabs follow the reading direction.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state, events } = vi.hoisted(() => ({
  state: {
    language: 'en',
    guest: false,
    signedIn: true,
    hook: {} as Record<string, unknown>,
  },
  events: [] as unknown[][],
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    profile: state.signedIn ? { preferred_language: state.language, full_name: 'مريم ناصر' } : null,
    isAuthenticated: state.signedIn,
    isAnonymous: state.guest,
  }),
}))
vi.mock('@/hooks/use-petitions', () => ({ usePetitions: () => state.hook }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (...args: unknown[]) => events.push(args),
}))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { petitionsT } from '@/lib/i18n-feed-petitions'
import { PetitionsPanel, petitionActionName } from './petitions-panel'

const LOCALES = Object.keys(messages) as Locale[]
const petition = (over: Record<string, unknown> = {}) => ({
  id: 'p1', title: 'أنقذوا الحديقة', summary: 'نطلب من المدينة إبقاء الحديقة مفتوحة', body: '', cause_category: 'land_rights', external_ref: null,
  target_signatures: 2500, body_version_hash: 'h', status: 'approved', created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: null,
  exported_at: null, exported_by: null, signatureCount: 1234, hasSigned: false, isLocked: false, ...over,
})
const hook = (over: Record<string, unknown> = {}) => ({
  petitions: [petition()], loading: false, error: null, sign: vi.fn(), withdraw: vi.fn(), signingId: null, signError: null, refresh: vi.fn(), ...over,
})
const render = (language: string, over: Record<string, unknown> = {}) => {
  state.language = language
  state.hook = hook(over)
  return renderToStaticMarkup(h(PetitionsPanel))
}

beforeEach(() => {
  state.guest = false
  state.signedIn = true
  events.length = 0
})

describe('Petitions sub-tab in the member language', () => {
  it('es: heading, tabs, FAQ toggle, category, count, percent and the sign button; root marked es, ltr', () => {
    const html = render('es')
    expect(html).toMatch(/^<div lang="es" dir="ltr"/)
    expect(html).toContain('>Peticiones de la comunidad</h2>')
    expect(html).toContain('aria-label="Vista de peticiones"')
    expect(html).toMatch(/data-testid="petitions-tab-all"[^>]*>Todas las peticiones</)
    expect(html).toMatch(/data-testid="petitions-tab-signed"[^>]*>Firmadas</)
    expect(html).toContain('Acerca de las firmas de peticiones')
    expect(html).toContain('>Derechos sobre la tierra</span>')
    expect(html).toContain('<span class="font-semibold text-stone-900">1234</span> de 2500 firmas')
    expect(html.replace(/ /g, ' ')).toContain('>49 %</span>')
    expect(html).toContain('Añade tu firma verificada de apoyo</button>')
    expect(html).toContain('Tu nombre, la fecha y un registro de esta versión de la petición')
    expect(html).not.toMatch(/Community Petitions|All petitions|>Signed<|About petition signatures|Land Rights|signatures<|Add your verified/)
  })

  it('ar: Arabic copy, dir="rtl", and the "few" plural form for a target of 3', () => {
    const html = render('ar', { petitions: [petition({ target_signatures: 3, signatureCount: 2 })] })
    expect(html).toMatch(/^<div lang="ar" dir="rtl"/)
    expect(html).toContain('>عرائض المجتمع</h2>')
    expect(html).toContain('<span class="font-semibold text-stone-900">2</span> من 3 توقيعات')
    expect(html).toContain('أضف توقيع الدعم الموثَّق الخاص بك</button>')
  })

  it('ru: one / few / many forms when a petition has no target', () => {
    const line = (n: number) => render('ru', { petitions: [petition({ target_signatures: 0, signatureCount: n })] }).match(/<span class="font-semibold text-stone-900">\d+<\/span>([^<]*)</)?.[1]
    expect(line(1)).toBe(' подтверждённая подпись')
    expect(line(3)).toBe(' подтверждённые подписи')
    expect(line(5)).toBe(' подтверждённых подписей')
  })

  it('en: the count groups its digits; ht keeps one noun form', () => {
    expect(render('en')).toContain('<span class="font-semibold text-stone-900">1,234</span> of 2,500 signatures')
    expect(render('en', { petitions: [petition({ target_signatures: 1, signatureCount: 1 })] })).toContain('</span> of 1 signature<')
    expect(render('ht', { petitions: [petition({ target_signatures: 1, signatureCount: 1 })] })).toContain('</span> sou 1 siyati<')
  })

  it('the progress bar has a name in the member language', () => {
    expect(render('fr')).toMatch(/role="progressbar" aria-label="Progression des signatures" aria-valuenow="49"/)
  })

  it('loading, failed and empty states read in the member language, each root marked', () => {
    expect(render('vi', { loading: true })).toMatch(/^<div lang="vi" dir="ltr"[^>]*>.*Đang tải kiến nghị…/)
    const failed = render('ko', { error: 'load_failed' })
    expect(failed).toMatch(/^<div lang="ko" dir="ltr"/)
    expect(failed).toContain('>청원을 불러올 수 없습니다. 다시 시도해 주세요.</p>')
    expect(failed).toContain('다시 시도</button>')
    const empty = render('am', { petitions: [] })
    expect(empty).toMatch(/^<div lang="am" dir="ltr"/)
    expect(empty).toContain('ንቁ አቤቱታዎች የሉም')
  })

  it('a signed petition: Signed, the withdraw button, and the locked sentence once exported', () => {
    const open = render('pt', { petitions: [petition({ hasSigned: true })] })
    expect(open).toContain('>Assinada</span>')
    expect(open).toContain('Retirar minha assinatura</button>')
    const locked = render('pt', { petitions: [petition({ hasSigned: true, isLocked: true })] })
    expect(locked).toContain('As assinaturas são definitivas (a lista foi exportada).')
    expect(locked).not.toContain('Retirar minha assinatura')
  })

  it.each([
    ['account_required', 'Connectez-vous avec un compte pour ajouter votre signature de soutien vérifiée.'],
    ['affirmation_required', 'Vous devez confirmer pour ajouter votre signature de soutien vérifiée.'],
    ['sign_failed', 'Impossible d’ajouter votre signature. Veuillez réessayer.'],
    ['petition_not_found', 'Impossible d’ajouter votre signature. Veuillez réessayer.'],
  ])('sign failure code %s reads as its French sentence', (code, sentence) => {
    const html = render('fr', { signingId: 'p1', signError: code })
    expect(html).toContain(`<span>${sentence}</span>`)
    expect(html).not.toContain(`>${code}<`)
  })

  it.each([
    ['withdraw_locked', 'Las firmas son definitivas: la persona organizadora ya exportó esta lista.'],
    ['withdraw_failed', 'No se pudo retirar tu firma. Inténtalo de nuevo.'],
  ])('withdraw failure code %s reads as its Spanish sentence', (code, sentence) => {
    expect(render('es', { petitions: [petition({ hasSigned: true })], signingId: 'p1', signError: code })).toContain(`<span>${sentence}</span>`)
  })

  it('a guest gets the translated account prompt and link; a logged-out visitor the sign-in sentence', () => {
    state.guest = true
    const guest = render('zh')
    expect(guest).toContain('创建免费账户，即可为请愿添加您的经验证的支持签名')
    expect(guest).toMatch(/data-testid="create-account-prompt-link"[^>]*>创建免费账户</)
    state.guest = false
    state.signedIn = false
    // No profile: the panel reads English until one loads.
    expect(render('zh')).toContain('Sign in to add your verified signature of support to any petition.')
  })
})

describe('member-written text', () => {
  it('title and summary keep their direction and take no page language', () => {
    const html = render('en')
    expect(html).toMatch(/<h3 class="[^"]*" lang="" dir="auto">أنقذوا الحديقة<\/h3>/)
    expect(html).toMatch(/<p class="[^"]*" lang="" dir="auto">نطلب من المدينة إبقاء الحديقة مفتوحة<\/p>/)
  })

  it("the member's own name sits in its own element inside the translated sentence", () => {
    expect(render('en')).toContain('Signing as <span lang="" dir="auto" class="font-medium text-stone-700">مريم ناصر</span>')
    expect(render('ko')).toContain('<span lang="" dir="auto" class="font-medium text-stone-700">مريم ناصر</span> 이름으로 서명합니다')
  })
})

describe('label in name (WCAG 2.5.3)', () => {
  it('has the 14 locales', () => expect(LOCALES).toHaveLength(14))

  it.each(LOCALES)('%s: the sign and withdraw names start with the text on the button, then name the petition', (locale) => {
    for (const action of ['sign', 'withdraw'] as const) {
      const visible = petitionsT(locale, action)
      const name = petitionActionName(locale, action, 'Save the park')
      expect(name.startsWith(visible), `${locale} ${action}: ${name}`).toBe(true)
      expect(name).toContain('Save the park')
      expect(name).not.toMatch(/\{\w+\}/)
    }
  })

  it('the rendered buttons carry exactly that name; the title is direction-isolated', () => {
    const sign = render('es')
    expect(sign).toContain('aria-label="Añade tu firma verificada de apoyo: ⁨أنقذوا الحديقة⁩"')
    const withdraw = render('es', { petitions: [petition({ hasSigned: true })] })
    expect(withdraw).toContain('aria-label="Retirar mi firma: ⁨أنقذوا الحديقة⁩"')
  })
})

describe('tab arrow keys follow the reading direction', () => {
  type El = { type: unknown; props: Record<string, unknown> }
  function press(language: string, key: string, from: 0 | 1) {
    state.language = language
    state.hook = hook()
    const focused: number[] = []
    const c = mount(() => PetitionsPanel())
    const tabs = () => findAll(c.tree(), (e: El) => e.props.role === 'tab') as El[]
    const els = [0, 1].map((i) => ({ focus: () => focused.push(i) }))
    let prevented = false
    ;(tabs()[from].props.onKeyDown as (e: unknown) => void)({
      key,
      preventDefault: () => { prevented = true },
      currentTarget: { closest: () => ({ querySelectorAll: () => els }) },
    })
    const after = findAll(c.rerender(), (e: El) => e.props.role === 'tab') as El[]
    return { focused, prevented, selected: after.findIndex((t) => t.props['aria-selected'] === true) }
  }

  it('en: ArrowRight moves from All to Signed', () => {
    expect(press('en', 'ArrowRight', 0)).toEqual({ focused: [1], prevented: true, selected: 1 })
    expect(events.at(-1)).toEqual(['nav.subtab.switch', { panel: 'petitions', subtab: 'signed' }])
  })

  it('ar: ArrowLeft moves forward (All to Signed), ArrowRight wraps back', () => {
    expect(press('ar', 'ArrowLeft', 0)).toEqual({ focused: [1], prevented: true, selected: 1 })
    expect(press('ar', 'ArrowRight', 0)).toEqual({ focused: [1], prevented: true, selected: 1 }) // two tabs: back from the first wraps to the last
  })

  it('Home / End jump; another key is left alone', () => {
    expect(press('ar', 'Home', 0)).toEqual({ focused: [0], prevented: true, selected: 0 })
    expect(press('en', 'End', 0)).toEqual({ focused: [1], prevented: true, selected: 1 })
    expect(press('en', 'a', 0)).toEqual({ focused: [], prevented: false, selected: 0 })
  })
})

describe('petitions-panel.tsx and use-petitions.ts sources', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const panel = read('./petitions-panel.tsx')
  const hookSrc = read('../../hooks/use-petitions.ts')

  it('no English copy is left in the component', () => {
    // Code only: comments may still name a tab in English.
    const jsx = panel.slice(panel.indexOf('function PetitionCard(')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const literal of ['Community Petitions', 'All petitions', 'Signed\n', 'Withdraw my signature', 'Add your verified signature', 'Loading petitions', 'Try again', 'No active petitions', 'About petition signatures', 'Only administrators', 'Signing as', 'Create a free account', 'Sign in to add', 'toLocaleString(']) {
      expect(jsx, literal).not.toContain(literal)
    }
    expect(panel).not.toContain('CATEGORY_LABELS')
  })

  it('the arrow keys go through the direction-aware helper', () => {
    expect(panel).toContain('nextTabIndex(e.key, currentIdx, tabs.length, locale)')
    expect(panel).not.toMatch(/e\.key === 'Arrow(Left|Right)'/)
  })

  it('the hook reports codes, never an English sentence', () => {
    expect(hookSrc).toContain("setError('load_failed')")
    expect(hookSrc).toContain("setSignError(serverCode || 'sign_failed')")
    expect(hookSrc).toContain("setSignError('withdraw_locked')")
    expect(hookSrc).toContain("setSignError('withdraw_failed')")
    const set = [...hookSrc.matchAll(/set(?:Sign)?Error\(\s*([^)]*)\)/g)].map((m) => m[1].trim())
    for (const arg of set) expect(arg, arg).toMatch(/^(null|'[a-z_]+'|serverCode \|\| '[a-z_]+')$/)
  })
})
