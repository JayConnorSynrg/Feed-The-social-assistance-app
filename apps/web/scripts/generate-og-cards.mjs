// apps/web/scripts/generate-og-cards.mjs
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Renders the ten share-preview cards served by /api/og/*/[id] and writes them, with a manifest, to
// src/lib/og-cards/. Run from apps/web after changing the design or a label:
//
//   node scripts/generate-og-cards.mjs
//
// Rule (docs/share-previews.md): a preview image carries no user text. Everything drawn here is a
// constant: the kind's label (src/lib/og-card-labels.mjs, the same map that describes the picture in
// og:image:alt), a kind icon and colour from this file, and the logo in public/feed-logo.svg. The
// routes serve the committed bytes; no renderer runs per request.
//
// Layout: 1200 x 630. Platforms that show a compact preview crop the picture to its centre square,
// so everything is drawn inside that square (x 285 to 915) with a 30 px margin. The kind label is
// the largest text on the card: 80 px, centred, directly under the kind icon, wrapping to a second
// line when it is long.
//
// The render is closed to the network: any fetch other than a data: or file: URL throws, so a design
// change that would need a remote font or emoji image fails here instead of at request time.

import { createElement as h } from 'react'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OG_CARD_LABELS } from '../src/lib/og-card-labels.mjs'

// next/og is CommonJS with no package "exports" map, so plain Node resolves it through require.
const { ImageResponse } = createRequire(import.meta.url)('next/og')

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(appDir, 'src', 'lib', 'og-cards')

const WIDTH = 1200
const HEIGHT = 630
/** The centre square a compact preview keeps, and the margin kept clear inside it. */
const SAFE = 630
const MARGIN = 30
const LABEL_SIZE = 80

/** Brand green (the app's primary control colour). */
const BRAND = '#4a5d23'
const INK = '#292524'
const MUTED = '#57534e'

// Icon and colour per kind. The keys are the kinds of OG_CARD_KINDS in src/lib/og-card-kinds.ts.
// Two tests hold the output to it: src/lib/og-card-kinds.test.ts (every kind has a 1200 x 630 card,
// drawn with its current label) and src/app/api/og/og-routes.test.ts (the routes serve those bytes).
// business / organization use the map marker colours (src/lib/map-marker-colors.ts). Every colour is
// at least 4.5:1 against white (the icon); the label ink is 14:1 against the background.
const KINDS = {
  feed: { color: BRAND, icon: 'chat' },
  resource_post: { color: '#15803d', icon: 'pin' },
  petition: { color: '#6d28d9', icon: 'pen' },
  seeker_request: { color: '#c2410c', icon: 'help' },
  source_offer: { color: '#0e7490', icon: 'gift' },
  event_post: { color: '#1d4ed8', icon: 'calendar' },
  poll: { color: '#a16207', icon: 'bars' },
  resource: { color: '#15803d', icon: 'pin' },
  business: { color: '#134e4a', icon: 'shop' },
  organization: { color: '#6b2d5c', icon: 'building' },
}

const ICON_PATHS = {
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  pin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M15 10a3 3 0 1 1-6 0a3 3 0 0 1 6 0z'],
  pen: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
  help: ['M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  gift: [
    'M20 12v10H4V12',
    'M2 7h20v5H2z',
    'M12 22V7',
    'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z',
    'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  ],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4M8 2v4M3 10h18'],
  bars: ['M18 20V10M12 20V4M6 20v-6'],
  shop: ['M3 9l1.5-5h15L21 9', 'M4 9v11h16V9', 'M9 20v-6h6v6', 'M3 9h18'],
  building: ['M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17', 'M3 21h18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2'],
}

function icon(name, size, color) {
  return h(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24' },
    ICON_PATHS[name].map((d, i) =>
      h('path', { key: i, d, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })
    )
  )
}

function card(kind, logoDataUri) {
  const k = KINDS[kind]
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fafaf9 0%, #f7fee7 100%)',
      },
    },
    // The centre square: everything on the card is inside it.
    h(
      'div',
      {
        style: {
          width: `${SAFE}px`,
          height: `${HEIGHT}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `40px ${MARGIN}px 36px`,
        },
      },
      // Kind: icon, then the label — the largest text on the card.
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' } },
        h(
          'div',
          {
            style: {
              width: '104px',
              height: '104px',
              borderRadius: '52px',
              background: k.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          icon(k.icon, 58, '#ffffff')
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'center',
              textAlign: 'center',
              width: '100%',
              marginTop: '20px',
              fontSize: `${LABEL_SIZE}px`,
              lineHeight: 1.1,
              color: INK,
            },
          },
          OG_CARD_LABELS[kind]
        )
      ),
      // Brand: logo and wordmark, then the address.
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '24px' } },
          h('img', { src: logoDataUri, width: 112, height: 112 }),
          h('span', { style: { fontSize: '88px', letterSpacing: '4px', color: BRAND, lineHeight: 1 } }, 'FEED')
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px' } },
          h('div', { style: { display: 'flex', width: '48px', height: '8px', borderRadius: '4px', background: k.color } }),
          h('span', { style: { fontSize: '26px', color: MUTED } }, 'sourcetofeed.com'),
          h('div', { style: { display: 'flex', width: '48px', height: '8px', borderRadius: '4px', background: k.color } })
        )
      )
    )
  )
}

const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('data:') || url.startsWith('file:')) return realFetch(input, init)
  throw new Error(`generate-og-cards: the render tried to fetch ${new URL(url).origin}; cards must use local assets only`)
}

const logoSvg = await readFile(join(appDir, 'public', 'feed-logo.svg'))
const logoDataUri = `data:image/svg+xml;base64,${logoSvg.toString('base64')}`

const kinds = Object.keys(OG_CARD_LABELS)
const undrawn = kinds.filter((kind) => !KINDS[kind])
if (undrawn.length > 0 || kinds.length !== Object.keys(KINDS).length) {
  throw new Error(`generate-og-cards: every labelled kind needs an icon and colour, and no others (${undrawn.join(', ') || 'extra kinds in KINDS'})`)
}

await mkdir(outDir, { recursive: true })
// The manifest records the label each picture was drawn with and the picture's hash, so a test can
// tell when a label changed without the cards being regenerated.
const manifest = {}
for (const kind of kinds) {
  const response = new ImageResponse(card(kind, logoDataUri), { width: WIDTH, height: HEIGHT })
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(join(outDir, `${kind}.png`), bytes)
  manifest[kind] = { label: OG_CARD_LABELS[kind], sha256: createHash('sha256').update(bytes).digest('hex') }
  console.log(`${kind}.png ${bytes.length} bytes`)
}
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
