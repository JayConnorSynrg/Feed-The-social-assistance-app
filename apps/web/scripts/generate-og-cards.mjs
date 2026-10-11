// apps/web/scripts/generate-og-cards.mjs
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Renders the ten share-preview cards served by /api/og/*/[id] and writes them to
// src/lib/og-cards/<kind>.png. Run from apps/web after changing the design:
//
//   node scripts/generate-og-cards.mjs
//
// Rule (docs/share-previews.md): a preview image carries no user text. Everything drawn here is a
// constant in this file or the logo in public/feed-logo.svg — a kind icon, a fixed English label,
// the FEED logo and wordmark. The routes serve the committed bytes; no renderer runs per request.
//
// The render is closed to the network: any fetch other than a data: or file: URL throws, so a design
// change that would need a remote font or emoji image fails here instead of at request time.

import { createElement as h } from 'react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// next/og is CommonJS with no package "exports" map, so plain Node resolves it through require.
const { ImageResponse } = createRequire(import.meta.url)('next/og')

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(appDir, 'src', 'lib', 'og-cards')

const WIDTH = 1200
const HEIGHT = 630

/** Brand green (the app's primary control colour). */
const BRAND = '#4a5d23'
const INK = '#292524'
const MUTED = '#57534e'

// Keep the keys in step with OG_CARD_KINDS in src/lib/og-card.ts (og-card.test.ts checks every kind
// has a file). business / organization use the map marker colours (src/lib/map-marker-colors.ts).
const KINDS = {
  feed: { label: 'Community post', color: BRAND, icon: 'chat' },
  resource_post: { label: 'Shared resource', color: '#15803d', icon: 'pin' },
  petition: { label: 'Petition', color: '#6d28d9', icon: 'pen' },
  seeker_request: { label: 'Request for help', color: '#c2410c', icon: 'help' },
  source_offer: { label: 'Offer of help', color: '#0e7490', icon: 'gift' },
  event_post: { label: 'Community event', color: '#1d4ed8', icon: 'calendar' },
  poll: { label: 'Poll', color: '#a16207', icon: 'bars' },
  resource: { label: 'Community resource', color: '#15803d', icon: 'pin' },
  business: { label: 'Local business', color: '#134e4a', icon: 'shop' },
  organization: { label: 'Local organization', color: '#6b2d5c', icon: 'building' },
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
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px',
        background: 'linear-gradient(135deg, #fafaf9 0%, #f7fee7 100%)',
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '24px' } },
      h(
        'div',
        {
          style: {
            width: '96px',
            height: '96px',
            borderRadius: '48px',
            background: k.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        icon(k.icon, 52, '#ffffff')
      ),
      h('span', { style: { fontSize: '48px', color: INK } }, k.label)
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', flex: 1 } },
      h('img', { src: logoDataUri, width: 230, height: 230 }),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h('span', { style: { fontSize: '132px', letterSpacing: '6px', color: BRAND, lineHeight: 1 } }, 'FEED'),
        h('span', { style: { fontSize: '30px', color: MUTED, marginTop: '8px' } }, 'Mutual Aid Resource Sharing')
      )
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      h('span', { style: { fontSize: '26px', color: MUTED } }, 'sourcetofeed.com'),
      h('div', { style: { display: 'flex', width: '160px', height: '10px', borderRadius: '5px', background: k.color } })
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

await mkdir(outDir, { recursive: true })
for (const kind of Object.keys(KINDS)) {
  const response = new ImageResponse(card(kind, logoDataUri), { width: WIDTH, height: HEIGHT })
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(join(outDir, `${kind}.png`), bytes)
  console.log(`${kind}.png ${bytes.length} bytes`)
}
