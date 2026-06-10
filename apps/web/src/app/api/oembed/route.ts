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
 *   maxwidth   — optional max iframe width hint
 *   maxheight  — optional max iframe height hint
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

// Regex that matches /s/embed/{id} and /s/post/{id} paths
// Capture group 1 = post UUID
const EMBED_PATH_RE = /\/s\/(?:embed|post)\/([0-9a-f-]{36})/i

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

  // Reject URLs from foreign origins to prevent open-proxy abuse
  if (submittedUrl.origin !== appOrigin) {
    // In local dev allow localhost regardless of port mismatch
    const isLocalDev =
      submittedUrl.hostname === 'localhost' ||
      submittedUrl.hostname === '127.0.0.1'
    if (!isLocalDev) {
      return NextResponse.json(
        { error: 'URL origin does not match this provider' },
        { status: 400 }
      )
    }
  }

  // Extract post ID from path
  const match = EMBED_PATH_RE.exec(submittedUrl.pathname)
  if (!match) {
    return NextResponse.json(
      { error: 'URL does not match a supported FEED embed or post path (/s/embed/{id} or /s/post/{id})' },
      { status: 400 }
    )
  }
  const postId = match[1]

  // Fetch post — anon client (posts_select_public RLS: NOT is_hidden)
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('posts')
    // Use explicit FK hint to avoid PGRST201 ambiguity (posts has 2 FK paths to profiles)
    .select('id, content, post_type, petition_id, user:profiles!posts_user_id_fkey(full_name, username)')
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
  const user = post.user as { full_name: string | null; username: string | null } | null
  const authorName = user?.full_name || 'Community Member'

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

  // Resolve maxwidth / maxheight hints from query params
  const maxwidth = parseInt(searchParams.get('maxwidth') ?? `${DEFAULT_WIDTH}`, 10) || DEFAULT_WIDTH
  const maxheight = parseInt(searchParams.get('maxheight') ?? `${DEFAULT_HEIGHT}`, 10) || DEFAULT_HEIGHT

  // Clamp to requested max dimensions (oEmbed spec: response must not exceed requested max)
  const width = Math.min(maxwidth, DEFAULT_WIDTH)
  const height = Math.min(maxheight, DEFAULT_HEIGHT)

  // Canonical embed URL is always /s/embed/{id}
  const embedUrl = `${appUrl}/s/embed/${postId}`
  const thumbnailUrl = `${appUrl}/api/og/post/${postId}`

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
