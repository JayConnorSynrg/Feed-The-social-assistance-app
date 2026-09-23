// apps/web/src/lib/follow-gate.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure gating decision for the "Follow" affordance on a post author — shared by the feed
// PostCard header and the author profile sheet so both surfaces stay in lockstep.
//
// A guest (anonymous auth session) cannot insert a follows row: production carries a
// RESTRICTIVE policy `follows_block_anon_insert` that blocks it. A guest tap must therefore
// surface the account-creation prompt, never a follow insert that reverts silently. This
// function is the single source of that decision and is unit-tested in isolation.

export type FollowGate =
  | 'hidden' // no follow affordance (signed out, viewing self, or handlers not wired)
  | 'guest-prompt' // show Follow, but a tap surfaces CreateAccountPrompt (no insert attempted)
  | 'active' // show Follow, a tap performs the real follow / unfollow

export function resolveFollowGate(params: {
  /** the viewer's user id, or null when signed out */
  currentUserId: string | null
  /** the author being followed */
  authorId: string
  /** the viewer is an anonymous / guest session */
  isGuest: boolean
  /** both follow AND unfollow handlers are wired */
  hasHandlers: boolean
}): FollowGate {
  const { currentUserId, authorId, isGuest, hasHandlers } = params
  if (currentUserId == null || !hasHandlers) return 'hidden'
  if (currentUserId === authorId) return 'hidden' // self — checked before the guest branch
  if (isGuest) return 'guest-prompt'
  return 'active'
}
