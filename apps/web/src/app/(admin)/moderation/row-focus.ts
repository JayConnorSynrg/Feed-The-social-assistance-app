// apps/web/src/app/(admin)/moderation/row-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Where keyboard focus goes when an action takes a row out of an admin list (approve, reject,
// remove a member): chosen BEFORE the row leaves, applied once the list has re-rendered, so focus
// never falls to <body>. The next row when there is one, else the previous row, else the list's
// heading (null). Each list passes its rows' ids in display order. Also: the one way a W4 status
// line announces a result (announce / AnnouncementText).

import { createElement, type Dispatch, type ReactElement, type SetStateAction } from 'react'

/** The id of the row to focus after `removedId` leaves `ids`; null means the list's heading. */
export function focusAfterRowRemoval(ids: readonly string[], removedId: string): string | null {
  const at = ids.indexOf(removedId)
  if (at === -1) return null
  return ids[at + 1] ?? ids[at - 1] ?? null
}

/** Run `fn` after the browser has laid out the changed list (a timer where there is no frame loop). */
export function afterLayout(fn: () => void): void {
  const nextFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f: () => void) => setTimeout(f, 0)
  nextFrame(fn)
}

/** A live region's content: the words, and a sequence number that changes with EVERY announcement. */
export interface Announcement {
  text: string
  seq: number
}
export const NO_ANNOUNCEMENT: Announcement = { text: '', seq: 0 }

/**
 * Announce `text` in an always-mounted live region. Each call takes a new sequence number, and the
 * region renders its words in a node keyed by it (AnnouncementText), so every announcement — an
 * identical repeat included — inserts exactly one new DOM node, with no reliance on timing.
 */
export function announce(set: Dispatch<SetStateAction<Announcement>>, text: string): void {
  set((prev) => ({ text, seq: prev.seq + 1 }))
}

/** Empty the region (nothing is inserted, so nothing is announced). */
export function clearAnnouncement(set: Dispatch<SetStateAction<Announcement>>): void {
  set((prev) => (prev.text ? { text: '', seq: prev.seq } : prev))
}

/** The region's child: one node per announcement (React replaces it when the key changes). */
export function AnnouncementText({ announcement }: { announcement: Announcement }): ReactElement | null {
  return announcement.text ? createElement('span', { key: announcement.seq }, announcement.text) : null
}
