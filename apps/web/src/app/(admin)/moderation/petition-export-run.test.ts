// apps/web/src/app/(admin)/moderation/petition-export-run.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Download CSV button: single flight (a second tap while a download runs sends nothing), the
// saved file and its name, the error code the alert line maps, and the section's wiring (a real
// button with busy state, an alert region, no "coming soon" left in the Community tab).

import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { runPetitionExport, type InFlightFlag } from './petition-export-run'
import { petitionExportErrorKey } from '@/lib/i18n-admin-petitions'

const ID = '11111111-2222-4333-8444-555555555555'
const csvResponse = () =>
  new Response('﻿Full Name\r\nA', {
    status: 200,
    headers: { 'Content-Disposition': `attachment; filename="petition-signatures-${ID}-2026-11-15.csv"`, 'X-Row-Count': '1' },
  })

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('runPetitionExport', () => {
  it('a second tap while the first download runs sends nothing; after it finishes a new tap sends again', async () => {
    const flag: InFlightFlag = { current: false }
    const pending = deferred<Response>()
    const post = vi.fn(() => pending.promise)
    const save = vi.fn()
    const deps = { post, save, now: () => new Date('2026-11-15T00:00:00Z') }

    const first = runPetitionExport(flag, ID, deps)
    expect(flag.current).toBe(true) // set before the first await
    await expect(runPetitionExport(flag, ID, deps)).resolves.toEqual({ status: 'busy' })
    expect(post).toHaveBeenCalledTimes(1)

    pending.resolve(csvResponse())
    await expect(first).resolves.toEqual({ status: 'done', rowCount: 1 })
    expect(flag.current).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][1]).toBe(`petition-signatures-${ID}-2026-11-15.csv`)

    post.mockImplementation(async () => csvResponse())
    await runPetitionExport(flag, ID, deps)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('posts to the export route for that petition', async () => {
    const post = vi.fn(async () => csvResponse())
    await runPetitionExport({ current: false }, ID, { post, save: vi.fn(), now: () => new Date() })
    expect(post).toHaveBeenCalledWith(`/api/admin/petitions/${ID}/export`)
  })

  it('a refused or failed call saves no file, returns the server code and releases the flag', async () => {
    const flag = { current: false }
    const save = vi.fn()
    const post = vi.fn(async () => Response.json({ code: 'insufficient_tier' }, { status: 403 }))
    await expect(runPetitionExport(flag, ID, { post, save, now: () => new Date() })).resolves.toEqual({
      status: 'error',
      code: 'insufficient_tier',
    })
    expect(save).not.toHaveBeenCalled()
    expect(flag.current).toBe(false)

    const thrown = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(runPetitionExport(flag, ID, { post: thrown, save, now: () => new Date() })).resolves.toEqual({
      status: 'error',
      code: 'network',
    })
    expect(flag.current).toBe(false)
  })

  it('maps server codes to the admin line', () => {
    expect(petitionExportErrorKey('insufficient_tier')).toBe('errForbidden')
    expect(petitionExportErrorKey('not_found')).toBe('errNotFound')
    expect(petitionExportErrorKey('incomplete')).toBe('errIncomplete')
    expect(petitionExportErrorKey('audit_failed')).toBe('errGeneric')
  })
})

describe('wiring', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8')

  it('the Community tab mounts the export and no longer says "coming soon"', () => {
    const tab = read('community-tab.tsx')
    expect(tab).toMatch(/<PetitionExportSection locale=\{locale\} \/>/)
    expect(tab).not.toMatch(/coming soon/i)
  })

  it('the section uses one ref-held flag, a real button with busy state, and an alert region', () => {
    const src = read('petition-export-section.tsx')
    expect(src).toMatch(/const inFlight = useRef\(false\)/)
    expect(src).toMatch(/runPetitionExport\(inFlight, /)
    expect(src).toMatch(/<button\s+type="button"[\s\S]*?aria-busy=\{busy\}/)
    expect(src).toMatch(/role="alert"[^>]*>\{error\}/)
    expect(src).toMatch(/privilegedFetch\('admin\.petition\.export'/)
  })
})
