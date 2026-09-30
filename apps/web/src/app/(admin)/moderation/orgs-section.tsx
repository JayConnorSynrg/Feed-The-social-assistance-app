'use client'

// apps/web/src/app/(admin)/moderation/orgs-section.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Platform-admin Organizations tab. A platform admin creates a directory organization (a NON-business
// org_type) with contact info, hours, a geocoded location, photos, and linked catalog resources — all
// from one form — and manages each org's membership roster below.
//
// The org_type vocabulary and the create/location/resource writes live in the data layer (org-vocab.ts
// + org-data.ts) so this component never touches an admissible-type list or a raw Supabase write for
// the org itself: the Select offers only the nine non-business types (INV-B) and the writer pins
// is_active=true so the org is public immediately (INV-A). A failed address geocode still creates the
// org (NULL location) and tells the admin (INV-C); each selected resource becomes exactly one
// org_resources row (INV-D); hours/photos key by the new org id via the existing child writers (INV-E).

import { useState, useEffect, useCallback } from 'react'
import { Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { logger } from '@/lib/logger'
import { resolveGeoPointV6 } from '@/lib/mapbox-geocode-v6'
import { normalizeState } from '@/lib/us-states'
import { useResourceSearch, type SearchResourceRow } from '@/hooks/use-resource-search'
import { uploadPostImage, deletePostImage } from '@/lib/post-image-upload'
import { withPhotoUploadMetric, photoImageType, insertBusinessHours, insertBusinessPhotos } from '@/lib/business-data'
import type { BusinessHours, BusinessPhoto } from '@/lib/business'
import {
  ORG_TYPE_OPTIONS,
  ORG_TYPE_LABELS,
  type NonBusinessOrgType,
} from '@/lib/org-vocab'
import { adminCreateOrganization, attachOrgResources, ewktPoint, fetchAdminOrgRoster } from '@/lib/org-data'

type MemberRole = 'admin' | 'member'

interface Org {
  id: string
  name: string
  org_type: string
  is_active: boolean
  description: string | null
}

interface OrgMember {
  id: string
  user_id: string
  role: string
  joined_at: string
}

// ---- Hours editor model — index 0..6 == Sun..Sat, matching BusinessHours.day_of_week -------------
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
interface DayHours {
  open: boolean
  openTime: string
  closeTime: string
}
function emptyHours(): DayHours[] {
  return DAY_LABELS.map(() => ({ open: false, openTime: '', closeTime: '' }))
}
/** A day marked open with both endpoints set contributes one BusinessHours row; others contribute none. */
function serializeHours(days: DayHours[]): BusinessHours[] {
  const out: BusinessHours[] = []
  days.forEach((day, dow) => {
    if (day.open && day.openTime && day.closeTime) {
      out.push({ day_of_week: dow, open_time: day.openTime, close_time: day.closeTime })
    }
  })
  return out
}

type UploadedPhoto = { url: string; path: string }
type PhotoKind = 'logo' | 'cover' | 'gallery'
const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'

const EMPTY_FORM = {
  name: '',
  org_type: 'community' as NonBusinessOrgType,
  description: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  email: '',
  website: '',
}

export function OrgsSection() {
  const supabase = createClient()

  const [orgs, setOrgs] = useState<Org[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)

  // Create org form
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [hours, setHours] = useState<DayHours[]>(emptyHours())
  const [logo, setLogo] = useState<UploadedPhoto | null>(null)
  const [cover, setCover] = useState<UploadedPhoto | null>(null)
  const [gallery, setGallery] = useState<UploadedPhoto[]>([])
  const [photoBusy, setPhotoBusy] = useState<Record<PhotoKind, boolean>>({ logo: false, cover: false, gallery: false })
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [selectedResources, setSelectedResources] = useState<SearchResourceRow[]>([])
  const [resourceQuery, setResourceQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createWarning, setCreateWarning] = useState<string | null>(null)

  const { results: resourceResults, loading: resourceLoading } = useResourceSearch({
    query: resourceQuery,
    surface: 'map',
  })

  // Add member form
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<MemberRole>('member')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)

  const setField = useCallback(
    <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
      setForm((f) => ({ ...f, [key]: value }))
    },
    [],
  )

  // Non-business ONLY (INV-1): the roster read lives in org-data.fetchAdminOrgRoster, which applies
  // `.in('org_type', NON_BUSINESS_ORG_TYPES)` so a business row can never enter this tab — it belongs
  // to the Businesses tab. A load failure leaves an empty roster rather than crashing the panel.
  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true)
    try {
      setOrgs(await fetchAdminOrgRoster(supabase))
    } catch {
      setOrgs([])
    } finally {
      setLoadingOrgs(false)
    }
  }, [supabase])

  const fetchMembers = useCallback(async (orgId: string) => {
    setLoadingMembers(true)
    const { data } = await supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at')
      .eq('org_id', orgId)
    setMembers(data ?? [])
    setLoadingMembers(false)
  }, [supabase])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  const handleSelectOrg = useCallback((orgId: string) => {
    setRosterError(null)
    if (selectedOrgId === orgId) {
      setSelectedOrgId(null)
      setMembers([])
    } else {
      setSelectedOrgId(orgId)
      fetchMembers(orgId)
    }
  }, [selectedOrgId, fetchMembers])

  // ---- Photo upload (reuses the validating edge uploader + business.photo.upload metric) ----------
  const handlePhotoSelect = useCallback(async (kind: PhotoKind, file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    setPhotoBusy((b) => ({ ...b, [kind]: true }))
    try {
      const uploaded = await withPhotoUploadMetric(photoImageType(file.type), file.size, async () => {
        const { url, path, error } = await uploadPostImage(file)
        if (error || !url || !path) throw new Error(error ?? 'Upload failed. Please try again.')
        return { url, path }
      })
      if (kind === 'logo') setLogo(uploaded)
      else if (kind === 'cover') setCover(uploaded)
      else setGallery((g) => [...g, uploaded])
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setPhotoBusy((b) => ({ ...b, [kind]: false }))
    }
  }, [])

  const removePhoto = useCallback((kind: PhotoKind, index?: number) => {
    if (kind === 'logo' && logo) {
      void deletePostImage(logo.path)
      setLogo(null)
    } else if (kind === 'cover' && cover) {
      void deletePostImage(cover.path)
      setCover(null)
    } else if (kind === 'gallery' && index != null) {
      const target = gallery[index]
      if (target) void deletePostImage(target.path)
      setGallery((g) => g.filter((_, i) => i !== index))
    }
  }, [logo, cover, gallery])

  // ---- Linked-resource multi-select (INV-D: one row per distinct id; deselect removes exactly it) --
  const toggleResource = useCallback((row: SearchResourceRow) => {
    setSelectedResources((prev) =>
      prev.some((r) => r.id === row.id) ? prev.filter((r) => r.id !== row.id) : [...prev, row],
    )
  }, [])

  const resetCreateForm = useCallback(() => {
    setForm({ ...EMPTY_FORM })
    setHours(emptyHours())
    setLogo(null)
    setCover(null)
    setGallery([])
    setPhotoError(null)
    setSelectedResources([])
    setResourceQuery('')
  }, [])

  const handleCreateOrg = useCallback(async () => {
    if (!form.name.trim() || creating) return
    setCreating(true)
    setCreateError(null)
    setCreateWarning(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Geocode the address (INV-C): whenever an address is present we attempt the geocode; a match
      // yields an EWKT point, a present-but-unresolvable address creates the org with NULL location
      // and warns — never a silently-wrong point.
      let location: string | null = null
      let geocodeFailed = false
      if (form.address.trim()) {
        const query = [
          form.address.trim(),
          form.city.trim(),
          normalizeState(form.state) ?? form.state.trim(),
          form.zip_code.trim(),
        ].filter(Boolean).join(', ')
        const match = await resolveGeoPointV6(query, process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
        if (match) location = ewktPoint(match.lng, match.lat)
        else geocodeFailed = true
      }

      const outcome = await adminCreateOrganization(supabase, {
        name: form.name,
        org_type: form.org_type,
        description: form.description,
        address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        phone: form.phone,
        email: form.email,
        website: form.website,
        createdBy: user?.id ?? null,
        location,
      })

      if (!outcome.ok) {
        setCreateError(outcome.error)
        return
      }

      // Child rows key by the new org id (INV-E). Each is best-effort — a failure is surfaced as a
      // truthful partial warning, never a silent swallow and never an undo of the created org.
      const failed: string[] = []
      const hourRows = serializeHours(hours)
      if (hourRows.length > 0) {
        try {
          await insertBusinessHours(supabase, outcome.id, hourRows)
        } catch {
          failed.push('hours')
        }
      }
      const photoRows: BusinessPhoto[] = []
      if (logo) photoRows.push({ kind: 'logo', url: logo.url, storage_path: logo.path, sort_order: 0, caption: null })
      if (cover) photoRows.push({ kind: 'cover', url: cover.url, storage_path: cover.path, sort_order: 0, caption: null })
      gallery.forEach((g, i) => photoRows.push({ kind: 'gallery', url: g.url, storage_path: g.path, sort_order: i, caption: null }))
      if (photoRows.length > 0) {
        try {
          await insertBusinessPhotos(supabase, outcome.id, photoRows)
        } catch {
          failed.push('photos')
        }
      }
      if (selectedResources.length > 0) {
        try {
          await attachOrgResources(supabase, outcome.id, selectedResources.map((r) => r.id))
        } catch {
          failed.push('linked resources')
        }
      }

      logger.info('admin.org.created', {
        org_type: form.org_type,
        located: outcome.locationSet,
        hours_days: hourRows.length,
        photo_count: photoRows.length,
        resource_count: selectedResources.length,
      })

      const warnings: string[] = []
      if (geocodeFailed) warnings.push('the address could not be located, so it has no map pin yet')
      if (outcome.warning) warnings.push('the map location could not be saved')
      if (failed.length > 0) warnings.push(`some details did not save (${failed.join(', ')})`)
      setCreateWarning(
        warnings.length > 0 ? `Organization created, but ${warnings.join('; ')}.` : null,
      )

      resetCreateForm()
      await fetchOrgs()
    } finally {
      setCreating(false)
    }
  }, [supabase, form, hours, logo, cover, gallery, selectedResources, creating, resetCreateForm, fetchOrgs])

  const handleAddMember = useCallback(async () => {
    if (!selectedOrgId || !addUserId.trim()) return
    setAddingMember(true)
    setAddMemberError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('organization_members')
        .insert({
          org_id: selectedOrgId,
          user_id: addUserId.trim(),
          role: addRole,
          invited_by: user?.id,
        })
      if (error) {
        setAddMemberError(error.message)
      } else {
        setAddUserId('')
        setAddRole('member')
        await fetchMembers(selectedOrgId)
      }
    } finally {
      setAddingMember(false)
    }
  }, [supabase, selectedOrgId, addUserId, addRole, fetchMembers])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    setRosterError(null)
    const { data, error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .select('id')
    if (error) {
      setRosterError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setRosterError('Could not remove that member — you may not have permission, or they were already removed.')
      return
    }
    if (selectedOrgId) await fetchMembers(selectedOrgId)
  }, [supabase, selectedOrgId, fetchMembers])

  const handleChangeRole = useCallback(async (memberId: string, nextRole: MemberRole) => {
    setRosterError(null)
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role: nextRole })
      .eq('id', memberId)
      .select('id')
    if (error) {
      setRosterError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setRosterError('Could not change that role — you may not have permission.')
      return
    }
    if (selectedOrgId) await fetchMembers(selectedOrgId)
  }, [supabase, selectedOrgId, fetchMembers])

  const inputClass = 'text-stone-900 placeholder:text-stone-400'

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#4a5d23]">Organizations</h2>
        <p className="text-stone-600 mt-1 text-sm">
          Create local organizations and manage their membership rosters.
        </p>
      </div>

      {/* Create org form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-stone-100 mb-6">
        <h3 className="text-base font-semibold text-[#4a5d23] mb-4">Create Organization</h3>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-stone-700 text-sm">Name</Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Organization name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-type" className="text-stone-700 text-sm">Type</Label>
            <Select value={form.org_type} onValueChange={(v) => setField('org_type', v as NonBusinessOrgType)}>
              <SelectTrigger id="org-type" className="text-stone-900">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-desc" className="text-stone-700 text-sm">Description</Label>
            <Textarea
              id="org-desc"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Optional description"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Contact & location */}
        <h4 className="text-sm font-semibold text-stone-700 mt-6 mb-3">Contact & Location</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-address" className="text-stone-700 text-sm">Address</Label>
            <Input
              id="org-address"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Street address"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-city" className="text-stone-700 text-sm">City</Label>
            <Input id="org-city" value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="City" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-state" className="text-stone-700 text-sm">State</Label>
              <Input id="org-state" value={form.state} onChange={(e) => setField('state', e.target.value)} placeholder="State" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-zip" className="text-stone-700 text-sm">ZIP</Label>
              <Input id="org-zip" value={form.zip_code} onChange={(e) => setField('zip_code', e.target.value)} placeholder="ZIP" className={inputClass} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-phone" className="text-stone-700 text-sm">Phone</Label>
            <Input id="org-phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="Phone" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-email" className="text-stone-700 text-sm">Email</Label>
            <Input id="org-email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Email" className={inputClass} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-website" className="text-stone-700 text-sm">Website</Label>
            <Input id="org-website" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://…" className={inputClass} />
          </div>
        </div>

        {/* Hours */}
        <h4 className="text-sm font-semibold text-stone-700 mt-6 mb-3">Hours</h4>
        <div className="space-y-2">
          {hours.map((day, dow) => (
            <div key={DAY_LABELS[dow]} className="flex items-center gap-3">
              <label className="flex items-center gap-2 w-24 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={day.open}
                  onChange={(e) => setHours((h) => h.map((d, i) => (i === dow ? { ...d, open: e.target.checked } : d)))}
                />
                {DAY_LABELS[dow]}
              </label>
              <Input
                type="time"
                value={day.openTime}
                disabled={!day.open}
                onChange={(e) => setHours((h) => h.map((d, i) => (i === dow ? { ...d, openTime: e.target.value } : d)))}
                className={`${inputClass} w-32`}
                aria-label={`${DAY_LABELS[dow]} open time`}
              />
              <span className="text-stone-400 text-sm">to</span>
              <Input
                type="time"
                value={day.closeTime}
                disabled={!day.open}
                onChange={(e) => setHours((h) => h.map((d, i) => (i === dow ? { ...d, closeTime: e.target.value } : d)))}
                className={`${inputClass} w-32`}
                aria-label={`${DAY_LABELS[dow]} close time`}
              />
            </div>
          ))}
        </div>

        {/* Photos */}
        <h4 className="text-sm font-semibold text-stone-700 mt-6 mb-3">Photos</h4>
        <div className="flex flex-wrap gap-6">
          {(['logo', 'cover'] as const).map((kind) => {
            const value = kind === 'logo' ? logo : cover
            return (
              <div key={kind} className="space-y-1.5">
                <Label className="text-stone-700 text-sm capitalize">{kind}</Label>
                {value ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={value.url} alt={`${kind} preview`} className="h-16 w-16 rounded-lg object-cover border border-stone-200" />
                    <button type="button" onClick={() => removePhoto(kind)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </div>
                ) : (
                  <Input
                    type="file"
                    accept={PHOTO_ACCEPT}
                    disabled={photoBusy[kind]}
                    onChange={(e) => handlePhotoSelect(kind, e.target.files?.[0])}
                    className={`${inputClass} w-56`}
                  />
                )}
              </div>
            )
          })}
          <div className="space-y-1.5">
            <Label className="text-stone-700 text-sm">Gallery</Label>
            <div className="flex flex-wrap items-center gap-2">
              {gallery.map((g, i) => (
                <div key={g.path} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt={`gallery ${i + 1}`} className="h-16 w-16 rounded-lg object-cover border border-stone-200" />
                  <button type="button" onClick={() => removePhoto('gallery', i)} className="absolute -top-2 -right-2 bg-white rounded-full border border-stone-200 p-0.5 text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <Input
                type="file"
                accept={PHOTO_ACCEPT}
                disabled={photoBusy.gallery}
                onChange={(e) => { handlePhotoSelect('gallery', e.target.files?.[0]); e.target.value = '' }}
                className={`${inputClass} w-56`}
              />
            </div>
          </div>
        </div>
        {photoError && <p className="text-red-600 text-xs mt-2">{photoError}</p>}

        {/* Linked resources */}
        <h4 className="text-sm font-semibold text-stone-700 mt-6 mb-3">Linked Resources</h4>
        {selectedResources.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedResources.map((r) => (
              <Badge key={r.id} variant="outline" className="text-xs text-[#4a5d23] border-[#4a5d23]/30 flex items-center gap-1">
                {r.name}
                <button type="button" onClick={() => toggleResource(r)} aria-label={`Remove ${r.name}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Input
          value={resourceQuery}
          onChange={(e) => setResourceQuery(e.target.value)}
          placeholder="Search the resource catalog to link…"
          className={inputClass}
        />
        {resourceQuery.trim() && (
          <div className="mt-2 rounded-lg border border-stone-100 max-h-56 overflow-y-auto divide-y divide-stone-100">
            {resourceLoading ? (
              <p className="text-stone-500 text-sm p-3">Searching…</p>
            ) : resourceResults.length === 0 ? (
              <p className="text-stone-500 text-sm p-3">No matching resources.</p>
            ) : (
              resourceResults.map((r) => {
                const selected = selectedResources.some((s) => s.id === r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleResource(r)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center justify-between ${selected ? 'bg-lime-50' : ''}`}
                  >
                    <span className="text-stone-800">
                      {r.name}
                      {(r.city || r.state) && <span className="text-stone-400"> · {[r.city, r.state].filter(Boolean).join(', ')}</span>}
                    </span>
                    {selected && <span className="text-[#4a5d23] text-xs">Linked</span>}
                  </button>
                )
              })
            )}
          </div>
        )}

        {createError && <p className="text-red-600 text-sm mt-4">{createError}</p>}
        {createWarning && <p className="text-amber-700 text-sm mt-4">{createWarning}</p>}
        <Button
          onClick={handleCreateOrg}
          disabled={creating || !form.name.trim()}
          className="mt-4 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
        >
          {creating ? 'Creating…' : 'Create Organization'}
        </Button>
      </div>

      {/* Org list */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-stone-100">
        <h3 className="text-base font-semibold text-[#4a5d23] mb-4">
          Organizations {!loadingOrgs && `(${orgs.length})`}
        </h3>

        {loadingOrgs ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-stone-500 text-sm">No organizations yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {orgs.map((org) => (
              <div key={org.id}>
                {/* Org row — click to expand */}
                <button
                  onClick={() => handleSelectOrg(org.id)}
                  className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-stone-50 rounded transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-stone-800">{org.name}</span>
                    <Badge variant="outline" className="text-xs text-[#4a5d23] border-[#4a5d23]/30">
                      {/* The roster is filtered to the nine non-business types (INV-1), so org_type
                          is always one of them — the label lookup is total, no business fallback. */}
                      {ORG_TYPE_LABELS[org.org_type as NonBusinessOrgType]}
                    </Badge>
                    {!org.is_active && (
                      <Badge variant="outline" className="text-xs text-stone-500 border-stone-300">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <span className="text-stone-400 text-xs">{selectedOrgId === org.id ? '▲' : '▼'}</span>
                </button>

                {/* Expanded member panel */}
                {selectedOrgId === org.id && (
                  <div className="pb-4 px-2">
                    {org.description && (
                      <p className="text-stone-600 text-sm mb-3">{org.description}</p>
                    )}

                    {/* Add member form */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Input
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        placeholder="User UUID"
                        className="text-stone-900 placeholder:text-stone-400 w-64 text-sm"
                      />
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                        <SelectTrigger className="w-28 text-sm text-stone-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleAddMember}
                        disabled={addingMember || !addUserId.trim()}
                        size="sm"
                        className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                      >
                        {addingMember ? 'Adding…' : 'Add Member'}
                      </Button>
                    </div>
                    {addMemberError && (
                      <p className="text-red-600 text-xs mb-2">{addMemberError}</p>
                    )}
                    {rosterError && (
                      <p className="text-red-600 text-xs mb-2">{rosterError}</p>
                    )}

                    {/* Member list */}
                    {loadingMembers ? (
                      <p className="text-stone-500 text-sm">Loading members…</p>
                    ) : members.length === 0 ? (
                      <p className="text-stone-500 text-sm">No members yet.</p>
                    ) : (
                      <div className="rounded-lg border border-stone-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-stone-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">User ID</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Role</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Joined</th>
                              <th className="px-3 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {members.map((m) => (
                              <tr key={m.id} className="hover:bg-stone-50">
                                <td className="px-3 py-2 font-mono text-xs text-stone-700 truncate max-w-[180px]">
                                  {m.user_id}
                                </td>
                                <td className="px-3 py-2">
                                  <Select
                                    value={m.role === 'admin' ? 'admin' : 'member'}
                                    onValueChange={(v) => handleChangeRole(m.id, v as MemberRole)}
                                  >
                                    <SelectTrigger className="w-28 h-8 text-xs text-stone-900">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="member">Member</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-3 py-2 text-stone-500 text-xs">
                                  {new Date(m.joined_at).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => handleRemoveMember(m.id)}
                                    className="text-red-500 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="h-3 w-3" /> Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
