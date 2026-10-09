// post-actions.test.ts — which actions each viewer gets on a post card and on a comment.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { commentActions, postMenuItems, type ActionPost, type ActionViewer } from './post-actions'
import { POST_TYPE_VALUES } from './post-model'

const post = (o: Partial<ActionPost> = {}): ActionPost => ({
  id: 'p1',
  authorId: 'author',
  postType: 'feed',
  isHidden: false,
  hiddenReason: null,
  editedAt: null,
  ...o,
})
const viewer = (o: Partial<ActionViewer> = {}): ActionViewer => ({ id: 'member', isGuest: false, tier: null, ...o })
const ids = (v: ActionViewer, p: ActionPost) => postMenuItems(v, p).map((i) => i.id)

describe('postMenuItems', () => {
  it('a logged-out visitor or a guest gets a create-account prompt where members see Report', () => {
    expect(ids(viewer({ id: null }), post())).toEqual(['copy_link', 'signup_to_report'])
    expect(ids(viewer({ id: 'guest', isGuest: true }), post({ authorId: 'guest' }))).toEqual(['copy_link', 'signup_to_report'])
  })

  it('a member who is not the author can copy the link and report; history appears once the post was edited', () => {
    expect(ids(viewer(), post())).toEqual(['copy_link', 'report'])
    expect(ids(viewer(), post({ editedAt: new Date() }))).toEqual(['copy_link', 'history', 'report'])
  })

  it.each(POST_TYPE_VALUES.filter((t) => t !== 'petition'))('the author of a %s post can edit and delete it', (postType) => {
    expect(ids(viewer({ id: 'author' }), post({ postType }))).toEqual(['edit', 'copy_link', 'delete'])
  })

  it('a petition post is deleted, never edited, from the feed (its text is what people signed)', () => {
    expect(ids(viewer({ id: 'author' }), post({ postType: 'petition' }))).toEqual(['copy_link', 'delete'])
  })

  it('a post a moderator removed can no longer be edited by its author (it can still be deleted)', () => {
    expect(ids(viewer({ id: 'author' }), post({ isHidden: true, hiddenReason: 'admin_removal' }))).toEqual(['copy_link', 'delete'])
    // a held post stays editable (the edit is re-queued for review)
    expect(ids(viewer({ id: 'author' }), post({ isHidden: true, hiddenReason: 'hold_for_review' }))).toContain('edit')
  })

  it('moderators get Hold, Remove and Edit in admin — never Edit (nobody rewrites another person’s text)', () => {
    for (const tier of ['community_moderator', 'resource_admin', 'platform_admin'] as const) {
      const items = postMenuItems(viewer({ tier }), post())
      expect(items.map((i) => i.id)).toEqual(['copy_link', 'report', 'hold', 'remove', 'edit_in_admin'])
      expect(items.filter((i) => i.group === 'moderation').map((i) => i.id)).toEqual(['hold', 'remove', 'edit_in_admin'])
    }
  })

  it('a member without a tier gets no moderation items; a guest with a tier gets none either', () => {
    expect(ids(viewer({ tier: null }), post())).not.toContain('hold')
    expect(ids(viewer({ id: 'g', isGuest: true, tier: 'platform_admin' }), post())).toEqual(['copy_link', 'signup_to_report'])
  })

  it('on a hidden post a moderator can restore it; on a removed post Remove is gone', () => {
    expect(ids(viewer({ tier: 'community_moderator' }), post({ isHidden: true, hiddenReason: 'hold_for_review' }))).toEqual([
      'copy_link',
      'report',
      'remove',
      'restore',
      'edit_in_admin',
    ])
    expect(ids(viewer({ tier: 'community_moderator' }), post({ isHidden: true, hiddenReason: 'admin_removal' }))).toEqual([
      'copy_link',
      'report',
      'restore',
      'edit_in_admin',
    ])
  })

  it('a staff author keeps the author items and gets no Hold / Remove on their own post', () => {
    expect(ids(viewer({ id: 'author', tier: 'platform_admin' }), post())).toEqual(['edit', 'copy_link', 'delete', 'edit_in_admin'])
  })

  it('each item carries a stable test id', () => {
    expect(postMenuItems(viewer(), post()).map((i) => i.testId)).toEqual(['post-menu-copy_link-p1', 'post-menu-report-p1'])
  })
})

describe('commentActions', () => {
  const c = { authorId: 'author', editedAt: null, deletedAt: null }
  it('the author edits and deletes their own comment', () => {
    expect(commentActions(viewer({ id: 'author' }), c)).toEqual(['edit', 'delete'])
  })
  it('anyone can view the history of an edited comment', () => {
    expect(commentActions(viewer(), { ...c, editedAt: '2026-10-09T00:00:00Z' })).toEqual(['history'])
    expect(commentActions(viewer({ id: null }), { ...c, editedAt: '2026-10-09T00:00:00Z' })).toEqual(['history'])
  })
  it('moderators hide other people’s comments; never edit them', () => {
    expect(commentActions(viewer({ tier: 'community_moderator' }), c)).toEqual(['hide'])
  })
  it('a deleted comment offers nothing', () => {
    expect(commentActions(viewer({ id: 'author' }), { ...c, deletedAt: '2026-10-09T00:00:00Z' })).toEqual([])
  })
  it('a hidden comment: staff get Unhide only; a member — its author included — gets nothing', () => {
    const hidden = { ...c, isHidden: true }
    expect(commentActions(viewer({ tier: 'community_moderator' }), hidden)).toEqual(['unhide'])
    expect(commentActions(viewer(), hidden)).toEqual([])
    expect(commentActions(viewer({ id: 'author' }), hidden)).toEqual([])
  })
  it('a guest gets nothing on someone else’s comment', () => {
    expect(commentActions(viewer({ id: 'g', isGuest: true }), c)).toEqual([])
  })
})
