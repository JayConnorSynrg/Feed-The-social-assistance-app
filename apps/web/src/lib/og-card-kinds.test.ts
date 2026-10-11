// apps/web/src/lib/og-card-kinds.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A share-preview card and the words that describe it come from one map (og-card-labels.mjs): the
// generator draws the label on the picture, and ogCardAlt says "FEED — <label>" in og:image:alt /
// twitter:image:alt. This test holds the committed pictures to that map: each PNG must be the one
// the manifest recorded, and the manifest must record the label the map has now. Changing a label
// without regenerating the cards (node scripts/generate-og-cards.mjs) fails here.

import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OG_CARD_KINDS, ogCardAlt, postCardKind } from './og-card-kinds'
import { OG_CARD_LABELS } from './og-card-labels.mjs'
import { POST_TYPE_VALUES } from '@/components/feed/post-model'

const cardsDir = fileURLToPath(new URL('./og-cards/', import.meta.url))
const manifest = JSON.parse(readFileSync(cardsDir + 'manifest.json', 'utf8')) as Record<string, { label: string; sha256: string }>

describe('share-preview cards: ten kinds, one label each', () => {
  it('the label map and the manifest name exactly the ten kinds', () => {
    expect(Object.keys(OG_CARD_LABELS).sort()).toEqual([...OG_CARD_KINDS].sort())
    expect(Object.keys(manifest).sort()).toEqual([...OG_CARD_KINDS].sort())
    expect(OG_CARD_KINDS).toHaveLength(10)
  })

  it('every post type has its own card', () => {
    expect(POST_TYPE_VALUES.map((t) => postCardKind(t))).toEqual([...POST_TYPE_VALUES])
    expect(postCardKind('a_future_type')).toBe('feed')
    expect(postCardKind(null)).toBe('feed')
  })
})

describe.each(OG_CARD_KINDS)('card %s', (kind) => {
  const bytes = readFileSync(`${cardsDir}${kind}.png`)

  it('is a 1200 × 630 PNG', () => {
    expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
    expect({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 })
  })

  it('is the picture the generator recorded, drawn with the label the map has now', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest[kind].sha256)
    expect(manifest[kind].label).toBe(OG_CARD_LABELS[kind])
  })

  it('is described by exactly what it shows: "FEED — <label>"', () => {
    expect(ogCardAlt(kind)).toBe(`FEED — ${manifest[kind].label}`)
  })
})

describe('the ten descriptions', () => {
  it('read as written here', () => {
    expect(Object.fromEntries(OG_CARD_KINDS.map((k) => [k, ogCardAlt(k)]))).toEqual({
      feed: 'FEED — Community post',
      resource_post: 'FEED — Shared resource',
      petition: 'FEED — Petition',
      seeker_request: 'FEED — Request for help',
      source_offer: 'FEED — Offer of help',
      event_post: 'FEED — Community event',
      poll: 'FEED — Poll',
      resource: 'FEED — Community resource',
      business: 'FEED — Local business',
      organization: 'FEED — Local organization',
    })
  })
})
