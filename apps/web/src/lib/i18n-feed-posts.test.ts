// i18n-feed-posts.test.ts — parity for the feed post surfaces' dictionaries (one per surface):
// card (i18n-feed-card), composer + wizard + shared fields (i18n-feed-composer), comments
// (i18n-feed-comments), edit / history / conflict / delete (i18n-feed-edit), resource category chip
// (i18n-resource-categories). Each: exactly the 14 locales, the English key set, non-empty values,
// the English {placeholders}, and translated (a locale is not a copy of English).
import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { cardMessages, cardT, menuItemLabel, reportReasonLabel, roleLabel, REPORT_REASONS } from './i18n-feed-card'
import { composerMessages, requestCategoryLabel, REQUEST_CATEGORIES } from './i18n-feed-composer'
import { commentsMessages, commentErrorText } from './i18n-feed-comments'
import { editMessages, failureText, fieldErrorText } from './i18n-feed-edit'
import { resourceCategoryMessages, resourceCategoryLabel } from './i18n-resource-categories'
import { CATEGORY_META } from './resource-categories'

const LOCALES = Object.keys(messages) as Locale[]
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

const DICTS: Array<[string, Record<Locale, object>]> = [
  ['card', cardMessages],
  ['composer', composerMessages],
  ['comments', commentsMessages],
  ['edit', editMessages],
  ['resource categories', resourceCategoryMessages],
]

// Values that are the same word in a language (brand names, loanwords, "Spam") may equal English.
const SAME_AS_EN_OK = new Set(['Spam', 'Admin', 'Legal', 'General', 'Moderator', 'Event', 'Like', 'Resource', '{n} mi', 'Post', 'Original', 'Version {n}', 'Immigration', 'Education', 'Option {n}', 'Options', 'Photo', 'Description', 'Question', 'Transport', 'Comments'])

describe.each(DICTS)('%s dictionary', (_name, dict) => {
  const en = dict.en as Record<string, string>
  const keys = Object.keys(en).sort()

  it('covers exactly the 14 locales of lib/i18n.ts', () => {
    expect(Object.keys(dict).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })

  it.each(LOCALES)('%s: the English key set, every value non-empty, the English {placeholders}', (locale) => {
    const d = dict[locale] as Record<string, string>
    expect(Object.keys(d).sort()).toEqual(keys)
    for (const k of keys) {
      expect(typeof d[k], `${locale}.${k}`).toBe('string')
      expect(d[k].trim(), `${locale}.${k}`).not.toBe('')
      expect(placeholders(d[k]), `${locale}.${k}`).toEqual(placeholders(en[k]))
    }
  })

  it.each(LOCALES.filter((l) => l !== 'en'))('%s is translated (at most a few values equal English)', (locale) => {
    const d = dict[locale] as Record<string, string>
    const copies = keys.filter((k) => d[k] === en[k] && !SAME_AS_EN_OK.has(en[k]))
    expect(copies.length, `${locale}: ${copies.join(', ')}`).toBeLessThanOrEqual(Math.max(2, Math.floor(keys.length * 0.05)))
  })
})

describe('lookups', () => {
  it('Spanish card chrome, roles, report reasons and menu items', () => {
    expect(cardT('es', 'edited')).toBe('Editado')
    expect(roleLabel('community_moderator', 'es')).toBe('Moderador')
    expect(roleLabel(null, 'es')).toBe('Miembro de la comunidad')
    expect(REPORT_REASONS.map((r) => reportReasonLabel(r, 'en'))).toEqual([
      'Spam',
      'Abusive content',
      'Harassment',
      'Misinformation',
      'Illegal content',
      'Off topic',
      'Other',
    ])
    expect(menuItemLabel('delete', 'ko')).toBe('삭제')
  })

  it('category labels translate while the stored value stays English; unknown values pass through', () => {
    expect(REQUEST_CATEGORIES.map((c) => requestCategoryLabel(c, 'es'))).toContain('Vivienda')
    expect(requestCategoryLabel('Bikes', 'es')).toBe('Bikes')
    expect(Object.keys(resourceCategoryMessages.en).sort()).toEqual(Object.keys(CATEGORY_META).sort())
    expect(resourceCategoryLabel('employment', 'en')).toBe('Jobs')
    expect(resourceCategoryLabel('mental_health', 'fr')).toBe('Santé mentale')
    expect(resourceCategoryLabel('not_a_category', 'fr')).toBe(resourceCategoryLabel('not_a_category', 'en'))
  })

  it('every typed failure and field error has its own message', () => {
    expect(failureText('en', { kind: 'conflict', currentVersion: 4, editedAt: null, needsReview: false })).toMatch(/changed somewhere else/)
    expect(failureText('en', { kind: 'capacity', committed: 3 })).toBe('3 people already opted in, so the limit can’t go below 3.')
    expect(failureText('en', { kind: 'not_found', token: 'comment_deleted' })).toBe('This comment was deleted.')
    expect(failureText('en', { kind: 'forbidden', token: 'closed' })).toBe("This post isn't open for changes right now.")
    expect(failureText('en', { kind: 'invalid', field: 'resource_id' })).toMatch(/resource can't be linked/)
    expect(failureText('es', { kind: 'network' })).toMatch(/conexión/)
    expect(fieldErrorText('en', { code: 'capacity_range', min: 3, max: 1000 })).toBe('Enter a whole number from 3 to 1000.')
    expect(commentErrorText('es', 'closed')).toBe('Los comentarios están cerrados en esta publicación.')
  })
})
