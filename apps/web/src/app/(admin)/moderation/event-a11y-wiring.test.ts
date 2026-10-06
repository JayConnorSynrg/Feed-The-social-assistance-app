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
