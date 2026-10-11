// apps/web/src/app/(social)/s/share-member-text.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a member wrote keeps its language and direction on the public share pages, so a screen reader
// picks the right voice and right-to-left text is laid out right-to-left even though the page chrome
// is English. The page is lang="en" and text with no lang attribute inherits that, so member text
// always says what it is:
//   - the post's own text carries lang from posts.lang (the author's app language when they posted),
//     or lang="" — unknown — when the post has none, and dir="auto";
//   - a petition's title and summary and a resource's name have no recorded language: lang="" and
//     dir="auto", never the post's language;
//   - the author's name carries dir="auto" only;
//   - a photo is described by the author's own description (posts.image_alt) when there is one, and
//     its wrapper then carries the post's language.
// Also: /s/post and /s/embed each make one identical posts query for the metadata and the page, and
// neither shows a hidden post or an unapproved petition's text.
// Renders the real server pages to HTML.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FilteringDb } from '@/lib/__tests__/filtering-db'

const { rpc } = vi.hoisted(() => ({ rpc: { results: {} as Record<string, unknown> } }))

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => createElement('img', { src: props.src, alt: props.alt, 'data-next-image': '' }),
}))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://sourcetofeed.com' }))
vi.mock('@/components/feed/post-admin-edit-link', () => ({ PostAdminEditLink: () => null }))
vi.mock('@/lib/supabase/server', async () => {
  const { filteringDb } = await import('@/lib/__tests__/filtering-db')
  const fake = filteringDb()
  return {
    createClient: async () => ({
      from: fake.client.from,
      rpc: async (fn: string) => ({ data: rpc.results[fn] ?? [], error: null }),
    }),
    __db: fake,
  }
})

import SharedPostPage, { generateMetadata as postMetadata } from './post/[id]/page'
import EmbedWidgetPage, { generateMetadata as embedMetadata } from './embed/[id]/page'
import * as serverClient from '@/lib/supabase/server'

const db = (serverClient as unknown as { __db: FilteringDb }).__db
const ID = '11111111-1111-4111-8111-111111111111'
const PETITION = '55555555-5555-4555-8555-555555555555'
const params = Promise.resolve({ id: ID })

const AR_BODY = 'وجبات ساخنة مجانية هذا السبت في المركز المجتمعي.'
const AR_NAME = 'فاطمة الزهراء'

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    content: AR_BODY,
    lang: 'ar',
    post_type: 'feed',
    petition_id: null,
    is_hidden: false,
    image_url: null,
    image_alt: null,
    like_count: 0,
    comment_count: 0,
    slots_remaining: null,
    max_seekers: null,
    user: { id: 'u1', first_name: AR_NAME, username: 'fatima', avatar_url: null, admin_tier: null },
    resource: null,
    ...overrides,
  }
}

/** The opening tag of the element whose text content is exactly `text` (HTML-escaped as React writes it). */
function tagAround(html: string, text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
  const end = html.indexOf(`>${escaped}<`)
  expect(end, `an element containing exactly: ${text}`).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf('<', end), end + 1)
}

const renderPost = async () => renderToStaticMarkup(await SharedPostPage({ params }))
const renderEmbed = async () => renderToStaticMarkup(await EmbedWidgetPage({ params }))

beforeEach(() => {
  db.reset()
  rpc.results = {}
})

describe('/s/post: the member\'s text keeps its language and direction', () => {
  it('an Arabic post body carries lang="ar" dir="auto"', async () => {
    db.tables = { posts: [post()] }
    const body = tagAround(await renderPost(), AR_BODY)
    expect(body).toMatch(/^<p /)
    expect(body).toContain('lang="ar"')
    expect(body).toContain('dir="auto"')
  })

  it.each(['am', 'zh', 'es'])('a post written in %s carries that language', async (lang) => {
    db.tables = { posts: [post({ lang, content: 'body text' })] }
    expect(tagAround(await renderPost(), 'body text')).toContain(`lang="${lang}" dir="auto"`)
  })

  it('a post with no language says so: lang="" (unknown), not the page\'s English', async () => {
    db.tables = { posts: [post({ lang: null })] }
    const body = tagAround(await renderPost(), AR_BODY)
    expect(body).toContain('lang="" dir="auto"')
  })

  it('the author\'s name takes its own direction and is not given the post\'s language', async () => {
    db.tables = { posts: [post()] }
    rpc.results = { get_donation_handles: [{ paypal_email: null, venmo_username: 'fatima' }] }
    const html = await renderPost()
    const names = [...html.matchAll(new RegExp(`<span[^>]*>${AR_NAME}</span>`, 'g'))].map((m) => m[0])
    // in the author row, and in "Support <name>"
    expect(names).toHaveLength(2)
    for (const name of names) {
      expect(name).toContain('dir="auto"')
      expect(name).not.toContain('lang=')
    }
    expect(html).toContain(`Support <span dir="auto">${AR_NAME}</span>`)
  })
})

describe('/s/post: a photo is described by its author', () => {
  const photo = 'https://example.supabase.co/storage/v1/object/public/post-images/a.jpg'
  const postPhotoAlt = (html: string) => html.match(/<img[^>]*data-next-image=""[^>]*>/)![0].match(/alt="([^"]*)"/)![1]

  it('posts.image_alt is the image\'s text alternative when the author wrote one', async () => {
    db.tables = { posts: [post({ image_url: photo, image_alt: 'A table of soup pots outside the hall' })] }
    expect(postPhotoAlt(await renderPost())).toBe('A table of soup pots outside the hall')
  })

  it.each([
    ['no description', null],
    ['an empty description', ''],
    ['a blank description', '   '],
  ])('%s falls back to "Post image"', async (_label, imageAlt) => {
    db.tables = { posts: [post({ image_url: photo, image_alt: imageAlt })] }
    expect(postPhotoAlt(await renderPost())).toBe('Post image')
  })

  /** The opening tag of the element that directly wraps the post's photo. */
  const photoWrapper = (html: string) => html.match(/<div[^>]*>(?=<img[^>]*data-next-image="")/)![0]

  it('the author\'s description is in the post\'s language: its wrapper carries lang="ar"', async () => {
    db.tables = { posts: [post({ image_url: photo, image_alt: 'قدور حساء أمام القاعة' })] }
    expect(photoWrapper(await renderPost())).toContain('lang="ar"')
  })

  it('the author\'s description on a post with no language: the wrapper says lang="" (unknown)', async () => {
    db.tables = { posts: [post({ lang: null, image_url: photo, image_alt: 'A table of soup pots' })] }
    expect(photoWrapper(await renderPost())).toContain('lang=""')
  })

  it('the fallback "Post image" is the page\'s own English: the wrapper sets no language', async () => {
    db.tables = { posts: [post({ image_url: photo, image_alt: null })] }
    expect(photoWrapper(await renderPost())).not.toContain('lang=')
  })
})

describe('/s/embed: the member\'s text keeps its language and direction', () => {
  it('an Arabic post body carries lang="ar" dir="auto"', async () => {
    db.tables = { posts: [post()] }
    expect(tagAround(await renderEmbed(), AR_BODY)).toContain('lang="ar" dir="auto"')
  })

  it('a post with no language says so: lang="" (unknown), not the page\'s English', async () => {
    db.tables = { posts: [post({ lang: null })] }
    const body = tagAround(await renderEmbed(), AR_BODY)
    expect(body).toContain('lang="" dir="auto"')
  })

  it('a linked resource\'s name is marked as unknown language (lang=""), never the post\'s language', async () => {
    db.tables = { posts: [post({ resource: { name: 'Riverside Pantry' } })] }
    const name = tagAround(await renderEmbed(), 'Riverside Pantry')
    expect(name).toContain('lang="" dir="auto"')
    expect(name).not.toContain('lang="ar"')
  })

  it('a petition\'s title and summary are marked as unknown language (lang=""), never the post\'s language', async () => {
    db.tables = {
      posts: [post({ post_type: 'petition', petition_id: PETITION })],
      petitions: [{ id: PETITION, status: 'approved', title: 'Keep the pantry open', summary: 'Sign to keep Saturday hours', target_signatures: 100 }],
    }
    const html = await renderEmbed()
    for (const text of ['Keep the pantry open', 'Sign to keep Saturday hours']) {
      const tag = tagAround(html, text)
      expect(tag).toContain('lang="" dir="auto"')
      expect(tag).not.toContain('lang="ar"')
    }
  })

  it('when the petition is not available the title is the post\'s own text, with the post\'s language', async () => {
    db.tables = { posts: [post({ post_type: 'petition', petition_id: PETITION })], petitions: [] }
    expect(tagAround(await renderEmbed(), AR_BODY)).toContain('lang="ar" dir="auto"')
  })
})

describe('what is not public is not shown', () => {
  it('/s/post: a hidden post is "not found" for the page and for its metadata', async () => {
    db.tables = { posts: [post({ is_hidden: true, content: 'Hidden post text' })] }
    await expect(SharedPostPage({ params })).rejects.toThrow('notFound')
    expect(await postMetadata({ params })).toEqual({ title: 'Post Not Found - FEED' })
    // control: the same row, visible, renders
    db.tables = { posts: [post({ content: 'Hidden post text' })] }
    expect(await renderPost()).toContain('Hidden post text')
  })

  it('/s/embed: a hidden post is "not found" for the widget and for its metadata', async () => {
    db.tables = { posts: [post({ is_hidden: true, content: 'Hidden post text' })] }
    await expect(EmbedWidgetPage({ params })).rejects.toThrow('notFound')
    expect(await embedMetadata({ params })).toEqual({ title: 'Post Not Found - FEED' })
    db.tables = { posts: [post({ content: 'Hidden post text' })] }
    expect(await renderEmbed()).toContain('Hidden post text')
  })

  it.each(['draft', 'pending', 'rejected'])('/s/embed: a %s petition\'s title and summary appear nowhere; the post\'s own text is shown', async (status) => {
    const petition = { id: PETITION, status, title: 'Unapproved petition title', summary: 'Unapproved petition summary', target_signatures: 100 }
    db.tables = { posts: [post({ post_type: 'petition', petition_id: PETITION })], petitions: [petition] }
    const html = await renderEmbed()
    expect(html).not.toContain('Unapproved petition title')
    expect(html).not.toContain('Unapproved petition summary')
    expect(tagAround(html, AR_BODY)).toContain('lang="ar" dir="auto"')
    const meta = await embedMetadata({ params })
    expect(JSON.stringify(meta)).not.toContain('Unapproved petition')
    expect(meta.description).toBe(AR_BODY)

    // control: the same petition, approved, is what the widget and the metadata show
    db.tables = { posts: [post({ post_type: 'petition', petition_id: PETITION })], petitions: [{ ...petition, status: 'approved' }] }
    expect(await renderEmbed()).toContain('Unapproved petition title')
    expect(String((await embedMetadata({ params })).title)).toContain('Unapproved petition title')
  })
})

describe('one identical posts query for the metadata and the page', () => {
  const postsReads = () => db.reads.filter((r) => r.table === 'posts')

  it('/s/post', async () => {
    db.tables = { posts: [post()] }
    await postMetadata({ params })
    await renderPost()
    expect(postsReads()).toHaveLength(2) // React cache() folds these into one inside a request
    expect(postsReads()[1]).toEqual(postsReads()[0])
  })

  it('/s/embed', async () => {
    db.tables = { posts: [post()] }
    await embedMetadata({ params })
    await renderEmbed()
    expect(postsReads()).toHaveLength(2)
    expect(postsReads()[1]).toEqual(postsReads()[0])
    expect(postsReads()[0].columns).toBe(
      'id, content, lang, slots_remaining, max_seekers, post_type, petition_id, user:profiles!posts_user_id_fkey(first_name, username), resource:resources(name)'
    )
  })

  it('/s/embed, petition post: one identical petitions query too', async () => {
    db.tables = {
      posts: [post({ post_type: 'petition', petition_id: PETITION })],
      petitions: [{ id: PETITION, status: 'approved', title: 'Keep the pantry open', summary: 'Sign', target_signatures: 100 }],
    }
    await embedMetadata({ params })
    await renderEmbed()
    const petitions = db.reads.filter((r) => r.table === 'petitions')
    expect(petitions).toHaveLength(2)
    expect(petitions[1]).toEqual(petitions[0])
  })
})
