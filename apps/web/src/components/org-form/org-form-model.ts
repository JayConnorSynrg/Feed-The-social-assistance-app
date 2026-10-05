// apps/web/src/components/org-form/org-form-model.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure model behind <OrgFormPanel>: form values, the zod schema, prefill from the admin detail
// reader, and the admin_save_organization payload builder. No React, no Supabase, no browser
// globals, so org-form-model.test.ts exercises the exact logic the panel runs.
//
// Location rule (owner ruling): a pin reaches the payload ONLY after a person confirms it. A
// geocoded or clicked pin is a draft; saving with an unconfirmed draft is blocked. `location` is
// omitted (keep), null (clear) or {lng,lat} (set) per the RPC contract.

import { z } from 'zod'
import type { BusinessHours } from '@/lib/business'
import { NON_BUSINESS_ORG_TYPES } from '@/lib/org-vocab'
import type { AdminOrgDetail, OrgNameIndexRow } from '@/lib/org-data'
import type { OrgFormMessages } from '@/lib/i18n-org-forms'
import type { OrgPhotoPayload, OrgSavePayload } from '@/lib/org-admin-rpc'
import { pathsInOrgFolder } from '@/lib/org-photo-upload'
import type { SelectedResource } from './resource-directory-model'
import { normalizeLoadedHours, orderRows, presetHours, validateHours } from './hours-model'

export type OrgFormMode = 'create' | 'edit'
/** Entity kinds the panel serves. PR-B adds 'business' (business fields + services). */
export type OrgFormKind = 'org'

export type PinState =
  | { status: 'none' }
  | { status: 'saved'; lng: number; lat: number }
  | { status: 'draft'; lng: number; lat: number; source: 'exact' | 'approximate' | 'manual' }
  | { status: 'confirmed'; lng: number; lat: number }
  | { status: 'removed' }

export type PhotoItem =
  | { key: string; source: 'existing'; url: string; storage_path: string; caption: string | null }
  | { key: string; source: 'new'; file: File; previewUrl: string }

export interface OrgFormValues {
  name: string
  org_type: string
  description: string
  phone: string
  email: string
  website: string
  address: string
  city: string
  state: string
  zip_code: string
  hours: BusinessHours[]
  logo: PhotoItem | null
  cover: PhotoItem | null
  gallery: PhotoItem[]
  resources: SelectedResource[]
  pin: PinState
}

type MsgKey = keyof OrgFormMessages

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** '' -> null; scheme-less -> https://…; an explicit http(s):// is kept. */
export function normalizeWebsite(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

/** A website the save will accept: http(s) with a dotted host. */
export function isValidWebsite(raw: string): boolean {
  const v = normalizeWebsite(raw)
  if (v === null) return true
  try {
    const u = new URL(v)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.')
  } catch {
    return false
  }
}

export const orgFormSchema = z.object({
  name: z.string().refine((v) => v.trim().length > 0, { message: 'errNameRequired' satisfies MsgKey }),
  org_type: z.enum(NON_BUSINESS_ORG_TYPES),
  description: z.string(),
  phone: z.string(),
  email: z.string().refine((v) => !v.trim() || EMAIL_RE.test(v.trim()), { message: 'errEmailInvalid' satisfies MsgKey }),
  website: z.string().refine(isValidWebsite, { message: 'errWebsiteInvalid' satisfies MsgKey }),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip_code: z.string(),
  hours: z
    .array(z.object({ day_of_week: z.number(), open_time: z.string(), close_time: z.string() }))
    .refine((rows) => validateHours(rows).length === 0, { message: 'hoursFixBeforeSave' satisfies MsgKey }),
  logo: z.custom<PhotoItem | null>(),
  cover: z.custom<PhotoItem | null>(),
  gallery: z.array(z.custom<PhotoItem>()),
  resources: z.array(z.custom<SelectedResource>()),
  pin: z
    .custom<PinState>()
    .refine((p) => p.status !== 'draft', { message: 'locConfirmBeforeSave' satisfies MsgKey }),
})

/** Create-mode defaults: Mon–Fri 9–5, no pin, nothing linked. */
export function emptyFormValues(): OrgFormValues {
  return {
    name: '',
    org_type: 'community',
    description: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    hours: presetHours('mon-fri-9-5'),
    logo: null,
    cover: null,
    gallery: [],
    resources: [],
    pin: { status: 'none' },
  }
}

function existingPhoto(p: { url: string; storage_path: string; caption: string | null }): PhotoItem {
  return { key: `existing:${p.storage_path}`, source: 'existing', url: p.url, storage_path: p.storage_path, caption: p.caption }
}

/** Edit-mode prefill. Zero-length stored hours are dropped (the RPC rejects them) and counted. */
export function formValuesFromDetail(detail: AdminOrgDetail): { values: OrgFormValues; droppedZeroLength: number } {
  const { rows, droppedZeroLength } = normalizeLoadedHours(detail.hours)
  const logo = detail.photos.find((p) => p.kind === 'logo')
  const cover = detail.photos.find((p) => p.kind === 'cover')
  return {
    droppedZeroLength,
    values: {
      name: detail.name,
      org_type: detail.org_type,
      description: detail.description ?? '',
      phone: detail.phone ?? '',
      email: detail.email ?? '',
      website: detail.website ?? '',
      address: detail.address ?? '',
      city: detail.city ?? '',
      state: detail.state ?? '',
      zip_code: detail.zip_code ?? '',
      hours: rows,
      logo: logo ? existingPhoto(logo) : null,
      cover: cover ? existingPhoto(cover) : null,
      gallery: detail.photos.filter((p) => p.kind === 'gallery').map(existingPhoto),
      resources: detail.resources.map((r) => ({ ...r })),
      pin: detail.location ? { status: 'saved', ...detail.location } : { status: 'none' },
    },
  }
}

/** The location key: undefined = omit (keep), null = clear, {lng,lat} = set. */
export function locationPayload(pin: PinState, hadLocation: boolean): { lng: number; lat: number } | null | undefined {
  if (pin.status === 'confirmed') return { lng: pin.lng, lat: pin.lat }
  if (pin.status === 'removed') return hadLocation ? null : undefined
  return undefined
}

/** Every photo the save still needs to upload, in payload order. */
export function newPhotoItems(values: Pick<OrgFormValues, 'logo' | 'cover' | 'gallery'>): Array<Extract<PhotoItem, { source: 'new' }>> {
  return [values.logo, values.cover, ...values.gallery].filter(
    (p): p is Extract<PhotoItem, { source: 'new' }> => p !== null && p.source === 'new'
  )
}

const text = (v: string): string | null => {
  const t = v.trim()
  return t ? t : null
}

/**
 * Build the admin_save_organization payload. `uploaded` maps a new photo's key to the edge
 * function's {url, path}. Hours, photo paths and resource ids are de-duplicated (the RPC rejects
 * duplicates with 22023).
 */
export function buildSavePayload(
  values: OrgFormValues,
  uploaded: ReadonlyMap<string, { url: string; path: string }>,
  hadLocation: boolean
): OrgSavePayload {
  const photos: OrgPhotoPayload[] = []
  const seenPaths = new Set<string>()
  const pushPhoto = (item: PhotoItem | null, kind: OrgPhotoPayload['kind'], sort: number) => {
    if (!item) return
    const ref =
      item.source === 'existing'
        ? { url: item.url, storage_path: item.storage_path, caption: item.caption }
        : (() => {
            const up = uploaded.get(item.key)
            return up ? { url: up.url, storage_path: up.path, caption: null } : null
          })()
    if (!ref || seenPaths.has(ref.storage_path)) return
    seenPaths.add(ref.storage_path)
    photos.push({ kind, sort_order: sort, ...ref })
  }
  pushPhoto(values.logo, 'logo', 0)
  pushPhoto(values.cover, 'cover', 0)
  values.gallery.forEach((g, i) => pushPhoto(g, 'gallery', i))

  const seenHours = new Set<string>()
  const hours = orderRows(values.hours).filter((h) => {
    const k = `${h.day_of_week}|${h.open_time}|${h.close_time}`
    if (seenHours.has(k)) return false
    seenHours.add(k)
    return true
  })

  const payload: OrgSavePayload = {
    name: values.name.trim(),
    org_type: values.org_type,
    description: text(values.description),
    address: text(values.address),
    city: text(values.city),
    state: text(values.state),
    zip_code: text(values.zip_code),
    phone: text(values.phone),
    email: text(values.email),
    website: normalizeWebsite(values.website),
    hours,
    photos,
    resource_ids: [...new Set(values.resources.map((r) => r.id))],
  }
  const location = locationPayload(values.pin, hadLocation)
  if (location !== undefined) payload.location = location
  return payload
}

/** Storage cleanup after a save attempt: removed photos on success, this attempt's uploads on failure. */
export function photoCleanupPaths(
  orgId: string,
  outcome: { ok: true; removed: readonly string[] } | { ok: false; uploaded: readonly string[] }
): string[] {
  return pathsInOrgFolder(orgId, outcome.ok ? outcome.removed : outcome.uploaded)
}

// ---- Duplicate-name warning -----------------------------------------------------------------

/** Lowercase, strip accents/punctuation, '&' -> 'and', drop a leading 'the' and legal suffixes. */
export function normalizeOrgName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/ (inc|llc|co|corp|corporation|org|ltd)$/, '')
    .trim()
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Orgs whose normalized name equals, or is within a small edit distance of, `name`. */
export function findSimilarOrgs(
  name: string,
  index: readonly OrgNameIndexRow[],
  excludeId?: string | null
): OrgNameIndexRow[] {
  const target = normalizeOrgName(name)
  if (target.length < 3) return []
  const allowed = target.length >= 12 ? 2 : target.length >= 6 ? 1 : 0
  return index.filter((row) => {
    if (row.id === excludeId) return false
    const other = normalizeOrgName(row.name)
    if (!other) return false
    return other === target || editDistance(other, target) <= allowed
  })
}
