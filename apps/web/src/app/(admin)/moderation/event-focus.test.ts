// apps/web/src/app/(admin)/moderation/event-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Where focus returns after an event dialog closes when it was opened by a mouse click in Safari /
// Firefox on macOS (the clicked button never took focus; document.activeElement is <body>).

import { describe, it, expect } from 'vitest'
import { pickOpener } from './event-focus'

const el = (name: string) => ({ name, focus: () => {} })
const body = el('body')

describe('pickOpener', () => {
  it('a mouse click in Safari/Firefox: the clicked button, not <body>', () => {
    const button = el('Add dates')
    expect(pickOpener(button, body, body)).toBe(button)
  })
  it('keyboard / no click target: the focused control', () => {
    const button = el('Edit')
    expect(pickOpener(undefined, button, body)).toBe(button)
  })
  it('nothing but <body>: null, so the caller falls back to "New event"', () => {
    expect(pickOpener(undefined, body, body)).toBeNull()
    expect(pickOpener(body, body, body)).toBeNull()
    expect(pickOpener(null, null, body)).toBeNull()
  })
})
