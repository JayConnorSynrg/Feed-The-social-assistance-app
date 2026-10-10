// apps/web/src/components/feed/feed-post-card.lang.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Language marks on the post card: the still-English author badges are marked English; a member's own
// words (petition title and summary, a seeker's name) inside an English-marked block do not inherit
// "English" (lang="") and take their direction from the text (dir="auto").

import { describe, it, expect, vi } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('motion/react', () => ({ useReducedMotion: () => false, m: new Proxy({}, { get: () => 'div' }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', async (orig) => ({ ...(await orig<object>()), useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null, isAuthenticated: true }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: (_o: string, _a: unknown, fn: () => unknown) => fn() }))

import { mount, findAll } from '@/test/mini-react'
import { FeedPostCard, type FeedPostCardProps } from './feed-post-card'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HarmonyBadge } from './harmony-badge'
import { AuthorBadgeStrip } from '@/components/appreciation/author-badge-strip'
import { rowToPost, type FeedPostRow } from './post-model'

type El = { type: unknown; props: Record<string, unknown> }
const noop = () => {}
const row: FeedPostRow = {
  id: 'p1', content: 'Sign our petition', created_at: '2026-10-01T12:00:00.000Z', is_pinned: false, is_hidden: false, image_url: null,
  max_seekers: 3, slots_remaining: 2, post_type: 'petition', petition_id: 'pt1', resource_id: null, metadata: null, like_count: 0, comment_count: 0,
  version: 1, edited_at: null, edit_count: 0, image_alt: null, hidden_reason: null,
  user: { id: 'me', first_name: 'Ada', avatar_url: null, is_staff: false, admin_tier: null, harmony_score: 4.5, harmony_reviews_count: 3, badge_summary: null },
  resource: null,
}

function render() {
  const props: FeedPostCardProps = {
    post: rowToPost(row, { isLiked: false }),
    locale: 'ar',
    formatAge: () => 'x',
    viewer: { id: 'me', isGuest: false, tier: null },
    currentUserId: 'me',
    optInStatus: undefined,
    onLike: noop, onComment: noop, onShare: noop, onEmbed: noop, onOptIn: noop, onWithdraw: noop, onAction: noop,
    optInCount: 1,
    authorOptIns: [{ id: 'o1', postId: 'p1', seekerId: 's1', seekerName: 'مريم', seekerHarmonyScore: null, seekerHarmonyCount: 0, status: 'pending' }],
    petitionEmbed: { title: 'أنقذوا الحديقة', summary: 'ملخص', signatureCount: 1, targetSignatures: 10, hasSigned: false, isSigning: false },
  }
  const c = mount(() => FeedPostCard(props))
  ;(findAll(c.tree(), (e) => e.props['data-testid'] === 'opt-in-manage-p1')[0].props.onClick as () => void)()
  return c.rerender()
}

describe('language marks on the card', () => {
  it('each author badge marks its own root English (no display:contents wrapper)', () => {
    const tree = render()
    expect(findAll(tree, (e) => e.props['data-testid'] === 'author-badges-en')).toHaveLength(0)
    expect(findAll(tree, (e) => e.type === HarmonyBadge && e.props.userId === 'me')).toHaveLength(1)
    expect(findAll(tree, (e) => e.type === AuthorBadgeStrip)).toHaveLength(1)
    const harmony = renderToStaticMarkup(createElement(HarmonyBadge, { score: 4.5, count: 3, userId: 'u' }))
    const strip = renderToStaticMarkup(createElement(AuthorBadgeStrip, { summary: { families: { food: { level: 2 } } }, userId: 'u' }))
    expect(harmony).toMatch(/^<span lang="en" dir="ltr"/)
    expect(strip).toMatch(/^<span lang="en" dir="ltr"/)
  })

  it.each(['petition-title', 'petition-summary', 'seeker-name'])("a member's text (%s) has lang=\"\" and dir=\"auto\"", (kind) => {
    const el = findAll(render(), (e) => e.props['data-member-text'] === kind)[0] as El
    expect(el.props).toMatchObject({ lang: '', dir: 'auto' })
  })
})
