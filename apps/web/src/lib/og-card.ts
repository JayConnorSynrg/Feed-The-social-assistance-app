// apps/web/src/lib/og-card.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Share-preview images (/api/og/*/[id]). Rule (docs/share-previews.md): a preview image carries no
// user text. Each route answers with one of ten pre-rendered cards, chosen only by the item's kind;
// the title, body and author travel as og:title / og:description text on the share page, where each
// platform draws them in its own fonts.
//
// The cards are static PNG files in lib/og-cards/, rendered once by scripts/generate-og-cards.mjs
// from constants. No image renderer, font lookup or emoji lookup runs per request, so nothing about
// the item can reach a third party and every script previews correctly.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Database } from '@feed/database'
import { withMetric } from '@/lib/logger'

type PostType = Database['public']['Enums']['post_type']

/** The ten cards: the seven post types plus the three place kinds. One PNG file each. */
export const OG_CARD_KINDS = [
  'feed',
  'resource_post',
  'petition',
  'seeker_request',
  'source_offer',
  'event_post',
  'poll',
  'resource',
  'business',
  'organization',
] as const

export type OgCardKind = (typeof OG_CARD_KINDS)[number]

/** Which route is answering (a log label; never an item id). */
export type OgSurface = 'post' | 'resource' | 'business' | 'organization'

// A new post_type in the database enum fails the type check here until it is given a card.
const POST_TYPE_CARD: Record<PostType, OgCardKind> = {
  feed: 'feed',
  resource_post: 'resource_post',
  petition: 'petition',
  seeker_request: 'seeker_request',
  source_offer: 'source_offer',
  event_post: 'event_post',
  poll: 'poll',
}

/** The card for a posts.post_type value; a value this build does not know gets the community-post card. */
export function postCardKind(postType: string | null | undefined): OgCardKind {
  return postType != null && Object.prototype.hasOwnProperty.call(POST_TYPE_CARD, postType)
    ? POST_TYPE_CARD[postType as PostType]
    : 'feed'
}

/**
 * A card's bytes depend only on its kind, and an item's kind never changes after it is created, so
 * the image at a given URL is the same for as long as the item is visible: browsers, link crawlers
 * and the CDN may keep it for a year without asking again. (A deployment purges the CDN copy, which
 * is how a redesigned card reaches new shares.) Set on 200 responses only.
 */
export const OG_CARD_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable'

const cards = new Map<OgCardKind, Promise<Uint8Array<ArrayBuffer>>>()

function cardBytes(kind: OgCardKind): Promise<Uint8Array<ArrayBuffer>> {
  let bytes = cards.get(kind)
  if (!bytes) {
    bytes = readFile(path.join(process.cwd(), 'src', 'lib', 'og-cards', `${kind}.png`)).then((file) => new Uint8Array(file))
    bytes.catch(() => cards.delete(kind))
    cards.set(kind, bytes)
  }
  return bytes
}

/**
 * Answer one preview-image request. `findKind` makes the route's single read of FEED's own database
 * and returns the card kind, or null when the item is hidden, deleted, not approved or unknown (the
 * route's 404, with `notFoundText` as its body).
 *
 * Writes one app_logs row per request: og.image.complete with the surface, the kind and
 * outcome ok | not_found (duration in duration_ms), or og.image.error when the request throws.
 */
export function serveOgCard(
  surface: OgSurface,
  notFoundText: string,
  findKind: () => Promise<OgCardKind | null>
): Promise<Response> {
  const attrs: Record<string, string | null> = { surface, kind: null, outcome: 'not_found' }
  return withMetric('og.image', attrs, async () => {
    const kind = await findKind()
    if (!kind) return new Response(notFoundText, { status: 404 })
    const bytes = await cardBytes(kind)
    attrs.kind = kind
    attrs.outcome = 'ok'
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': OG_CARD_CACHE_CONTROL,
      },
    })
  })
}
