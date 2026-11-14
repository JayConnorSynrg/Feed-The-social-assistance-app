// apps/web/src/components/feed/sign-up-side-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// How the feed keeps sign-up side data — the viewer's own statuses, the author's rows, the
// "N opted in" counts — for every card on screen while several reads are on their way at once.
//
// The data is kept per post. A read asks about some posts and writes only their entries:
//   - a page that is added to the list ("load more") MERGES: the cards of earlier pages keep theirs;
//   - the first page, or a refresh, REPLACES: entries of posts that are no longer asked about go;
//   - the read that follows an action asks about the acted post alone.
// Two reads may ask about the same post (a page load and the read after an action). The rule is
// LATEST STARTED WINS, PER POST: a response writes a post's entry only when no read that asked
// about that post was started after it. The last response to arrive does not win by arriving last.

/** What a read may do with one post's entry when its response arrives. */
export type ReadClaim =
  /** No later read asked about this post: write the entry. */
  | 'owns'
  /** A later read asked about this post: write nothing; that read's response will. */
  | 'overtaken'
  /** The list was replaced after this read started and the new list does not ask about this
   *  post: write nothing; the post is not on screen any more. */
  | 'unlisted'

export interface ReadOrder {
  /** A read starts: returns its stamp. `replace`: this read's posts are the whole list now. */
  start(postIds: readonly string[], replace?: boolean): number
  /** What the read with this stamp may do with this post's entry. */
  claim(stamp: number, postId: string): ReadClaim
}

export function createReadOrder(): ReadOrder {
  let clock = 0
  let replacedAt = 0
  const latest = new Map<string, number>()
  return {
    start(postIds, replace = false) {
      const stamp = ++clock
      for (const id of postIds) latest.set(id, stamp)
      if (replace) replacedAt = stamp
      return stamp
    },
    claim(stamp, postId) {
      const started = latest.get(postId) ?? 0
      if (started > stamp) return 'overtaken'
      return stamp < replacedAt ? 'unlisted' : 'owns'
    },
  }
}

/**
 * Write a read's answer into a per-post record. For each asked post the read owns: its entry is
 * set from `fresh`, or removed when `fresh` has none. Posts that were not asked about keep their
 * entries — unless `replace`, which keeps only the asked posts (an asked post the read does not
 * own keeps the entry it has: a later read is writing it).
 */
export function mergeByPost<T>(prev: Readonly<Record<string, T>>, postIds: readonly string[], fresh: Readonly<Record<string, T>>, owns: (postId: string) => boolean, replace: boolean): Record<string, T> {
  const next: Record<string, T> = {}
  if (replace) {
    for (const id of postIds) if (!owns(id) && id in prev) next[id] = prev[id]
  } else {
    Object.assign(next, prev)
  }
  for (const id of postIds) {
    if (!owns(id)) continue
    if (id in fresh) next[id] = fresh[id]
    else delete next[id]
  }
  return next
}

/** mergeByPost for a Map (the viewer's own statuses). */
export function mergeMapByPost<T>(prev: ReadonlyMap<string, T>, postIds: readonly string[], fresh: ReadonlyMap<string, T>, owns: (postId: string) => boolean, replace: boolean): Map<string, T> {
  const next = new Map<string, T>()
  if (replace) {
    for (const id of postIds) if (!owns(id) && prev.has(id)) next.set(id, prev.get(id) as T)
  } else {
    for (const [id, value] of prev) next.set(id, value)
  }
  for (const id of postIds) {
    if (!owns(id)) continue
    if (fresh.has(id)) next.set(id, fresh.get(id) as T)
    else next.delete(id)
  }
  return next
}

/** A post's entry removed (its card left the list). The same object when there was none. */
export function withoutPost<T>(prev: Readonly<Record<string, T>>, postId: string): Record<string, T> {
  if (!(postId in prev)) return prev as Record<string, T>
  const next = { ...prev }
  delete next[postId]
  return next
}
