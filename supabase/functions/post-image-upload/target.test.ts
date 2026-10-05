import { describe, expect, it } from 'vitest'
import { ORG_BUCKET, POST_BUCKET, buildObjectPath, decideUpload, parseUploadTarget, resolveCanManage, sizeBucket } from './target.ts'

const ORG = '3f2b8c1e-9a4d-4c6b-8e1f-0a2b3c4d5e6f'
const FILE = '11111111-2222-4333-8444-555555555555'
const qs = (s: string) => new URLSearchParams(s)

describe('parseUploadTarget', () => {
  it('no org_id → post target (original feed-post behavior)', () => {
    expect(parseUploadTarget(qs(''))).toEqual({ kind: 'post' })
    expect(parseUploadTarget(qs('foo=bar'))).toEqual({ kind: 'post' })
  })

  it('a UUID org_id → org target, lowercased to one canonical folder', () => {
    expect(parseUploadTarget(qs(`org_id=${ORG}`))).toEqual({ kind: 'org', orgId: ORG })
    expect(parseUploadTarget(qs(`org_id=${ORG.toUpperCase()}`))).toEqual({ kind: 'org', orgId: ORG })
  })

  it('present-but-not-a-UUID org_id → invalid (400), never falls back to post', () => {
    for (const bad of ['', 'abc', `${ORG}x`, `../${ORG}`, `${ORG}/..`, 'post-images', `${ORG.slice(0, 35)}`]) {
      expect(parseUploadTarget(qs(`org_id=${encodeURIComponent(bad)}`))).toEqual({ kind: 'invalid' })
    }
  })

  it('repeated org_id → invalid', () => {
    expect(parseUploadTarget(qs(`org_id=${ORG}&org_id=${ORG}`))).toEqual({ kind: 'invalid' })
  })
})

describe('buildObjectPath', () => {
  it('post target writes post-images/<uid>/<file>.<ext>', () => {
    expect(buildObjectPath({ kind: 'post', userId: 'u-1' }, 'webp', FILE)).toEqual({
      bucket: POST_BUCKET,
      path: `u-1/${FILE}.webp`,
    })
  })

  it('org target writes org-photos/<org_id>/<file>.<ext>, never post-images', () => {
    const out = buildObjectPath({ kind: 'org', orgId: ORG }, 'jpg', FILE)
    expect(out).toEqual({ bucket: ORG_BUCKET, path: `${ORG}/${FILE}.jpg` })
    expect(out.bucket).not.toBe(POST_BUCKET)
  })
})

describe('sizeBucket', () => {
  it('buckets sizes coarsely', () => {
    expect(sizeBucket(0)).toBe('empty')
    expect(sizeBucket(50 * 1024)).toBe('<100KB')
    expect(sizeBucket(500 * 1024)).toBe('100KB-1MB')
    expect(sizeBucket(5 * 1024 * 1024)).toBe('1-5MB')
    expect(sizeBucket(5 * 1024 * 1024 + 1)).toBe('>5MB')
  })
})

describe('decideUpload — authorization before any byte is written', () => {
  const user = { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', is_anonymous: false }
  const org = { kind: 'org' as const, orgId: ORG }

  it('post target -> allowed into post-images/<uid>/', () => {
    const d = decideUpload({ user, target: { kind: 'post' }, canManage: false })
    expect(d).toEqual({ allow: true, bucket: POST_BUCKET, folder: `${user.id}/`, dest: { kind: 'post', userId: user.id } })
    if (d.allow) expect(buildObjectPath(d.dest, 'webp', FILE)).toEqual({ bucket: POST_BUCKET, path: `${user.id}/${FILE}.webp` })
  })

  it('org target without can_manage -> 403 and no destination to write to', () => {
    const d = decideUpload({ user, target: org, canManage: false })
    expect(d).toMatchObject({ allow: false, status: 403, reason: 'forbidden' })
    expect('dest' in d).toBe(false)
  })

  it('guest (anonymous) caller -> 403 on both targets, even with can_manage', () => {
    for (const target of [{ kind: 'post' as const }, org]) {
      expect(decideUpload({ user: { ...user, is_anonymous: true }, target, canManage: true })).toMatchObject({
        allow: false,
        status: 403,
        reason: 'anon.blocked',
      })
    }
  })

  it('no caller -> 401; malformed org_id -> 400', () => {
    expect(decideUpload({ user: null, target: org, canManage: true })).toMatchObject({ allow: false, status: 401 })
    expect(decideUpload({ user, target: parseUploadTarget(qs('org_id=../x')), canManage: true })).toMatchObject({
      allow: false,
      status: 400,
    })
  })

  it('org target with can_manage -> org-photos/<org_id>/', () => {
    const d = decideUpload({ user, target: org, canManage: true })
    expect(d).toEqual({ allow: true, bucket: ORG_BUCKET, folder: `${ORG}/`, dest: org })
    if (d.allow) expect(buildObjectPath(d.dest, 'png', FILE)).toEqual({ bucket: ORG_BUCKET, path: `${ORG}/${FILE}.png` })
  })
})

describe('resolveCanManage — only an error-free literal true grants org-photo access', () => {
  it('grants only { data: true, error: null }', () => {
    expect(resolveCanManage({ data: true, error: null })).toBe(true)
  })
  it('denies false, null, truthy non-booleans, and any RPC error', () => {
    expect(resolveCanManage({ data: false, error: null })).toBe(false)
    expect(resolveCanManage({ data: null, error: null })).toBe(false)
    expect(resolveCanManage({ data: 'true', error: null })).toBe(false)
    expect(resolveCanManage({ data: 1, error: null })).toBe(false)
    expect(resolveCanManage({ data: true, error: { message: 'permission denied', code: '42501' } })).toBe(false)
  })
})
