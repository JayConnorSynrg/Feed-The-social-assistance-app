/**
 * /api/oembed — oEmbed 1.0 provider endpoint (JSON-only; XML returns 501)
 *
 * Spec: https://oembed.com/#section2
 *
 * Supported URL patterns (both treated as the same embed canonical):
 *   /s/embed/{id}
 *   /s/post/{id}
 *
 * Query params:
 *   url        — the page URL to resolve (required)
 *   maxwidth   — optional max iframe width: a whole number of pixels, 1 or more. The response never
 *                exceeds it; zero, a negative number or a non-number is treated as not sent.
 *   maxheight  — optional max iframe height, same rule
 *   format     — optional; "json" (default) supported; "xml" → 501
 *
 * Response shape (type=rich):
 *   {
 *     type: 'rich',
 *     version: '1.0',
 *     provider_name: 'FEED',
 *     provider_url: <appUrl>,
 *     title: <post title>,
 *     html: '<iframe …>',
 *     width: <number>,
 *     height: <number>,
 *     thumbnail_url: <og image url>,
 *     thumbnail_width: 1200,
 *     thumbnail_height: 630,
 *   }
 *
 * Accepted origins: the app's own origin and its www / apex twin (https://sourcetofeed.com and
 * https://www.sourcetofeed.com). Outside production, http(s)://localhost and 127.0.0.1 are accepted
 * too, for local development. The response's provider_url, iframe src and thumbnail_url always use
 * the app's canonical origin and the id of the post row the database returned, never text taken
 * from the submitted URL.
 *
 * Accepted paths: exactly /s/embed/{uuid} or /s/post/{uuid} (one optional trailing slash). An id
 * written in uppercase is the same post and is looked up in lowercase.
 *
 * Error behaviour:
 *   400 — url param missing or not a FEED /s/embed or /s/post URL
 *   404 — post not found or is_hidden
 *   501 — format=xml requested
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppUrlFromHeaders } from '@/lib/utils/url-server'

// Default iframe dimensions per oEmbed convention
const DEFAULT_WIDTH = 480
const DEFAULT_HEIGHT = 270

// Exactly /s/embed/{uuid} or /s/post/{uuid}: nothing before, nothing after but one optional
// trailing slash. Capture group 1 = the post id, lowercase hex in the 8-4-4-4-12 shape.
const EMBED_PATH_RE = /^\/s\/(?:embed|post)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/

/**
 * The post id a share path names, or null when the path is not one of ours. A UUID is the same id
 * in either letter case (the share pages accept both), so the id segment — and only it — is
 * lowercased before the match.
 */
function sharedPostId(pathname: string): string | null {
  const path = pathname.replace(/\/[0-9A-Fa-f-]{36}\/?$/, (idSegment) => idSegment.toLowerCase())
  return EMBED_PATH_RE.exec(path)?.[1] ?? null
}

/**
 * Local development only: http(s)://localhost or http(s)://127.0.0.1, on any port. Exact host names,
 * never a suffix or prefix match, and never in production.
 */
function isLocalDevUrl(url: URL): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  )
}

/**
 * A maxwidth / maxheight hint as pixels: a whole number from 1 up to our default size. Absent, zero,
 * negative or not a number means no usable limit was sent, so the default applies; a larger number
 * is capped at the default (the response must not exceed the requested maximum).
 */
function dimension(raw: string | null, fallback: number): number {
  const asked = raw === null ? NaN : Number.parseInt(raw, 10)
  return Number.isFinite(asked) && asked >= 1 ? Math.min(asked, fallback) : fallback
}

/**
 * The origins whose share links this provider answers for: the app's own origin and its www / apex
 * twin (same scheme, same port). FEED is served on both — the apex redirects to www — so a link
 * copied from either address bar is one of ours. Exact origin comparison: no suffix matching.
 */
function ownOrigins(appOrigin: string): Set<string> {
  const twin = new URL(appOrigin)
  twin.hostname = twin.hostname.startsWith('www.') ? twin.hostname.slice(4) : `www.${twin.hostname}`
  return new Set([appOrigin, twin.origin])
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const urlParam = searchParams.get('url')
  const format = searchParams.get('format') ?? 'json'

  // format=xml is spec-permitted to return 501
  if (format === 'xml') {
    return NextResponse.json(
      { error: 'XML format not supported. Use format=json or omit the format parameter.' },
      { status: 501 }
    )
  }

  if (!urlParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: url' },
      { status: 400 }
    )
  }

  // Parse the submitted URL to validate origin + extract post ID
  let submittedUrl: URL
  try {
    submittedUrl = new URL(urlParam)
  } catch {
    return NextResponse.json(
      { error: 'Invalid url parameter — must be a fully qualified URL' },
      { status: 400 }
    )
  }

  const appUrl = await getAppUrlFromHeaders()
  let appOrigin: string
  try {
    appOrigin = new URL(appUrl).origin
  } catch {
    appOrigin = 'https://www.sourcetofeed.com'
  }

  // Reject URLs from foreign origins to prevent open-proxy abuse. Our own apex and www addresses are
  // both accepted; the URLs in the response always use appUrl, whichever of the two was submitted.
  if (!ownOrigins(appOrigin).has(submittedUrl.origin) && !isLocalDevUrl(submittedUrl)) {
    return NextResponse.json(
      { error: 'URL origin does not match this provider' },
      { status: 400 }
    )
  }

  // Extract post ID from path
  const postId = sharedPostId(submittedUrl.pathname)
  if (!postId) {
    return NextResponse.json(
      { error: 'URL does not match a supported FEED embed or post path (/s/embed/{id} or /s/post/{id})' },
      { status: 400 }
    )
  }

  // Fetch post — anon client (posts_select_public RLS: NOT is_hidden)
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('posts')
    // Use explicit FK hint to avoid PGRST201 ambiguity (posts has 2 FK paths to profiles)
    .select('id, content, post_type, petition_id, user:profiles!posts_user_id_fkey(first_name, username)')
    .eq('id', postId)
    .eq('is_hidden', false)
    .single()

  if (!post) {
    return NextResponse.json(
      { error: 'Post not found' },
      { status: 404 }
    )
  }

  const postType = (post.post_type as string | null) ?? 'feed'
  const petitionId = (post as { petition_id?: string | null }).petition_id ?? null
  const user = post.user as { first_name: string | null; username: string | null } | null
  const authorName = user?.first_name || 'Community Member'

  // Derive a title — for petitions try to fetch the approved petition title
  let title = `${authorName} on FEED`

  if (postType === 'petition' && petitionId) {
    const { data: petition } = await supabase
      .from('petitions')
      .select('title')
      .eq('id', petitionId)
      .eq('status', 'approved')
      .single()

    if (petition?.title) {
      title = `${petition.title} — FEED Community Petition`
    }
  }

  // maxwidth / maxheight hints (oEmbed spec: the response must not exceed the requested maximum)
  const width = dimension(searchParams.get('maxwidth'), DEFAULT_WIDTH)
  const height = dimension(searchParams.get('maxheight'), DEFAULT_HEIGHT)

  // Canonical embed URL is always /s/embed/{id}. Both URLs are built from the id of the row the
  // database returned, so nothing from the submitted URL is copied into the response.
  const embedUrl = `${appUrl}/s/embed/${post.id}`
  const thumbnailUrl = `${appUrl}/api/og/post/${post.id}`

  const html =
    `<iframe ` +
    `src="${embedUrl}" ` +
    `width="${width}" ` +
    `height="${height}" ` +
    `frameborder="0" ` +
    `scrolling="no" ` +
    `allowtransparency="true" ` +
    `title="${title.replace(/"/g, '&quot;')}"` +
    `></iframe>`

  const body = {
    type: 'rich' as const,
    version: '1.0',
    provider_name: 'FEED',
    provider_url: appUrl,
    title,
    html,
    width,
    height,
    thumbnail_url: thumbnailUrl,
    thumbnail_width: 1200,
    thumbnail_height: 630,
  }

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Allow crawlers + oEmbed consumers to cache for 5 minutes
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
