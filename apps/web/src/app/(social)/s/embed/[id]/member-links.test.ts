// apps/web/src/app/(social)/s/embed/[id]/member-links.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Two member links that pointed nowhere now open the post's public page:
//   - the embed widget's "Opt In on FEED" (was /?post=<id>, which nothing reads) -> /s/post/<id>,
//     still escaping the iframe (target="_top");
//   - the community feed's Share (was /post/<id>, no such route) -> generateShareUrl('post', id),
//     the same /s/post/<id> URL the post card shares.

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { POST_ID, APP } = vi.hoisted(() => ({
  POST_ID: '22222222-2222-4222-8222-222222222222',
  APP: 'https://www.sourcetofeed.com',
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => APP }))
vi.mock('@/lib/supabase/server', () => {
  const post = { id: POST_ID, content: 'Need a ride to the clinic', slots_remaining: 1, max_seekers: 2, post_type: 'feed', petition_id: null, resource: null }
  const builder: Record<string, unknown> = {}
  Object.assign(builder, { select: () => builder, eq: () => builder, single: async () => ({ data: post, error: null }) })
  return { createClient: async () => ({ from: () => builder }) }
})

import EmbedWidgetPage from './page'
import { generateShareUrl } from '@/lib/utils/url'

const SRC = fileURLToPath(new URL('../../../../..', import.meta.url))

describe('embed widget — Opt In opens the post page', () => {
  it('the Opt In href is /s/post/<id> and still targets _top', async () => {
    const html = renderToStaticMarkup((await EmbedWidgetPage({ params: Promise.resolve({ id: POST_ID }) })) as ReactElement)
    const btn = html.match(/<a [^>]*data-testid="embed-opt-in-btn"[^>]*>/)?.[0]
    expect(btn).toBeDefined()
    expect(btn).toContain(`href="${APP}/s/post/${POST_ID}"`)
    expect(btn).toContain('target="_top"')
    expect(html).not.toContain('?post=')
  })
})

describe('community feed — Share uses the public post URL', () => {
  it('generateShareUrl(post) is /s/post/<id>, a route that exists', () => {
    expect(generateShareUrl('post', POST_ID)).toMatch(new RegExp(`/s/post/${POST_ID}$`))
    expect(fs.existsSync(path.join(SRC, 'app/(social)/s/post/[id]/page.tsx'))).toBe(true)
  })

  it("feed-panel's handleShare builds its URL with generateShareUrl, not the dead /post/<id> path", () => {
    const src = fs.readFileSync(path.join(SRC, 'components/panels/feed-panel.tsx'), 'utf8')
    const start = src.indexOf('const handleShare = (postId: string) => {')
    expect(start).toBeGreaterThan(0) // CONTROL: the handler is found in the real file
    const body = src.slice(start, src.indexOf('\n  }\n', start))
    expect(body).toContain("const url = generateShareUrl('post', postId)")
    expect(body).not.toMatch(/\/post\/\$\{postId\}/)
  })
})
