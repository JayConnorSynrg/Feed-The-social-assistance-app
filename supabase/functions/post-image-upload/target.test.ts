import { describe, expect, it } from 'vitest'
import { ORG_BUCKET, POST_BUCKET, buildObjectPath, parseUploadTarget, sizeBucket } from './target.ts'

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
