'use client'

import * as React from 'react'

/**
 * FEED peer-appreciation pixel icons.
 * 16x16 hand-authored pixel art rendered as <rect> runs — no images, no base64.
 * Palette: Stardew-Warm (single register below); every fill comes from PALETTE.
 */

const PALETTE = {
  trunkDark: '#6b4423',
  trunk: '#8a5a2b',
  trunkLight: '#a06a35',
  outline: '#25401f',
  greenDark: '#3a6b35',
  green: '#4f8a3f',
  greenMid: '#6fae55',
  greenLight: '#8fc46b',
  red: '#d6453f',
  cream: '#f4e4c1',
  amber: '#e8a020',
  yellow: '#f2c14e',
  orange: '#d98324',
  // Bowl + steam register for the soup icon (distinct from cream so the bowl never vanishes
  // on the cream/stone card backgrounds; steam is a soft sage-gray that reads as vapor and
  // stays visible on cream).
  bowl: '#c8683a',
  steam: '#9fb0ad',
  // A second accent for celebration confetti (cheer).
  blue: '#5a6b8c',
} as const

const P = PALETTE

export const APPRECIATION_ICON_SLUGS = [
  'heart', 'smile', 'cheer', 'flower', 'sunflower', 'leaf',
  'bread', 'apple', 'soup', 'sun', 'seedling', 'tree',
] as const

export type AppreciationSlug = (typeof APPRECIATION_ICON_SLUGS)[number]

type Rect = { x: number; y: number; w: number; h: number; fill: string }

const ICON_RECTS: Record<AppreciationSlug, readonly Rect[]> = {
  heart: [
    { x: 4, y: 3, w: 3, h: 1, fill: P.red },
    { x: 9, y: 3, w: 3, h: 1, fill: P.red },
    { x: 3, y: 4, w: 10, h: 1, fill: P.red },
    { x: 2, y: 5, w: 12, h: 1, fill: P.red },
    { x: 2, y: 6, w: 12, h: 1, fill: P.red },
    { x: 3, y: 7, w: 10, h: 1, fill: P.red },
    { x: 4, y: 8, w: 8, h: 1, fill: P.red },
    { x: 5, y: 9, w: 6, h: 1, fill: P.red },
    { x: 6, y: 10, w: 4, h: 1, fill: P.red },
    { x: 7, y: 11, w: 2, h: 1, fill: P.red },
    { x: 4, y: 5, w: 2, h: 1, fill: P.cream },
  ],
  smile: [
    { x: 5, y: 1, w: 6, h: 1, fill: P.yellow },
    { x: 3, y: 2, w: 10, h: 1, fill: P.yellow },
    { x: 2, y: 3, w: 12, h: 1, fill: P.yellow },
    { x: 2, y: 4, w: 12, h: 1, fill: P.yellow },
    { x: 1, y: 5, w: 14, h: 1, fill: P.yellow },
    { x: 1, y: 6, w: 14, h: 1, fill: P.yellow },
    { x: 1, y: 7, w: 14, h: 1, fill: P.yellow },
    { x: 1, y: 8, w: 14, h: 1, fill: P.yellow },
    { x: 1, y: 9, w: 14, h: 1, fill: P.yellow },
    { x: 2, y: 10, w: 12, h: 1, fill: P.yellow },
    { x: 2, y: 11, w: 12, h: 1, fill: P.yellow },
    { x: 3, y: 12, w: 10, h: 1, fill: P.yellow },
    { x: 5, y: 13, w: 6, h: 1, fill: P.yellow },
    { x: 5, y: 5, w: 2, h: 2, fill: P.outline },
    { x: 9, y: 5, w: 2, h: 2, fill: P.outline },
    { x: 5, y: 9, w: 1, h: 1, fill: P.outline },
    { x: 10, y: 9, w: 1, h: 1, fill: P.outline },
    { x: 6, y: 10, w: 4, h: 1, fill: P.outline },
  ],
  // Party popper: a cone at bottom-left bursting confetti up-right, with motion streaks.
  // Reads as celebration (not two blobs) at 32px.
  cheer: [
    // Cone (amber body, dark tip + opening rim), pointing from bottom-left toward center.
    { x: 2, y: 13, w: 1, h: 1, fill: P.trunkDark }, // tip
    { x: 2, y: 12, w: 2, h: 1, fill: P.amber },
    { x: 3, y: 11, w: 2, h: 1, fill: P.amber },
    { x: 4, y: 10, w: 2, h: 1, fill: P.amber },
    { x: 5, y: 9, w: 2, h: 1, fill: P.amber },
    { x: 3, y: 13, w: 3, h: 1, fill: P.trunkDark }, // cone edge (lower)
    { x: 6, y: 10, w: 1, h: 3, fill: P.trunkDark }, // cone edge (upper/opening side)
    { x: 6, y: 8, w: 2, h: 1, fill: P.orange },     // opening rim
    // Motion streaks radiating from the cone opening.
    { x: 6, y: 6, w: 1, h: 1, fill: P.trunkLight },
    { x: 8, y: 9, w: 1, h: 1, fill: P.trunkLight },
    // Confetti burst (multi-color) scattered top-right.
    { x: 8, y: 4, w: 2, h: 2, fill: P.red },
    { x: 11, y: 2, w: 2, h: 2, fill: P.yellow },
    { x: 13, y: 5, w: 1, h: 2, fill: P.green },
    { x: 10, y: 6, w: 2, h: 2, fill: P.blue },
    { x: 12, y: 8, w: 2, h: 1, fill: P.greenMid },
    { x: 9, y: 1, w: 1, h: 1, fill: P.greenMid },
    { x: 14, y: 3, w: 1, h: 1, fill: P.red },
  ],
  flower: [
    { x: 6, y: 1, w: 3, h: 3, fill: P.red },
    { x: 6, y: 7, w: 3, h: 3, fill: P.red },
    { x: 3, y: 4, w: 3, h: 3, fill: P.red },
    { x: 9, y: 4, w: 3, h: 3, fill: P.red },
    { x: 6, y: 4, w: 3, h: 3, fill: P.yellow },
    { x: 7, y: 10, w: 1, h: 4, fill: P.green },
    { x: 8, y: 11, w: 2, h: 1, fill: P.green },
  ],
  sunflower: [
    { x: 6, y: 1, w: 4, h: 1, fill: P.yellow },
    { x: 4, y: 2, w: 8, h: 1, fill: P.yellow },
    { x: 3, y: 3, w: 10, h: 1, fill: P.yellow },
    { x: 2, y: 4, w: 12, h: 1, fill: P.yellow },
    { x: 2, y: 5, w: 12, h: 1, fill: P.yellow },
    { x: 2, y: 6, w: 12, h: 1, fill: P.yellow },
    { x: 2, y: 7, w: 12, h: 1, fill: P.yellow },
    { x: 3, y: 8, w: 10, h: 1, fill: P.yellow },
    { x: 4, y: 9, w: 8, h: 1, fill: P.yellow },
    { x: 6, y: 10, w: 4, h: 1, fill: P.yellow },
    // Seeded center disc: a two-brown checker (seeds), NOT a face. Base fill then alternating
    // trunkDark seeds so it never reads as eyes/mouth (was confusable with Smile).
    { x: 5, y: 4, w: 6, h: 4, fill: P.trunk },
    { x: 5, y: 4, w: 1, h: 1, fill: P.trunkDark },
    { x: 7, y: 4, w: 1, h: 1, fill: P.trunkDark },
    { x: 9, y: 4, w: 1, h: 1, fill: P.trunkDark },
    { x: 6, y: 5, w: 1, h: 1, fill: P.trunkDark },
    { x: 8, y: 5, w: 1, h: 1, fill: P.trunkDark },
    { x: 10, y: 5, w: 1, h: 1, fill: P.trunkDark },
    { x: 5, y: 6, w: 1, h: 1, fill: P.trunkDark },
    { x: 7, y: 6, w: 1, h: 1, fill: P.trunkDark },
    { x: 9, y: 6, w: 1, h: 1, fill: P.trunkDark },
    { x: 6, y: 7, w: 1, h: 1, fill: P.trunkDark },
    { x: 8, y: 7, w: 1, h: 1, fill: P.trunkDark },
    { x: 10, y: 7, w: 1, h: 1, fill: P.trunkDark },
    { x: 7, y: 11, w: 1, h: 3, fill: P.green },
    { x: 8, y: 12, w: 2, h: 1, fill: P.green },
  ],
  leaf: [
    { x: 7, y: 1, w: 2, h: 1, fill: P.green },
    { x: 6, y: 2, w: 4, h: 1, fill: P.green },
    { x: 5, y: 3, w: 6, h: 1, fill: P.green },
    { x: 4, y: 4, w: 8, h: 1, fill: P.green },
    { x: 4, y: 5, w: 8, h: 1, fill: P.green },
    { x: 3, y: 6, w: 10, h: 1, fill: P.green },
    { x: 3, y: 7, w: 10, h: 1, fill: P.green },
    { x: 4, y: 8, w: 8, h: 1, fill: P.green },
    { x: 4, y: 9, w: 8, h: 1, fill: P.green },
    { x: 5, y: 10, w: 6, h: 1, fill: P.green },
    { x: 6, y: 11, w: 4, h: 1, fill: P.green },
    { x: 7, y: 12, w: 2, h: 1, fill: P.green },
    { x: 7, y: 3, w: 1, h: 9, fill: P.greenDark },
    { x: 5, y: 5, w: 1, h: 3, fill: P.greenLight },
    { x: 7, y: 13, w: 1, h: 2, fill: P.trunkDark },
  ],
  bread: [
    { x: 5, y: 4, w: 6, h: 1, fill: P.trunkLight },
    { x: 3, y: 5, w: 10, h: 1, fill: P.trunkLight },
    { x: 2, y: 6, w: 12, h: 1, fill: P.trunkLight },
    { x: 2, y: 7, w: 12, h: 1, fill: P.trunkLight },
    { x: 2, y: 8, w: 12, h: 1, fill: P.trunkLight },
    { x: 2, y: 9, w: 12, h: 1, fill: P.trunkLight },
    { x: 2, y: 10, w: 12, h: 1, fill: P.trunkLight },
    { x: 3, y: 11, w: 10, h: 1, fill: P.trunkLight },
    { x: 4, y: 5, w: 8, h: 1, fill: P.amber },
    { x: 5, y: 7, w: 1, h: 2, fill: P.cream },
    { x: 8, y: 7, w: 1, h: 2, fill: P.cream },
    { x: 11, y: 7, w: 1, h: 2, fill: P.cream },
  ],
  apple: [
    { x: 8, y: 1, w: 1, h: 3, fill: P.trunkDark },
    { x: 9, y: 2, w: 2, h: 2, fill: P.green },
    { x: 5, y: 4, w: 2, h: 1, fill: P.red },
    { x: 9, y: 4, w: 2, h: 1, fill: P.red },
    { x: 4, y: 5, w: 8, h: 1, fill: P.red },
    { x: 3, y: 6, w: 10, h: 1, fill: P.red },
    { x: 3, y: 7, w: 10, h: 1, fill: P.red },
    { x: 3, y: 8, w: 10, h: 1, fill: P.red },
    { x: 3, y: 9, w: 10, h: 1, fill: P.red },
    { x: 3, y: 10, w: 10, h: 1, fill: P.red },
    { x: 4, y: 11, w: 8, h: 1, fill: P.red },
    { x: 4, y: 12, w: 8, h: 1, fill: P.red },
    { x: 5, y: 13, w: 6, h: 1, fill: P.red },
    { x: 5, y: 6, w: 2, h: 2, fill: P.cream },
  ],
  // Bowl of soup: dark-outlined bowl (never vanishes on cream), amber broth surface, orange
  // ceramic body, sage-gray steam wisps rising above (visible on cream).
  soup: [
    // Steam wisps (sage-gray, wavy).
    { x: 5, y: 2, w: 1, h: 2, fill: P.steam },
    { x: 6, y: 4, w: 1, h: 2, fill: P.steam },
    { x: 8, y: 1, w: 1, h: 2, fill: P.steam },
    { x: 9, y: 3, w: 1, h: 2, fill: P.steam },
    { x: 8, y: 5, w: 1, h: 1, fill: P.steam },
    { x: 11, y: 2, w: 1, h: 2, fill: P.steam },
    // Bowl: dark rim, walls, and bottom (outline); amber broth; orange body.
    { x: 2, y: 8, w: 12, h: 1, fill: P.trunkDark }, // top rim
    { x: 2, y: 9, w: 1, h: 2, fill: P.trunkDark },  // left wall
    { x: 13, y: 9, w: 1, h: 2, fill: P.trunkDark }, // right wall
    { x: 3, y: 9, w: 10, h: 1, fill: P.amber },     // broth surface
    { x: 3, y: 10, w: 10, h: 1, fill: P.bowl },     // body
    { x: 3, y: 11, w: 1, h: 1, fill: P.trunkDark }, // narrowing walls
    { x: 12, y: 11, w: 1, h: 1, fill: P.trunkDark },
    { x: 4, y: 11, w: 8, h: 1, fill: P.bowl },
    { x: 4, y: 12, w: 8, h: 1, fill: P.trunkDark }, // bottom
  ],
  sun: [
    { x: 6, y: 5, w: 4, h: 1, fill: P.yellow },
    { x: 5, y: 6, w: 6, h: 1, fill: P.yellow },
    { x: 5, y: 7, w: 6, h: 1, fill: P.yellow },
    { x: 5, y: 8, w: 6, h: 1, fill: P.yellow },
    { x: 5, y: 9, w: 6, h: 1, fill: P.yellow },
    { x: 6, y: 10, w: 4, h: 1, fill: P.yellow },
    { x: 7, y: 1, w: 2, h: 3, fill: P.amber },
    { x: 7, y: 12, w: 2, h: 3, fill: P.amber },
    { x: 1, y: 7, w: 3, h: 2, fill: P.amber },
    { x: 12, y: 7, w: 3, h: 2, fill: P.amber },
    { x: 3, y: 3, w: 2, h: 2, fill: P.amber },
    { x: 11, y: 3, w: 2, h: 2, fill: P.amber },
    { x: 3, y: 11, w: 2, h: 2, fill: P.amber },
    { x: 11, y: 11, w: 2, h: 2, fill: P.amber },
  ],
  seedling: [
    { x: 2, y: 13, w: 12, h: 2, fill: P.trunkDark },
    { x: 7, y: 7, w: 1, h: 6, fill: P.green },
    { x: 3, y: 6, w: 4, h: 2, fill: P.greenMid },
    { x: 2, y: 7, w: 1, h: 1, fill: P.greenMid },
    { x: 9, y: 6, w: 4, h: 2, fill: P.greenMid },
    { x: 13, y: 7, w: 1, h: 1, fill: P.greenMid },
    { x: 4, y: 6, w: 1, h: 1, fill: P.greenLight },
    { x: 10, y: 6, w: 1, h: 1, fill: P.greenLight },
  ],
  tree: [
    { x: 6, y: 1, w: 4, h: 1, fill: P.green },
    { x: 4, y: 2, w: 8, h: 1, fill: P.green },
    { x: 3, y: 3, w: 10, h: 1, fill: P.green },
    { x: 2, y: 4, w: 12, h: 1, fill: P.green },
    { x: 2, y: 5, w: 12, h: 1, fill: P.green },
    { x: 2, y: 6, w: 12, h: 1, fill: P.green },
    { x: 3, y: 7, w: 10, h: 1, fill: P.green },
    { x: 4, y: 8, w: 8, h: 1, fill: P.green },
    { x: 4, y: 3, w: 2, h: 1, fill: P.greenLight },
    { x: 8, y: 4, w: 2, h: 1, fill: P.greenLight },
    { x: 5, y: 2, w: 2, h: 1, fill: P.greenMid },
    { x: 9, y: 6, w: 2, h: 1, fill: P.greenMid },
    { x: 4, y: 7, w: 8, h: 1, fill: P.greenDark },
    { x: 7, y: 9, w: 2, h: 4, fill: P.trunkDark },
    { x: 6, y: 13, w: 4, h: 1, fill: P.trunkDark },
  ],
}

function humanize(slug: string): string {
  if (!slug) return 'Appreciation'
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

function isAppreciationSlug(slug: string): slug is AppreciationSlug {
  return (APPRECIATION_ICON_SLUGS as readonly string[]).includes(slug)
}

export function PixelItemIcon(props: {
  slug: string
  size?: number
  className?: string
  title?: string
}): React.ReactElement {
  const { slug, size = 24, className, title } = props
  const label = title ?? humanize(slug)
  const known = isAppreciationSlug(slug)

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
    >
      <title>{label}</title>
      {known ? (
        ICON_RECTS[slug].map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
        ))
      ) : (
        // Unknown slug -> neutral rounded-square placeholder (never crashes).
        <rect x={2} y={2} width={12} height={12} rx={3} ry={3} fill={P.trunkLight} />
      )}
    </svg>
  )
}
