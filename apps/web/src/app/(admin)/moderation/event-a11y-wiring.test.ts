// apps/web/src/app/(admin)/moderation/event-a11y-wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Static a11y wiring of the event screens that the node test environment cannot render (same
// approach as org-a11y-wiring.test.ts): focus returns to the opener when every event dialog
// closes, translated portals carry lang/dir, the status line stays in the accessibility tree,
// the location error focuses an enabled control, and inputs keep a 3:1 border.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (f: string) => fs.readFileSync(path.join(HERE, f), 'utf8')

describe('event dialogs', () => {
  const scheduler = read('event-scheduler.tsx')
  const ui = read('event-form-ui.tsx')

  it('every dialog the scheduler opens restores focus to its opener (or New event)', () => {
    // create, add dates, edit, cancel-date confirm, kiosk, attendance
    expect(scheduler.match(/onCloseAutoFocus=\{restoreFocus\}/g)?.length).toBe(6)
    expect(scheduler).toMatch(/restoreFocusAfterPanel\(e, opener, \{ querySelector: \(\) => newEventRef\.current \}\)/)
    expect(ui).toMatch(/onCloseAutoFocus=\{onCloseAutoFocus\}/)
  })

  it('every opener records the clicked control (Safari/Firefox macOS do not focus buttons on click)', () => {
    expect(scheduler).not.toMatch(/rememberOpener\(\)/)
    expect(scheduler).toMatch(/pickOpener\(e\?\.currentTarget, document\.activeElement, document\.body\)/)
    // create (header + day "+"), kiosk, attendance (calendar + past list), cancel, edit, add dates
    expect(scheduler.match(/onClick=\{\(e\) =>/g)?.length).toBe(8)
  })

  it('Past and cancelled: each Attendance button names its row (title + when)', () => {
    expect(scheduler).toMatch(/const ids = entryIds\(occ, 'p'\)/)
    expect(scheduler).toMatch(/aria-describedby=\{`\$\{ids\.title\} \$\{ids\.time\}`\}\s+onClick=\{\(e\) => void openAttendance\(occ, e\)\}/)
  })

  it('translated portals and the scheduler root carry lang + dir', () => {
    expect(ui).toMatch(/lang=\{locale\}\s+dir=\{dir\(locale\)\}/)
    expect(scheduler).toMatch(/<div lang=\{locale\} dir=\{dir\(locale\)\} className="space-y-4">/)
    expect(scheduler).toMatch(/<AlertDialogContent lang=\{locale\} dir=\{dir\(locale\)\}/)
  })

  it('attendance is a real dialog (no hand-built overlay) and the status line is never display:none', () => {
    expect(scheduler).not.toMatch(/role="dialog"/)
    expect(scheduler).not.toMatch(/empty:hidden/)
  })

  it('inputs use a border with at least 3:1 contrast on white (stone-500)', () => {
    expect(ui).toMatch(/const INPUT =\s+'block w-full min-h-10 rounded-lg border border-stone-500/)
  })
})

describe('location field', () => {
  const loc = read('event-location-field.tsx')
  it('the error focus target is the CHECKED radio and every radio is described by the error', () => {
    expect(loc).toMatch(/ref=\{value\.source === source \? firstRef : undefined\}/)
    expect(loc).toMatch(/\[opts\.note, error \? errId : null\]/)
  })
})

describe('recurring-events review fixes (wiring the node env cannot render)', () => {
  const scheduler = read('event-scheduler.tsx')
  const edit = read('event-edit-dialog.tsx')

  it('Edit focuses the first error in its own document order and returns to Save changes after a failed stop-confirm', () => {
    expect(edit).toMatch(/firstErrorField\(next, EDIT_FIELD_ORDER\)/)
    expect(edit).toMatch(/if \(focusAfterFailedSave\(placed, stopConfirmed\) === 'submit'\) requestAnimationFrame\(\(\) => submitRef\.current\?\.focus\(\)\)/)
  })

  it('a failed calendar window never replaces the tab; both calendars show the inline status', () => {
    expect(scheduler).toMatch(/const loadState = listState === 'error' \? 'error' :/)
    expect(scheduler.match(/<CalendarWindowStatus result=\{\{ state: windowState, overLimit: windowOverLimit, retrying: windowRetrying \}\}/g)).toHaveLength(2)
  })

  it('"Load more dates" has its own event key, shows its failure next to the button, and announces what loaded', () => {
    expect(scheduler).toMatch(/eventFormT\(locale, 'loadMoreDates'\)/)
    expect(scheduler).not.toMatch(/dirLoadMore/)
    expect(scheduler).toMatch(/aria-describedby=\{pastError \? 'ev-past-more-err' : undefined\}/)
    expect(scheduler).toMatch(/setNotice\(page\.notice\)/)
  })

  it('date badges use a logical margin (right-to-left safe)', () => {
    expect(scheduler).toMatch(/className="me-1 mt-0\.5 inline-block rounded-full/)
    expect(scheduler).not.toMatch(/\bmr-1\b/)
  })
})

describe('calendar window retry focus', () => {
  const scheduler = read('event-scheduler.tsx')
  it('Try again marks a retry; once the window read settles the visible calendar label (tabIndex -1) takes focus', () => {
    expect(scheduler).toMatch(/const retryWindow = \(\) => \{\s*windowRetryPending\.current = true/)
    expect(scheduler.match(/onRetry=\{retryWindow\}/g)).toHaveLength(2)
    expect(scheduler).toMatch(/focusAfterWindowRetry\(windowRetryPending, windowState, visibleCalendarLabel\(\[weekLabelRef\.current, dayLabelRef\.current\]\)\)/)
    expect(scheduler).toMatch(/windowRetryPending\.current = true\s*setWindowRetrying\(true\)/)
    expect(scheduler.match(/retrying: windowRetrying \}\}/g)).toHaveLength(2)
    expect(scheduler.match(/setWindowSettled\(\(n\) => n \+ 1\)/g)).toHaveLength(2)
    expect(scheduler).toMatch(/<span ref=\{weekLabelRef\} tabIndex=\{-1\}/)
    expect(scheduler).toMatch(/<div ref=\{dayLabelRef\} tabIndex=\{-1\}/)
  })
})

describe('the same status sentence is announced again', () => {
  const scheduler = read('event-scheduler.tsx')
  const button = read('extend-series-button.tsx')
  const overview = read('org/org-overview.tsx')
  it('the status line is cleared before each awaited Load more / Extend', () => {
    expect(scheduler).toMatch(/setNotice\(null\)\s*const res = await pastDatesQuery/)
    expect(button).toMatch(/onStart\?\.\(\)\s*const outcome = await runExtend/)
    expect(scheduler).toMatch(/onStart=\{\(\) => setNotice\(null\)\}/)
    expect(overview).toMatch(/onStart=\{\(\) => setNotice\(''\)\}/)
    expect(overview).toMatch(/onStart=\{onStart\}/)
  })
})
