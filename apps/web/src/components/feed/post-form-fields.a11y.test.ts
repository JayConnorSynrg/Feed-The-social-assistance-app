// apps/web/src/components/feed/post-form-fields.a11y.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The shared post form's markup: required fields say so (the text, each poll option); the
// "online event" switch is visible when off (stone-500 track, 3:1 against the card) and its thumb
// moves the reading direction's way in a right-to-left language.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PostFormFields } from './post-form-fields'
import { EMPTY_DRAFT } from './post-edit-model'
import type { PostType } from '@/lib/post-rpc'

const html = (postType: PostType, draft = EMPTY_DRAFT) =>
  renderToStaticMarkup(createElement(PostFormFields, { postType, draft, onChange: () => {}, mode: 'create', locale: 'en', idPrefix: 't' }))

const tagWithId = (markup: string, id: string) => new RegExp(`<[^>]*id="${id}"[^>]*>`).exec(markup)?.[0] ?? ''

describe('PostFormFields markup', () => {
  it('the text field and every poll option are required', () => {
    const m = html('poll')
    expect(tagWithId(m, 't-content')).toMatch(/required=""/)
    expect(tagWithId(m, 't-content')).toMatch(/aria-required="true"/)
    expect(tagWithId(m, 't-options-0')).toMatch(/aria-required="true"/)
    expect(tagWithId(m, 't-options-1')).toMatch(/aria-required="true"/)
    expect(tagWithId(html('feed'), 't-content')).toMatch(/aria-required="true"/)
  })

  it('a note on a shared resource is optional (it reads as the resource name)', () => {
    expect(tagWithId(html('resource_post'), 't-content')).not.toMatch(/required/)
  })

  it('the online switch: stone-500 when off, thumb mirrored in right-to-left', () => {
    const sw = tagWithId(html('event_post', { ...EMPTY_DRAFT, isOnline: false }), 't-is_online')
    expect(sw).toContain('bg-stone-500')
    expect(sw).not.toContain('bg-stone-400')
    const thumb = /id="t-is_online"[^>]*><span class="([^"]*)"/.exec(html('event_post'))?.[1] ?? ''
    expect(thumb).toContain('rtl:-translate-x-1')
  })
})
