// apps/web/src/lib/member-url.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE place admin code gets a member-facing URL. Every admin "Back to feed" link and every
// per-item "View …" link is built here from a typed target, so a route change is one edit and an
// admin surface can never hand-build a path members do not have. URLs are relative (same origin).
//
// Adding a member surface: add a variant to MemberTarget; the exhaustive switch below then fails
// type-check until the new kind has a URL.

import { assertNever } from '@/components/feed/post-model'
import { buildFocusHash, type FocusTarget } from './deep-link'

export type MemberTarget =
  | { kind: 'feed_home' }
  | { kind: 'post'; id: string }
  | { kind: 'organization'; id: string }
  | { kind: 'business'; id: string }
  | { kind: 'resource'; id: string }
  /** One event, highlighted in the members' Events list (the `events` alias of the feed panel). */
  | { kind: 'event'; id: string }
  /** One item brought into view on the members' map. */
  | { kind: 'map_focus'; focus: FocusTarget }

/** A target that names one item (everything except the feed home). */
export type MemberItemTarget = Exclude<MemberTarget, { kind: 'feed_home' }>
export type MemberItemKind = MemberItemTarget['kind']

export function memberUrl(target: MemberTarget): string {
  switch (target.kind) {
    case 'feed_home':
      // The community feed panel of the single-page shell (feed-shell.tsx VALID_PANELS).
      return '/#feed'
    case 'post':
      return `/s/post/${encodeURIComponent(target.id)}`
    case 'organization':
      // Non-business organizations only; a business row has its own page (below).
      return `/s/organization/${encodeURIComponent(target.id)}`
    case 'business':
      return `/s/business/${encodeURIComponent(target.id)}`
    case 'resource':
      return `/s/resource/${encodeURIComponent(target.id)}`
    case 'event':
      // A hash deep link into the single-page shell (lib/deep-link.ts); the shell strips the focus
      // part once the Events list has it, so a reload does not focus again.
      return '/' + buildFocusHash('events', { kind: 'event', id: target.id })
    case 'map_focus':
      return '/' + buildFocusHash('map', target.focus)
    default:
      return assertNever(target)
  }
}
