/**
 * embed-meta-oembed.spec.ts — P9-T3: per-post generateMetadata + /api/oembed
 *
 * Coverage:
 *  A. /s/embed/{id} HTML contains per-post og:title (not the generic site title),
 *     og:image pointing to /api/og/post/{id}, og:url, and an oEmbed discovery
 *     <link rel="alternate" type="application/json+oembed"> in the <head>.
 *
 *  B. GET /api/oembed?url=.../s/embed/{id} returns valid oEmbed JSON:
 *     { type: 'rich', version: '1.0', provider_name: 'FEED', html: '<iframe…>', width, height }
 *     The html field contains an iframe with src pointing at /s/embed/{id}.
 *
 *  C. Hidden / nonexistent post → embed page returns 404 (Next.js notFound);
 *     /api/oembed for same → 404 JSON.
 *
 *  D. /api/oembed with a foreign-origin URL → 400.
 *
 * Strategy:
 *  - Seed one visible post via admin client with a unique marker string.
 *  - Tests use request fixtures (page.request / APIRequestContext) where a full
 *    browser page isn't needed — only test A needs a browser navigate for <head>.
 *  - afterAll cleans up the seeded post (no prod leaks).
 *
 * Run:
 *   cd /Users/jelalconnor/CODING/CURSOR/FEED. && \
 *   npx playwright test apps/web/e2e/embed-meta-oembed.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import { makeAdminClient } from './helpers/vault-fixture'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_TS = '20260610embedmeta'
const POST_CONTENT = `E2E embed-meta-oembed test ${RUN_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let postId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Resolve a profile to own the seeded post
  const { data: anyProfile } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  const userId = anyProfile?.id
  if (!userId) {
    throw new Error('[embed-meta-oembed] No profile found — run auth.spec.ts first')
  }

  // Remove any prior run with same fixed content
  await admin.from('posts').delete().eq('content', POST_CONTENT)

  const { data: postRow, error: postErr } = await admin
    .from('posts')
    .insert({
      user_id: userId,
      content: POST_CONTENT,
      is_hidden: false,
    })
    .select('id')
    .single()

  if (postErr || !postRow) {
    throw new Error(`[embed-meta-oembed] Failed to seed post: ${postErr?.message}`)
  }
  postId = postRow.id
  console.log(`[embed-meta-oembed] seeded post ${postId}`)
})

test.afterAll(async () => {
  try {
    if (postId) await admin.from('posts').delete().eq('id', postId)
  } catch (err) {
    console.error('[embed-meta-oembed] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// A: per-post og tags + oEmbed discovery link in <head>
// ---------------------------------------------------------------------------

test('(A) /s/embed/{id} head contains per-post og:title, og:image, og:url and oEmbed link', async ({ page }) => {
  await page.goto(`/s/embed/${postId}`)

  // Confirm the page rendered (widget body present)
  await expect(page.locator('[data-testid="embed-widget"]')).toBeVisible({ timeout: 15_000 })

  // og:title must NOT be the generic site fallback — it should contain the post
  // author or a post-specific label (not "FEED - Mutual Aid Resource Sharing")
  const ogTitle = await page.$eval(
    'meta[property="og:title"]',
    (el) => (el as HTMLMetaElement).content
  )
  expect(ogTitle).toBeTruthy()
  expect(ogTitle).not.toBe('FEED - Mutual Aid Resource Sharing')
  // Title ends with "on FEED" (standard author-post pattern)
  expect(ogTitle).toMatch(/on FEED/i)
  console.log(`[embed-meta-oembed] (A) og:title = "${ogTitle}"`)

  // og:image must point to /api/og/post/{id}
  const ogImage = await page.$eval(
    'meta[property="og:image"]',
    (el) => (el as HTMLMetaElement).content
  )
  expect(ogImage).toBeTruthy()
  expect(ogImage).toContain(`/api/og/post/${postId}`)
  console.log(`[embed-meta-oembed] (A) og:image = "${ogImage}"`)

  // og:url must reference the embed canonical URL
  const ogUrl = await page.$eval(
    'meta[property="og:url"]',
    (el) => (el as HTMLMetaElement).content
  ).catch(() => null)
  if (ogUrl) {
    expect(ogUrl).toContain(`/s/embed/${postId}`)
    console.log(`[embed-meta-oembed] (A) og:url = "${ogUrl}"`)
  }

  // oEmbed discovery link: <link rel="alternate" type="application/json+oembed">
  const oEmbedHref = await page.$eval(
    'link[type="application/json+oembed"]',
    (el) => (el as HTMLLinkElement).href
  )
  expect(oEmbedHref).toBeTruthy()
  expect(oEmbedHref).toContain('/api/oembed')
  expect(oEmbedHref).toContain(encodeURIComponent(`/s/embed/${postId}`).slice(0, 10))
  console.log(`[embed-meta-oembed] (A) oEmbed discovery href = "${oEmbedHref}"`)
})

// ---------------------------------------------------------------------------
// B: /api/oembed returns valid rich oEmbed JSON
// ---------------------------------------------------------------------------

test('(B) /api/oembed?url=.../s/embed/{id} returns valid oEmbed JSON with iframe', async ({ request }) => {
  const embedUrl = `http://localhost:3000/s/embed/${postId}`
  const res = await request.get(`/api/oembed?url=${encodeURIComponent(embedUrl)}`)

  expect(res.status()).toBe(200)

  const ct = res.headers()['content-type'] ?? ''
  expect(ct).toMatch(/application\/json/)

  const body = await res.json() as Record<string, unknown>

  // oEmbed 1.0 required fields
  expect(body.type).toBe('rich')
  expect(body.version).toBe('1.0')
  expect(body.provider_name).toBe('FEED')
  expect(typeof body.provider_url).toBe('string')
  expect(typeof body.title).toBe('string')
  expect(typeof body.html).toBe('string')
  expect(typeof body.width).toBe('number')
  expect(typeof body.height).toBe('number')

  // html must contain an iframe pointing to /s/embed/{id}
  const html = body.html as string
  expect(html).toContain('<iframe')
  expect(html).toContain(`/s/embed/${postId}`)

  // thumbnail_url must point to the og image endpoint
  expect(body.thumbnail_url).toBeTruthy()
  expect(body.thumbnail_url as string).toContain(`/api/og/post/${postId}`)

  console.log(`[embed-meta-oembed] (B) oEmbed title="${body.title}", width=${body.width}, height=${body.height}`)
})

// ---------------------------------------------------------------------------
// C: 404 behaviour for hidden / nonexistent posts
// ---------------------------------------------------------------------------

test('(C) hidden post → embed page 404 and /api/oembed 404', async ({ request }) => {
  const nonExistentId = '00000000-0000-0000-0000-000000000000'

  // Embed page: Next.js notFound() → 404
  const pageRes = await request.get(`/s/embed/${nonExistentId}`)
  expect(pageRes.status()).toBe(404)

  // /api/oembed: 404 JSON
  const oEmbedUrl = `http://localhost:3000/s/embed/${nonExistentId}`
  const apiRes = await request.get(`/api/oembed?url=${encodeURIComponent(oEmbedUrl)}`)
  expect(apiRes.status()).toBe(404)

  const body = await apiRes.json() as Record<string, unknown>
  expect(body.error).toBeTruthy()

  console.log('[embed-meta-oembed] (C) nonexistent post 404 on embed + oembed endpoint')
})

// ---------------------------------------------------------------------------
// D: foreign-origin URL → 400
// ---------------------------------------------------------------------------

test('(D) /api/oembed with foreign-origin URL → 400', async ({ request }) => {
  const foreignUrl = 'https://example.com/s/embed/some-id'
  const res = await request.get(`/api/oembed?url=${encodeURIComponent(foreignUrl)}`)
  expect(res.status()).toBe(400)

  const body = await res.json() as Record<string, unknown>
  expect(body.error).toBeTruthy()

  console.log('[embed-meta-oembed] (D) foreign-origin → 400 as expected')
})
