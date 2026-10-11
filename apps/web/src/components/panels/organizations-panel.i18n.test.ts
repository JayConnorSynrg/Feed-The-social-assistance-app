// apps/web/src/components/panels/organizations-panel.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the Organizations sub-tab in that language. The REAL panel,
// mounted through effects; only auth, the list reader and Supabase are faked.
//   - heading, description, organization type and empty state in the member's language;
//   - the panel root carries that language and its direction (Arabic: rtl);
//   - an organization's own name and description keep their direction and take no page language;
//   - a failed read shows FEED's sentence, never the server's text (which goes to the log).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('react', async (importOriginal) => {
  const { reactWithHarness } = await import('@/test-utils/ssr-hook-harness')
  const actual = await importOriginal<typeof import('react')>()
  return { ...reactWithHarness(actual), useSyncExternalStore: (_s: unknown, getSnapshot: () => unknown) => getSnapshot() }
})

const { state, errorLog } = vi.hoisted(() => ({
  state: { language: 'en' as string, rows: [] as unknown[], fail: null as Error | null },
  errorLog: [] as unknown[][],
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'member' }, isAnonymous: false, profile: { preferred_language: state.language }, loading: false }),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = { rpc: () => Promise.resolve({ data: null, error: null }) }
  return { createClient: () => client }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: (...args: unknown[]) => errorLog.push(args) },
  logEvent: vi.fn(),
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/hooks/use-geolocation', () => ({
  useGeolocation: () => ({ position: null, getCurrentPosition: vi.fn() }),
  calculateDistance: () => 0,
}))
vi.mock('@/lib/privacy-prefs', () => ({ readShareLocationPref: () => false }))
vi.mock('@/lib/org-data', () => ({
  fetchApprovedOrganizations: async () => {
    if (state.fail) throw state.fail
    return state.rows
  },
}))

import { harness } from '@/test-utils/ssr-hook-harness'
import { resetAdminTierCache } from '@/hooks/use-admin-tier'
import { OrganizationsPanel } from './organizations-panel'

const O1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const row = (over: Record<string, unknown> = {}) => ({
  id: O1, name: 'مطبخ الحي', description: 'وجبات ساخنة كل يوم', org_type: 'food_bank', address: null, city: 'Rutland', state: 'VT', zip_code: null, location: null, ...over,
})

async function render(language: string) {
  state.language = language
  return harness.settle(h(OrganizationsPanel))
}

beforeEach(() => {
  harness.reset()
  resetAdminTierCache()
  state.rows = [row()]
  state.fail = null
  errorLog.length = 0
})

describe('Organizations sub-tab in the member language', () => {
  it('vi: heading, description and the organization type are Vietnamese; the root is marked vi, ltr', async () => {
    const html = await render('vi')
    expect(html).toMatch(/^<div lang="vi" dir="ltr"/)
    expect(html).toContain('>Tổ chức địa phương</h1>')
    expect(html).toContain('Ngân hàng thực phẩm, nơi tạm trú, phòng khám và các tổ chức cộng đồng gần bạn')
    expect(html).toContain('>Ngân hàng thực phẩm</span>')
    expect(html).not.toMatch(/Local Organizations|Food banks, shelters|>Food Bank</)
  })

  it('ar: Arabic copy and dir="rtl" on the root', async () => {
    const html = await render('ar')
    expect(html).toMatch(/^<div lang="ar" dir="rtl"/)
    expect(html).toContain('>المنظمات المحلية</h1>')
    expect(html).toContain('>بنك طعام</span>')
  })

  it('en: the English copy, marked en', async () => {
    const html = await render('en')
    expect(html).toMatch(/^<div lang="en" dir="ltr"/)
    expect(html).toContain('>Local Organizations</h1>')
    expect(html).toContain('>Food bank</span>')
  })

  it("an organization's own name, description and place keep their direction and take no page language", async () => {
    const html = await render('es')
    expect(html).toContain('<h3 lang="" dir="auto" class="truncate font-semibold text-stone-800">مطبخ الحي</h3>')
    expect(html).toMatch(/<p lang="" dir="auto"[^>]*>وجبات ساخنة كل يوم<\/p>/)
    expect(html).toContain('<span lang="" dir="auto">Rutland, VT</span>')
  })

  it('no organization yet: the empty sentence in the member language', async () => {
    state.rows = []
    expect(await render('ht')).toContain('Poko gen òganizasyon.')
    harness.reset()
    expect(await render('hmn')).toContain('Tseem tsis tau muaj koom haum.')
  })

  it("a failed read shows FEED's sentence in the member language; the server's text goes to the log only", async () => {
    state.fail = new Error('permission denied for table organizations')
    const html = await render('so')
    expect(html).toMatch(/role="alert"[^>]*>Hadda lama soo shubi karo ururrada\.</)
    expect(html).not.toContain('permission denied')
    expect(errorLog).toHaveLength(1)
    expect(errorLog[0][0]).toBe('organizations.list.failed')
    expect((errorLog[0][1] as Error).message).toBe('permission denied for table organizations')
  })
})

describe('organizations-panel.tsx source', () => {
  const src = readFileSync(fileURLToPath(new URL('./organizations-panel.tsx', import.meta.url)), 'utf8')

  it('no English copy is left in the component', () => {
    for (const literal of ['Local Organizations', 'Food banks, shelters', 'No organizations yet', 'Failed to load organizations', 'ORG_TYPE_LABELS']) {
      expect(src, literal).not.toContain(literal)
    }
  })

  it('the type label is the vocabulary’s one translation and the distance follows the locale', () => {
    expect(src).toContain('{orgFormT(locale, orgTypeKey(o.org_type))}')
    expect(src).toMatch(/distanceBucketLabel\(bucketForKm\([^\n]+\), locale\)/)
  })
})
