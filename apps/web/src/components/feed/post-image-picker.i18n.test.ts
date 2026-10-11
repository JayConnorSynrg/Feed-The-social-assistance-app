// apps/web/src/components/feed/post-image-picker.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads the photo picker (composer, post wizard, edit dialog) in
// that language. The REAL field, rendered to static markup:
//   - label, button, preview alt, uploading line and the remove button's name in the member's
//     language; nothing in it is marked English any more, and no caller wraps it in an English mark;
//   - the remove button sits at the inline end (the left in a right-to-left form);
//   - a failure the uploader, the client check or the edge function wrote reads in the member's
//     language; anything else is shown as received and marked English; either way it is an alert;
//   - every sentence those three sources can report is known here, in both directions.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h, createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))

import { messages, type Locale } from '@/lib/i18n'
import { editT } from '@/lib/i18n-feed-edit'
import { PHOTO_ERROR_SENTENCES, feedPhotoMessages, photoErrorText, photoT } from '@/lib/i18n-feed-photo'
import { PostImagePickerField } from './post-image-picker'

const LOCALES = Object.keys(messages) as Locale[]
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function field(locale: Locale, over: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    h(PostImagePickerField, { previewUrl: null, imageUploading: false, imageError: null, fileInputRef: createRef<HTMLInputElement>(), onFileSelect: () => {}, onClear: () => {}, locale, ...over }),
  )
}

describe('the photo picker in the member language', () => {
  it('vi: the label and the button', () => {
    const out = field('vi')
    expect(out).toContain('<label class="mb-2 block text-sm font-medium text-stone-700">Ảnh (không bắt buộc)</label>')
    expect(out).toMatch(/<button type="button" data-testid="post-image-trigger"[^>]*>.*?<\/svg>Thêm ảnh<\/button>/)
    expect(out).not.toMatch(/Photo \(optional\)|Add a photo/)
  })

  it('the compact one (the inline composer) has no label', () => {
    const out = field('es', { compact: true })
    expect(out).not.toContain('<label')
    expect(out).toContain('Añadir una foto</button>')
  })

  it('ar: a chosen photo — translated alt and remove name, the remove button at the inline end', () => {
    const out = field('ar', { previewUrl: 'blob:x' })
    expect(out).toContain('alt="معاينة الصورة المحددة"')
    expect(out).toMatch(/<button type="button" aria-label="إزالة الصورة" data-testid="post-image-remove" class="absolute top-1\.5 end-1\.5 /)
    expect(out).not.toMatch(/\bright-1\.5\b|\bml-2\b/)
  })

  it('while uploading: the line in the member language, margin on the reading side, no remove button', () => {
    const out = field('ht', { previewUrl: 'blob:x', imageUploading: true })
    expect(out).toContain('<span class="ms-2 text-xs">N ap telechaje…</span>')
    expect(out).not.toContain('post-image-remove')
  })

  it.each(LOCALES)('%s: nothing in the field is marked English, and no state shows English copy', (locale) => {
    const states = [field(locale), field(locale, { previewUrl: 'blob:x' }), field(locale, { previewUrl: 'blob:x', imageUploading: true }), field(locale, { imageError: 'Upload failed. Please try again.' })]
    for (const out of states) {
      expect(out).not.toMatch(/\blang=|\bdir=/)
      if (locale !== 'en') expect(out).not.toMatch(/Photo \(optional\)|Add a photo|Remove photo|Selected photo preview|Uploading…|Upload failed/)
    }
  })
})

describe('accessible names', () => {
  it.each(LOCALES)('%s: the add button is named by its visible text; the icon-only remove button has a name', (locale) => {
    const add = field(locale).match(/<button[^>]*data-testid="post-image-trigger"[^>]*>/)?.[0] ?? ''
    expect(add).not.toBe('')
    expect(add).not.toContain('aria-label')
    expect(field(locale)).toContain(`${photoT(locale, 'add')}</button>`)
    const remove = field(locale, { previewUrl: 'blob:x' }).match(/<button[^>]*data-testid="post-image-remove"[^>]*>/)?.[0] ?? ''
    expect(remove).toContain(`aria-label="${editT(locale, 'removePhoto')}"`)
    if (locale !== 'en') expect(remove).not.toContain('Remove photo')
  })

  it('icons are hidden from assistive tech', () => {
    expect(field('en')).toMatch(/<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>Add a photo/)
    expect(field('en', { previewUrl: 'blob:x' })).toMatch(/data-testid="post-image-remove"[^>]*><svg[^>]*aria-hidden="true"/)
  })
})

describe('failures', () => {
  it('a sentence the uploader wrote reads in the member language, as an alert with no English mark', () => {
    const out = field('fr', { imageError: 'Could not process that image. Please try another.' })
    expect(out).toContain('<p role="alert" class="mt-1 text-xs text-red-700" data-testid="post-image-error">Impossible de traiter cette image. Veuillez en essayer une autre.</p>')
  })

  it('anything else is shown as received and marked English', () => {
    const out = field('fr', { imageError: 'You cannot manage photos for this organization.' })
    expect(out).toContain('<p role="alert" lang="en" dir="ltr" class="mt-1 text-xs text-red-700" data-testid="post-image-error">You cannot manage photos for this organization.</p>')
  })

  it('"too large" from the client check or the edge function names the limit, with the locale\'s digits', () => {
    expect(photoErrorText('File size exceeds 10MB limit', 'en')).toEqual({ text: 'Image exceeds the 10MB limit.', translated: true })
    expect(photoErrorText('Image exceeds the 5MB limit.', 'en')).toEqual({ text: 'Image exceeds the 5MB limit.', translated: true })
    expect(photoErrorText('Image exceeds the 5MB limit.', 'es')).toEqual({ text: 'La imagen supera el límite de 5 MB.', translated: true })
    expect(photoErrorText('File size exceeds 10MB limit', 'ko').text).toBe('이미지가 10MB 한도를 초과합니다.')
    expect(photoErrorText('File size exceeds 10MB limit', 'ar').text).toBe(feedPhotoMessages.ar.errTooLarge.replace('{mb}', new Intl.NumberFormat(['ar', 'en-US']).format(10)))
  })

  it('a type or an extension the client check refuses reads as "not a supported image"', () => {
    for (const sentence of ['File type image/gif is not allowed', 'File type  is not allowed', 'File extension .heic is not allowed']) {
      expect(photoErrorText(sentence, 'pt'), sentence).toEqual({ text: 'Esse arquivo não é uma imagem compatível.', translated: true })
    }
    // Not that sentence: left alone.
    expect(photoErrorText('File type image/gif is not allowed here', 'pt').translated).toBe(false)
    expect(photoErrorText('toString', 'pt')).toEqual({ text: 'toString', translated: false })
  })

  it.each(LOCALES)('%s: every known sentence has a text; English members read the uploader\'s own words', (locale) => {
    for (const sentence of Object.keys(PHOTO_ERROR_SENTENCES)) {
      const got = photoErrorText(sentence, locale)
      expect(got.translated, sentence).toBe(true)
      expect(got.text.trim(), sentence).not.toBe('')
      if (locale !== 'en') expect(got.text, sentence).not.toBe(sentence)
    }
    expect(photoErrorText('That file is not a supported image.', 'en').text).toBe('That file is not a supported image.')
    expect(photoErrorText('Upload failed. Please try again.', 'en').text).toBe('Upload failed. Please try again.')
    expect(photoErrorText('Create a free account to attach a photo.', 'en').text).toBe('Create a free account to attach a photo.')
  })
})

describe('every sentence the three sources can report is known', () => {
  /** A sentence: a quoted literal that starts with a capital and has a space in it. */
  const sentences = (source: string) => [...code(source).matchAll(/'([A-Z][^'\n]* [^'\n]*)'|"([A-Z][^"\n]* [^"\n]*)"/g)].map((m) => m[1] ?? m[2])

  it('lib/post-image-upload.ts and the picker hook: each sentence reads translated', () => {
    const found = [...sentences(read('../../lib/post-image-upload.ts')), ...sentences(read('./post-image-picker.tsx'))]
    expect([...new Set(found)].sort()).toEqual(['Could not process that image. Please try another.', 'Could not upload that image.', 'That file is not a supported image.', 'Upload failed. Please try again.'])
    for (const sentence of found) expect(photoErrorText(sentence, 'es').translated, sentence).toBe(true)
  })

  it('lib/security.ts (the client check): its three sentences are read by pattern', () => {
    const src = code(read('../../lib/security.ts'))
    const block = src.slice(src.indexOf('export function validateFileUpload'))
    const templates = [...block.slice(0, block.indexOf('\n}\n')).matchAll(/error: `([^`]+)`/g)].map((m) => m[1])
    expect(templates).toEqual(['File size exceeds ${maxSizeMB}MB limit', 'File type ${file.type} is not allowed', 'File extension .${extension} is not allowed'])
    for (const template of templates) {
      const sentence = template.replace('${maxSizeMB}', '10').replace('${file.type}', 'image/gif').replace('${extension}', 'gif')
      expect(photoErrorText(sentence, 'es').translated, sentence).toBe(true)
    }
  })

  it('the edge function: each error text is translated, or listed here as left English (and so marked)', () => {
    const edge = ['index.ts', 'target.ts'].map((f) => code(read(`../../../../../supabase/functions/post-image-upload/${f}`))).join('\n')
    const errors = [...new Set([...edge.matchAll(/error: '([^']+)'/g)].map((m) => m[1]))].sort()
    // Not something a member can act on in the picker (a broken request, an org-photo rule).
    const LEFT_ENGLISH = ['Empty upload.', 'Internal server error', 'Invalid org_id.', 'Method not allowed', 'Missing Authorization header', 'Unauthorized', 'You cannot manage photos for this organization.']
    const translated = errors.filter((e) => photoErrorText(e, 'es').translated)
    expect(translated).toEqual(['Create a free account to attach a photo.', 'Image exceeds the 5MB limit.', 'That file is not a supported image.', 'Upload failed.'])
    expect(errors.filter((e) => !translated.includes(e))).toEqual(LEFT_ENGLISH)
  })
})

describe('source: the picker and its three callers', () => {
  it('no English copy is left in the field', () => {
    const src = code(read('./post-image-picker.tsx'))
    const fieldSrc = src.slice(src.indexOf('export function PostImagePickerField'))
    for (const literal of ['Photo (optional)', 'Selected photo preview', 'Uploading…', 'Remove photo', 'Add a photo', '{imageError}']) expect(fieldSrc, literal).not.toContain(literal)
  })

  it('each caller passes the viewer language and wraps the field in no English mark', () => {
    for (const rel of ['../panels/feed-panel.tsx', '../panels/post-type-wizard.tsx', './post-edit-dialog.tsx']) {
      const src = read(rel)
      const uses = [...src.matchAll(/<PostImagePickerField\b[\s\S]*?\/>/g)].map((m) => m[0])
      expect(uses, rel).toHaveLength(1)
      expect(uses[0], rel).toMatch(/\blocale=\{locale\}/)
      expect(src, rel).not.toContain('data-english-only="photo-picker"')
      expect(src, rel).not.toMatch(/lang="en"[^>]*>\s*<PostImagePickerField/)
    }
  })
})
