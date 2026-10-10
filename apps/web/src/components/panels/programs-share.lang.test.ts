// apps/web/src/components/panels/programs-share.lang.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Share to Feed" on a program: a refused share shows the reason in the member's language, and the
// message is marked with that language (the dialog around it is still English) and its direction.

import { describe, it, expect, vi } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: (_o: string, _a: unknown, fn: () => unknown) => fn() }))
vi.mock('@/hooks/use-auth', async (orig) => ({ ...(await orig<object>()), useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'ar' }))
vi.mock('@/lib/post-rpc', async (orig) => ({ ...(await orig<object>()), createPost: async () => ({ ok: false, failure: { kind: 'network' } }) }))

import { mount, findAll } from '@/test/mini-react'
import { ShareToFeedDialog } from './programs-panel'
import { failureText } from '@/lib/i18n-feed-edit'

describe('Share to Feed', () => {
  it("a refused share: the message is in the member's language, marked with it, direction from the text", async () => {
    const c = mount(() => ShareToFeedDialog({ resource: { id: 'r1', name: 'Pantry', description: null } as never, onClose: () => {}, onShared: () => {} }))
    ;(findAll(c.tree(), (e) => e.props['data-testid'] === 'share-to-feed-submit')[0].props.onClick as () => Promise<void>)()
    const tree = await c.flush()
    const alert = findAll(tree, (e) => e.props.role === 'alert')[0]
    expect(alert.props).toMatchObject({ lang: 'ar', dir: 'auto', children: failureText('ar', { kind: 'network' }) })
  })
})
