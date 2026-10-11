// apps/web/src/app/api/og/og-routes.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The four share-preview image routes (/api/og/{post,resource,business,organization}/[id]).
// Rule (docs/share-previews.md): a preview image carries no user text, and making it sends nothing
// outside FEED. Proven on the real GET handlers:
//   - global fetch, TCP connect and DNS lookup are replaced by recorders that refuse; every request
//     must leave all three logs empty;
//   - the same kind answers with the same bytes whatever the post text, author name or place name
//     is, in nine scripts and edge cases — so none of it can be in the picture;
//   - the one persisted log row names the kind and the outcome, never the id or any text.
// The database read is FEED's own Supabase; it is replaced here by a row built from each input, so a
// route that drew the title, body or name would have them to draw.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import net from 'node:net'
import dns from 'node:dns'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { POST_TYPE_VALUES } from '@/components/feed/post-model'
import { OG_CARD_KINDS, OG_CARD_CACHE_CONTROL, type OgCardKind } from '@/lib/og-card'

const ID = '11111111-1111-4111-8111-111111111111'

const { db, logRows } = vi.hoisted(() => ({
  db: { row: null as Record<string, unknown> | null, selects: [] as string[] },
  logRows: [] as Array<{ table: string; row: Record<string, unknown> }>,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      q.select = (columns: string) => {
        db.selects.push(columns)
        return q
      }
      q.eq = () => q
      q.in = () => q
      q.single = async () =>
        db.row ? { data: db.row, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      return q
    },
  }),
}))

// The logger's server sink (service-role insert into FEED's own app_logs). Reached only when the two
// env vars are set, which the logging tests below do; the egress tests leave them unset.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        logRows.push({ table, row })
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

import { GET as postGET } from './post/[id]/route'
import { GET as resourceGET } from './resource/[id]/route'
import { GET as businessGET } from './business/[id]/route'
import { GET as organizationGET } from './organization/[id]/route'

// ---------------------------------------------------------------------------
// Egress recorders: fetch, TCP connect, DNS lookup
// ---------------------------------------------------------------------------

/** Every attempt to reach a network host: fetch of a non-local URL, TCP connect, DNS lookup. */
const attempts: string[] = []
/** fetch() of a file: or data: URL — not egress, but a sign that a renderer is loading its assets. */
const localFetches: string[] = []
const real = { fetch: globalThis.fetch, connect: net.Socket.prototype.connect, lookup: dns.lookup }

beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    // Local URLs are answered (a file inside the app, an inline data: image) so that a renderer, if one
    // ever runs again, gets far enough to show what it would then ask the network for.
    if (url.startsWith('file:')) {
      localFetches.push(url.slice(0, 120))
      return new Response(new Uint8Array(await readFile(fileURLToPath(url))))
    }
    if (url.startsWith('data:')) {
      localFetches.push(url.slice(0, 40))
      return real.fetch(input, init)
    }
    attempts.push(`fetch ${url.slice(0, 120)}`)
    throw new TypeError('fetch refused by og-routes.test')
  }) as typeof fetch
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const o = (typeof args[0] === 'object' && args[0] !== null ? args[0] : { port: args[0], host: args[1] }) as {
      host?: string
      port?: number
      path?: string
    }
    attempts.push(`socket ${o.host ?? o.path ?? 'localhost'}:${o.port ?? ''}`)
    queueMicrotask(() => this.destroy(new Error('socket refused by og-routes.test')))
    return this
  } as typeof net.Socket.prototype.connect
  dns.lookup = ((hostname: string, ...rest: unknown[]) => {
    attempts.push(`dns ${hostname}`)
    const cb = rest[rest.length - 1]
    if (typeof cb === 'function') (cb as (e: Error) => void)(new Error('dns refused by og-routes.test'))
  }) as unknown as typeof dns.lookup
})

afterAll(() => {
  globalThis.fetch = real.fetch
  net.Socket.prototype.connect = real.connect
  dns.lookup = real.lookup
})

beforeEach(() => {
  attempts.length = 0
  localFetches.length = 0
  logRows.length = 0
  db.row = null
  db.selects.length = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

// ---------------------------------------------------------------------------
// Inputs: synthetic text written for this test (no member data)
// ---------------------------------------------------------------------------

const EN = 'Free hot meals this Saturday at the community center, 11am to 2pm. Everyone is welcome.'
const INPUTS: Array<{ label: string; text: string; name: string }> = [
  { label: 'English', text: EN, name: 'Maria' },
  { label: 'Arabic', text: 'وجبات ساخنة مجانية هذا السبت في المركز المجتمعي من الساعة 11 صباحاً حتى 2 ظهراً.', name: 'Maria' },
  { label: 'Amharic', text: 'በዚህ ቅዳሜ በማህበረሰብ ማዕከል ነፃ ትኩስ ምግብ ከጠዋቱ 5 ሰዓት እስከ 8 ሰዓት።', name: 'Maria' },
  { label: 'Chinese', text: '本周六上午11点至下午2点，社区中心提供免费热餐。欢迎所有人。', name: 'Maria' },
  { label: 'Korean', text: '이번 주 토요일 오전 11시부터 오후 2시까지 주민센터에서 무료 식사를 제공합니다.', name: 'Maria' },
  { label: 'emoji', text: 'Free hot meals this Saturday 🍲🥖 Bring a friend 🙌 ❤️ 👨‍👩‍👧', name: 'Maria' },
  { label: 'Arabic author name', text: EN, name: 'فاطمة الزهراء' },
  { label: 'lone surrogate', text: 'Half an emoji \uD83D at the end \uDE4C', name: '\uD83D' },
  { label: '5,000-character body', text: 'Soup kitchen schedule. '.repeat(218).slice(0, 5000), name: 'Maria' },
]

type Handler = (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

/** One row holding the input in every text column a route could read, shaped for that route's table. */
const SURFACES: Array<{
  surface: string
  handler: Handler
  kinds: readonly OgCardKind[]
  notFound: string
  row: (kind: OgCardKind, input: { text: string; name: string }) => Record<string, unknown>
}> = [
  {
    surface: 'post',
    handler: postGET,
    kinds: POST_TYPE_VALUES,
    notFound: 'Post not found',
    row: (kind, i) => ({
      id: ID,
      post_type: kind,
      content: i.text,
      lang: 'en',
      is_hidden: false,
      user: { id: 'u1', first_name: i.name, username: i.name, avatar_url: null },
    }),
  },
  {
    surface: 'resource',
    handler: resourceGET,
    kinds: ['resource'],
    notFound: 'Resource not found',
    row: (_kind, i) => ({ id: ID, status: 'approved', category: 'food', name: i.name, description: i.text, city: i.name, state: 'VT' }),
  },
  {
    surface: 'business',
    handler: businessGET,
    kinds: ['business'],
    notFound: 'Business not found',
    row: (_kind, i) => ({ id: ID, org_type: 'business', status: 'approved', is_active: true, name: i.name, description: i.text, city: i.name, state: 'VT' }),
  },
  {
    surface: 'organization',
    handler: organizationGET,
    kinds: ['organization'],
    notFound: 'Organization not found',
    row: (_kind, i) => ({ id: ID, org_type: 'food_bank', is_active: true, name: i.name, description: i.text, city: i.name, state: 'VT' }),
  },
]

const call = (handler: Handler) =>
  handler(new Request(`https://sourcetofeed.com/api/og/x/${ID}`), { params: Promise.resolve({ id: ID }) })

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'PNG signature').toBe(true)
  expect(bytes.subarray(12, 16).toString('latin1')).toBe('IHDR')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

const ALL_KINDS = SURFACES.flatMap((s) => s.kinds.map((kind) => ({ ...s, kind })))

// ---------------------------------------------------------------------------

describe('share-preview images: no outbound request', () => {
  it('control: the recorders see a fetch, a TCP connect and a DNS lookup', async () => {
    await expect(fetch('https://fonts.googleapis.com/css2?family=Noto+Sans')).rejects.toThrow('fetch refused')
    new net.Socket().on('error', () => {}).connect(443, '203.0.113.7')
    dns.lookup('fonts.gstatic.com', () => {})
    expect(attempts).toEqual([
      'fetch https://fonts.googleapis.com/css2?family=Noto+Sans',
      'socket 203.0.113.7:443',
      'dns fonts.gstatic.com',
    ])
  })

  it('the ten kinds are the seven post types plus resource, business and organization', () => {
    expect(ALL_KINDS.map((k) => k.kind).sort()).toEqual([...OG_CARD_KINDS].sort())
    expect(OG_CARD_KINDS).toHaveLength(10)
  })

  describe.each(ALL_KINDS)('$surface route, kind $kind', ({ handler, kind, row }) => {
    it.each(INPUTS)('$label: 200 PNG 1200×630 and zero fetch / socket / DNS attempts', async (input) => {
      db.row = row(kind, input)
      const res = await call(handler)
      const bytes = Buffer.from(await res.arrayBuffer())
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 })
      expect(attempts).toEqual([])
      expect(localFetches).toEqual([])
    })
  })
})

describe('share-preview images: no user text in the picture', () => {
  it.each(ALL_KINDS)('$surface route, kind $kind: the image bytes are identical for all nine inputs', async ({ handler, kind, row }) => {
    const images: Buffer[] = []
    for (const input of INPUTS) {
      db.row = row(kind, input)
      const res = await call(handler)
      expect(res.status).toBe(200)
      images.push(Buffer.from(await res.arrayBuffer()))
    }
    expect(images).toHaveLength(INPUTS.length)
    const different = INPUTS.filter((_, i) => !images[i].equals(images[0])).map((i) => i.label)
    expect(different).toEqual([])
  })

  it('control: the kind does select the picture — ten kinds, ten different images', async () => {
    const seen = new Set<string>()
    for (const { handler, kind, row } of ALL_KINDS) {
      db.row = row(kind, INPUTS[0])
      seen.add(Buffer.from(await (await call(handler)).arrayBuffer()).toString('base64'))
    }
    expect(seen.size).toBe(10)
  })

  it('a post type this build does not know gets the community-post card', async () => {
    db.row = SURFACES[0].row('feed', INPUTS[0])
    const feed = Buffer.from(await (await call(postGET)).arrayBuffer())
    db.row = { ...SURFACES[0].row('feed', INPUTS[0]), post_type: 'a_future_type' }
    const res = await call(postGET)
    expect(res.status).toBe(200)
    expect(Buffer.from(await res.arrayBuffer()).equals(feed)).toBe(true)
  })

  it('the post route asks the database for the id and the type only — no text, no author', async () => {
    db.row = SURFACES[0].row('poll', INPUTS[1])
    await call(postGET)
    expect(db.selects).toEqual(['id, post_type'])
  })

  it('the resource route asks the database for the id only', async () => {
    db.row = SURFACES[1].row('resource', INPUTS[1])
    await call(resourceGET)
    expect(db.selects).toEqual(['id'])
  })
})

describe('share-preview images: status codes and caching', () => {
  it.each(SURFACES)('$surface route: a hidden, deleted or unknown item is 404 "$notFound", not cached, nothing sent out', async ({ handler, notFound }) => {
    db.row = null
    const res = await call(handler)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe(notFound)
    expect(res.headers.get('cache-control')).toBeNull()
    expect(attempts).toEqual([])
  })

  it.each(SURFACES)('$surface route: a found item is cached for a year, publicly, as immutable', async ({ handler, kinds, row }) => {
    db.row = row(kinds[0], INPUTS[0])
    const res = await call(handler)
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, s-maxage=31536000, immutable')
    expect(res.headers.get('cache-control')).toBe(OG_CARD_CACHE_CONTROL)
    expect(res.headers.get('content-length')).toBe(String((await res.arrayBuffer()).byteLength))
  })
})

describe('share-preview images: the persisted log row', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://feed-test.supabase.invalid'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key'
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  const ogRows = () => logRows.filter((r) => r.table === 'app_logs' && String(r.row.event).startsWith('og.image'))
  async function settled(): Promise<void> {
    await vi.waitFor(() => expect(ogRows().length).toBeGreaterThanOrEqual(1))
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  }

  it('a served card writes exactly one og.image.complete row: surface, kind, outcome ok, a duration', async () => {
    db.row = SURFACES[0].row('poll', INPUTS[1])
    expect((await call(postGET)).status).toBe(200)
    await settled()
    expect(ogRows()).toHaveLength(1)
    const { row } = ogRows()[0]
    expect(row).toMatchObject({ level: 'info', event: 'og.image.complete', context: { surface: 'post', kind: 'poll', outcome: 'ok' } })
    expect(Object.keys(row.context as object).sort()).toEqual(['kind', 'outcome', 'surface'])
    expect(typeof row.duration_ms).toBe('number')
    const stored = JSON.stringify(row)
    expect(stored).not.toContain(ID)
    expect(stored).not.toContain(INPUTS[1].text.slice(0, 12))
    expect(attempts).toEqual([])
  })

  it('a 404 writes exactly one row with outcome not_found and no kind', async () => {
    db.row = null
    expect((await call(resourceGET)).status).toBe(404)
    await settled()
    expect(ogRows()).toHaveLength(1)
    expect(ogRows()[0].row).toMatchObject({ event: 'og.image.complete', context: { surface: 'resource', kind: null, outcome: 'not_found' } })
    expect(JSON.stringify(ogRows()[0].row)).not.toContain(ID)
  })
})
