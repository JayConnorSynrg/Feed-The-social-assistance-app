// apps/web/src/app/(social)/s/share-locale.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A shared post's preview is marked with the language the post is written in: /s/post/[id] and
// /s/embed/[id] set og:locale from posts.lang, and og:title / og:description keep carrying the text
// itself as plain UTF-8 (the preview image carries none — docs/share-previews.md). Runs the real
// generateMetadata of both pages against a row from a fake server client.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db } = vi.hoisted(() => ({
  db: { row: null as Record<string, unknown> | null, selects: [] as Array<{ table: string; columns: string }> },
}))

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://sourcetofeed.com' }))
vi.mock('@/components/feed/post-admin-edit-link', () => ({ PostAdminEditLink: () => null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      q.select = (columns: string) => {
        db.selects.push({ table, columns })
        return q
      }
      q.eq = () => q
      q.single = async () => (db.row ? { data: db.row, error: null } : { data: null, error: { code: 'PGRST116' } })
      return q
    },
    rpc: async () => ({ data: [], error: null }),
  }),
}))

import { generateMetadata as postMetadata } from './post/[id]/page'
import { generateMetadata as embedMetadata } from './embed/[id]/page'
import { ogLocaleForLang } from '@/lib/og-locale'

const ID = '11111111-1111-4111-8111-111111111111'
const params = Promise.resolve({ id: ID })

const TEXT = {
  ar: 'وجبات ساخنة مجانية هذا السبت في المركز المجتمعي.',
  am: 'በዚህ ቅዳሜ በማህበረሰብ ማዕከል ነፃ ትኩስ ምግብ።',
  zh: '本周六社区中心提供免费热餐。欢迎所有人。',
  en: 'Free hot meals this Saturday at the community center.',
}

function post(lang: string | null, content: string): Record<string, unknown> {
  return {
    id: ID,
    content,
    lang,
    post_type: 'feed',
    petition_id: null,
    image_url: null,
    like_count: 0,
    comment_count: 0,
    user: { id: 'u1', first_name: 'Maria', username: 'maria', avatar_url: null, admin_tier: null },
  }
}

type OpenGraph = { locale?: string; title?: string; description?: string; images?: Array<{ url: string }> }

const PAGES = [
  { page: '/s/post', metadata: postMetadata },
  { page: '/s/embed', metadata: embedMetadata },
] as const

beforeEach(() => {
  db.row = null
  db.selects.length = 0
})

describe.each(PAGES)('$page: og:locale comes from posts.lang', ({ metadata }) => {
  it.each([
    ['ar', 'ar_AR', TEXT.ar],
    ['am', 'am_ET', TEXT.am],
    ['zh', 'zh_CN', TEXT.zh],
    ['en', 'en_US', TEXT.en],
  ])('lang %s → og:locale %s, with the text unchanged in og:description', async (lang, expected, content) => {
    db.row = post(lang, content)
    const meta = await metadata({ params })
    const og = meta.openGraph as OpenGraph
    expect(og.locale).toBe(expected)
    expect(og.description).toBe(content)
    expect(meta.description).toBe(content)
    expect(og.title).toBe('Maria on FEED')
  })

  it('a post with no language (lang null) emits no og:locale', async () => {
    db.row = post(null, TEXT.en)
    const og = (await metadata({ params })).openGraph as OpenGraph
    expect(og).toBeDefined()
    expect('locale' in og).toBe(false)
    expect(og.description).toBe(TEXT.en)
  })

  it('Hmong (hmn) has no valid og:locale value, so the tag is omitted rather than written wrong', async () => {
    db.row = post('hmn', 'Noj mov kub dawb hnub Saturday no ntawm lub chaw zej zog.')
    const og = (await metadata({ params })).openGraph as OpenGraph
    expect('locale' in og).toBe(false)
  })

  it('a language code outside the 14 emits no og:locale', async () => {
    db.row = post('xx', TEXT.en)
    expect('locale' in ((await metadata({ params })).openGraph as OpenGraph)).toBe(false)
  })

  it('the preview image URL is unchanged', async () => {
    db.row = post('ar', TEXT.ar)
    const og = (await metadata({ params })).openGraph as OpenGraph
    expect(og.images?.[0].url).toBe(`https://sourcetofeed.com/api/og/post/${ID}`)
  })

  it('a hidden or unknown post still answers "Post Not Found" metadata', async () => {
    db.row = null
    expect(await metadata({ params })).toEqual({ title: 'Post Not Found - FEED' })
  })
})

describe('the post read', () => {
  it('/s/post reads lang with the page columns; the author columns are the same five as before', async () => {
    db.row = post('ar', TEXT.ar)
    await postMetadata({ params })
    expect(db.selects).toEqual([
      {
        table: 'posts',
        columns:
          'id, content, lang, post_type, image_url, like_count, comment_count, user:profiles!posts_user_id_fkey(id, first_name, username, avatar_url, admin_tier)',
      },
    ])
  })

  it('/s/embed reads lang; its author columns are the same two as before', async () => {
    db.row = post('ar', TEXT.ar)
    await embedMetadata({ params })
    expect(db.selects).toEqual([
      { table: 'posts', columns: 'content, lang, post_type, petition_id, user:profiles!posts_user_id_fkey(first_name, username)' },
    ])
  })
})

describe('ogLocaleForLang: the 14 locales', () => {
  it('maps thirteen codes to language_TERRITORY and omits Hmong', () => {
    const codes = ['en', 'es', 'ht', 'vi', 'ar', 'zh', 'so', 'fr', 'pt', 'ru', 'ko', 'tl', 'am', 'hmn']
    expect(Object.fromEntries(codes.map((c) => [c, ogLocaleForLang(c) ?? null]))).toEqual({
      en: 'en_US',
      es: 'es_LA',
      ht: 'ht_HT',
      vi: 'vi_VN',
      ar: 'ar_AR',
      zh: 'zh_CN',
      so: 'so_SO',
      fr: 'fr_FR',
      pt: 'pt_BR',
      ru: 'ru_RU',
      ko: 'ko_KR',
      tl: 'tl_PH',
      am: 'am_ET',
      hmn: null,
    })
  })

  it('every value has the Open Graph shape: two-letter language, underscore, two-letter territory', () => {
    for (const code of ['en', 'es', 'ht', 'vi', 'ar', 'zh', 'so', 'fr', 'pt', 'ru', 'ko', 'tl', 'am']) {
      expect(ogLocaleForLang(code), code).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
      expect(ogLocaleForLang(code)!.slice(0, 2), code).toBe(code)
    }
  })

  it('null, undefined, empty and inherited property names give no value', () => {
    for (const v of [null, undefined, '', 'toString', 'constructor', '__proto__', 'EN', 'en_US']) {
      expect(ogLocaleForLang(v), String(v)).toBeUndefined()
    }
  })
})
