// apps/web/src/components/feed/post-actions.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure rules for the actions a viewer gets on a post card (the card's ⋯ menu) and on a comment.
// Visibility only — every action is enforced by its RPC (edit_post / delete_own_post are author-only,
// the admin_* moderation RPCs community-moderator-and-up, admin_set_comment_hidden the same). The tier
// comes from the shared admin-tier lookup (hooks/use-admin-viewer.ts), never from profile columns.
//
//   Logged out / guest        Copy link · View edit history (if edited) · Create an account to report
//   Member                    Copy link · View edit history · Report
//   Author                    Edit · View edit history · Copy link | Delete
//   Moderator and up          Copy link · View edit history · Report | Hold · Remove · Restore · Edit in admin
//   Author who is staff       the author items, then the moderation items except Hold / Remove on their own post
//
// Nobody edits someone else's text: Edit is the author's alone, whatever their tier.

import { tierAtLeast, type AdminTier } from '@/lib/admin-tier'
import type { PostType } from '@/lib/post-rpc'
import { isEditableType } from './post-edit-model'

export interface ActionViewer {
  /** null when logged out. */
  id: string | null
  /** An anonymous (guest) session. */
  isGuest: boolean
  /** The viewer's admin tier once the shared lookup settled; null = none / not loaded. */
  tier: AdminTier | null
}

export interface ActionPost {
  id: string
  authorId: string
  postType: PostType
  isHidden: boolean
  hiddenReason: string | null
  editedAt: Date | null
}

export type PostMenuItemId =
  | 'edit'
  | 'history'
  | 'copy_link'
  | 'report'
  | 'signup_to_report'
  | 'delete'
  | 'hold'
  | 'remove'
  | 'restore'
  | 'edit_in_admin'

export type PostMenuGroup = 'main' | 'destructive' | 'moderation'

export interface PostMenuItem {
  id: PostMenuItemId
  /** Items render in group order with a separator between groups. */
  group: PostMenuGroup
  /** data-testid of the item: post-menu-<id>-<postId> (the trigger is post-menu-<postId>). */
  testId: string
}

export const postMenuTriggerTestId = (postId: string) => `post-menu-${postId}`

function isStaff(viewer: ActionViewer): boolean {
  return viewer.id != null && !viewer.isGuest && tierAtLeast(viewer.tier, 'community_moderator')
}

export function postMenuItems(viewer: ActionViewer, post: ActionPost): PostMenuItem[] {
  const item = (id: PostMenuItemId, group: PostMenuGroup = 'main'): PostMenuItem => ({ id, group, testId: `post-menu-${id}-${post.id}` })
  const signedIn = viewer.id != null && !viewer.isGuest
  const isAuthor = signedIn && viewer.id === post.authorId
  const removed = post.hiddenReason === 'admin_removal'
  const deleted = post.hiddenReason === 'author_deleted'
  const out: PostMenuItem[] = []

  if (isAuthor) {
    if (isEditableType(post.postType) && !removed && !deleted) out.push(item('edit'))
    if (post.editedAt) out.push(item('history'))
    out.push(item('copy_link'))
    if (!deleted) out.push(item('delete', 'destructive'))
  } else {
    out.push(item('copy_link'))
    if (post.editedAt) out.push(item('history'))
    out.push(signedIn ? item('report') : item('signup_to_report'))
  }

  if (isStaff(viewer)) {
    if (!isAuthor && !post.isHidden) out.push(item('hold', 'moderation'))
    if (!isAuthor && !removed) out.push(item('remove', 'moderation'))
    if (post.isHidden && !deleted) out.push(item('restore', 'moderation'))
    out.push(item('edit_in_admin', 'moderation'))
  }
  return out
}

/** The actions on one comment (shown inline under it). */
export type CommentActionId = 'edit' | 'delete' | 'history' | 'hide' | 'unhide'

export interface ActionComment {
  authorId: string
  editedAt: string | null
  deletedAt: string | null
  /** Hidden by a moderator (only staff are shown such a comment in the thread). */
  isHidden?: boolean
}

export function commentActions(viewer: ActionViewer, comment: ActionComment): CommentActionId[] {
  const signedIn = viewer.id != null && !viewer.isGuest
  const isAuthor = signedIn && viewer.id === comment.authorId
  if (comment.deletedAt) return []
  // A hidden comment reaches the thread for staff only; they can make it visible again.
  if (comment.isHidden) return isStaff(viewer) ? ['unhide'] : []
  const out: CommentActionId[] = []
  if (isAuthor) out.push('edit')
  if (comment.editedAt) out.push('history')
  if (isAuthor) out.push('delete')
  if (!isAuthor && isStaff(viewer)) out.push('hide')
  return out
}
