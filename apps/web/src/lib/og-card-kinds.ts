// apps/web/src/lib/og-card-kinds.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ten share-preview card kinds, which kind a post gets, and the words that describe each card.
// Pure (no file or network access), so the share pages can import it for their metadata; the image
// routes' serving code is in lib/og-card.ts. Rule and design: docs/share-previews.md.

import type { Database } from '@feed/database'
import { OG_CARD_LABELS } from './og-card-labels.mjs'

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

// Every kind has a label (a missing one fails the type check here).
const LABELS: Record<OgCardKind, string> = OG_CARD_LABELS

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
 * The text alternative for a kind's card, e.g. "FEED — Request for help": everything the picture
 * shows, and nothing about the item (its title and text are in og:title / og:description). Sent as
 * og:image:alt and twitter:image:alt.
 */
export function ogCardAlt(kind: OgCardKind): string {
  return `FEED — ${LABELS[kind]}`
}
