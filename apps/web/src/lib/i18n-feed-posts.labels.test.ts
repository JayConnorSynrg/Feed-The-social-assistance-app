// apps/web/src/lib/i18n-feed-posts.labels.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Accessible names in every language: the "Edited" button's name starts with the word on screen
// (WCAG 2.5.3, label in name — a voice user says what they see); two ⋯ buttons for posts by the same
// author have different names; an image-only post's "Edit in admin" name is translated.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { cardT } from './i18n-feed-card'
import { commentsT } from './i18n-feed-comments'
import { postMenuTriggerLabel } from '@/components/feed/post-card-actions'
import { postAdminItemName } from '@/components/feed/post-admin-edit-link'

const LOCALES = Object.keys(messages) as Locale[]

describe('label in name', () => {
  it('has the 14 locales', () => expect(LOCALES).toHaveLength(14))

  it.each(LOCALES)('%s: the Edited button name starts with the visible word (card and comment)', (l) => {
    expect(cardT(l, 'editedAria').startsWith(cardT(l, 'edited'))).toBe(true)
    expect(commentsT(l, 'editedAria').startsWith(commentsT(l, 'edited'))).toBe(true)
  })
})

describe('⋯ button names', () => {
  const now = Date.parse('2026-10-09T12:00:00Z')
  const a = { author: 'Ada', content: 'Free bread at the church hall, Saturday 9am until it runs out', createdAt: new Date('2026-10-09T10:00:00Z') }
  const b = { author: 'Ada', content: 'Need a ride to the clinic on Tuesday', createdAt: new Date('2026-10-09T10:00:00Z') }
  const c = { author: 'Ada', content: '', createdAt: new Date('2026-10-08T10:00:00Z') }

  it.each(LOCALES)('%s: posts by the same author get different names (time and start of the text)', (l) => {
    const names = [a, b, c].map((p) => postMenuTriggerLabel(l, p, now))
    expect(new Set(names).size).toBe(3)
    for (const n of names) expect(n).toContain('Ada')
    expect(names.join('')).not.toMatch(/\{\w+\}/)
  })

  it('the excerpt is at most 40 characters', () => {
    const name = postMenuTriggerLabel('en', a, now)
    expect(name).toBe('Actions for the post by Ada, 2 hours ago: Free bread at the church hall, Saturday…')
    expect(name.split(': ')[1].length).toBeLessThanOrEqual(40)
  })

  it('a post with no text ends at the time (no empty excerpt)', () => {
    expect(postMenuTriggerLabel('en', c, now)).toBe('Actions for the post by Ada, 1 day ago')
  })
})

describe('"Edit in admin" name for an image-only post', () => {
  it.each(LOCALES)('%s: translated, with the author and the date', (l) => {
    const name = postAdminItemName(null, 'Ada', '2026-10-01T12:00:00Z', l)
    expect(name).toContain('Ada')
    expect(name).toMatch(/2026/)
    if (l !== 'en') expect(name.startsWith('post by')).toBe(false)
  })

  it('English stays as before; no author reads "a member" in the language', () => {
    expect(postAdminItemName(null, 'Ada', '2026-10-01T12:00:00Z')).toBe('post by Ada, Oct 1, 2026')
    expect(postAdminItemName(null)).toBe('post by a member')
    expect(postAdminItemName(null, null, null, 'es')).toBe('publicación de un miembro')
  })
})
