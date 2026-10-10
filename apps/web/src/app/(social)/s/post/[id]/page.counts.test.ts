// page.counts.test.ts — the /s/post share page shows the comment count members see in the feed:
// posts.comment_count (not deleted by their author, not hidden by a moderator), never a count of
// post_comments rows (which still holds soft-deleted comments). Renders the real server page with
// a fake server client whose post_comments table holds 3 rows (one soft-deleted) and whose post
// row says comment_count = 2.
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const rows = { post_comments: 3, post_likes: 9 }
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://example.test' }))
vi.mock('@/components/feed/post-admin-edit-link', () => ({ PostAdminEditLink: () => null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      q.select = (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          const head: Record<string, unknown> = { eq: () => Promise.resolve({ count: rows[table as keyof typeof rows] ?? 0, error: null }) }
          return head
        }
        return q
      }
      q.eq = () => q
      q.single = async () => ({
        data: { id: 'p1', content: 'Pantry open Sat', image_url: null, like_count: 4, comment_count: 2, user: { id: 'u', first_name: 'Ada', username: null, avatar_url: null, admin_tier: null } },
        error: null,
      })
      return q
    },
    rpc: async () => ({ data: [], error: null }),
  }),
}))

import SharedPostPage from './page'

describe('/s/post counts', () => {
  it('shows posts.comment_count and posts.like_count — a soft-deleted comment row is not counted', async () => {
    const html = renderToStaticMarkup(await SharedPostPage({ params: Promise.resolve({ id: 'p1' }) }))
    expect(html).toContain('</svg>2 comments')
    expect(html).toContain('</svg>4 likes')
    expect(html).not.toContain('</svg>3 comments')
  })
})
