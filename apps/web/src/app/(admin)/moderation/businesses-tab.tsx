'use client'

// apps/web/src/app/(admin)/moderation/businesses-tab.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P4a RA management surface for member-submitted local businesses. Two sections that together cover
// EVERY org_type='business' row (INV-2), symmetric with the Organizations tab's non-business roster:
//   1. "Awaiting review" — the pending queue (fetchPendingBusinesses). Approve / Reject (with an
//      optional reason) each go through privilegedRpc (CINV3) so they carry x-request-id + withMetric
//      telemetry and record ok:false on failure — the SECDEF RPCs are never called raw.
//   2. "Approved businesses" — every approved business WITH live/retired state (fetchAdminBusinessList,
//      the admin reader that projects is_active under orgs_admin_select). Each row shows an
//      Active/Inactive badge, Edit (adminUpdateBusiness), and a coherent STATEFUL toggle:
//      "Deactivate" when active / "Reactivate" when inactive, both via adminSetBusinessActive — plain
//      admin table UPDATEs authorized by orgs_admin_update, each wrapped in withMetric. Deactivate
//      flips is_active=false (removing it from every public surface — showcase / map / page);
//      Reactivate flips it back. The row stays in the list either way, so both directions are visible.
//
// NO non-business org appears here: both readers filter org_type='business' (INV-2). The public
// readers (fetchApprovedBusinesses / fetchApprovedBusinessById) filter is_active=true themselves, so an
// admin viewing a member surface sees what members see — only this admin reader projects is_active
// and lists inactive rows. Each approved row offers "View public page" (/s/business/<id>) while active,
// and says why members cannot see it while inactive.
//
// "Edit in admin" (?tab=businesses&focus=business:<uuid>, from a member surface): once the approved
// list has loaded, that business's row opens in edit mode, scrolled into view with its Name field
// focused. Only a platform admin can save a business (orgs_admin_update), so for any other tier, or
// an id not in the approved list, the tab writes 'not_found' with a plain line saying why. One
// admin.deeplink.resolve row per followed link (use-admin-focus.ts), then focus is stripped; a
// malformed link or a tier that does not see this tab is the shell gate's row.
//
// Saves fail loudly: an UPDATE that RLS filtered to zero rows is an error (business-data.ts), never
// a success, so the edit form stays open with the reason and the toggle reverts.

import { useCallback, useEffect, useState } from 'react'
import { Check, X, Loader2, Leaf, MapPin, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { businessMapVisibility, businessVisibility, isMapPoint, showsMapControl } from '@/lib/member-visibility'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { parseGeographyPoint } from '@/lib/business'
import { privilegedRpc } from '@/lib/privileged-action'
import {
  fetchPendingBusinesses,
  fetchAdminBusinessList,
  adminSetBusinessActive,
  adminUpdateBusiness,
  type PendingBusiness,
  type AdminBusiness,
  type AdminBusinessEdit,
} from '@/lib/business-data'
import type { Business } from '@/lib/business'
import { useAdminViewer } from '@/hooks/use-admin-viewer'
import { canEditBusinesses } from '@/lib/admin-tier'
import { useAdminFocusSession } from './use-admin-focus'
import { AdminFocusNoticeLine, type AdminFocusNotice } from './admin-focus-notice'

// The editable-field draft the inline edit form holds while open (mirrors AdminBusinessEdit; empty
// strings in the inputs, coerced to the null/trimmed shape by adminUpdateBusiness at write time).
interface EditDraft {
  name: string
  description: string
  phone: string
  email: string
  website: string
}

function toDraft(b: Business): EditDraft {
  return {
    name: b.name ?? '',
    description: b.description ?? '',
    phone: b.phone ?? '',
    email: b.email ?? '',
    website: b.website ?? '',
  }
}

const inputClass = 'text-stone-900 placeholder:text-stone-400'

export function BusinessesTab() {
  const supabase = createClient()

  // Section 1 — pending queue.
  const [pending, setPending] = useState<PendingBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  // Section 2 — approved list (with is_active) + its edit / set-active state.
  const [approved, setApproved] = useState<AdminBusiness[]>([])
  const [loadingApproved, setLoadingApproved] = useState(true)
  const [approvedError, setApprovedError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadPending = useCallback(async () => {
    setLoading(true)
    setQueueError(null)
    try {
      setPending(await fetchPendingBusinesses(supabase))
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to load pending businesses')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadApproved = useCallback(async () => {
    setLoadingApproved(true)
    setApprovedError(null)
    try {
      setApproved(await fetchAdminBusinessList(supabase))
    } catch (err) {
      setApprovedError(err instanceof Error ? err.message : 'Failed to load approved businesses')
    } finally {
      setLoadingApproved(false)
    }
  }, [supabase])

  useEffect(() => {
    loadPending()
    loadApproved()
  }, [loadPending, loadApproved])

  const handleApprove = useCallback(
    async (item: PendingBusiness) => {
      setProcessingId(item.id)
      try {
        const { error } = await privilegedRpc(
          supabase,
          'admin.business.approve',
          'approve_business',
          { p_org_id: item.id },
          { action: 'business.approve', target_id: item.id }
        )
        if (error) throw error
        setPending((prev) => prev.filter((p) => p.id !== item.id))
        // The row moves from pending -> approved; refresh the approved list so it appears there.
        await loadApproved()
      } catch (err) {
        logger.error('admin.business.approve', err, { org_id: item.id, outcome: 'error' })
        setQueueError(`Approve failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      } finally {
        setProcessingId(null)
      }
    },
    [supabase, loadApproved]
  )

  const handleReject = useCallback(
    async (item: PendingBusiness) => {
      setProcessingId(item.id)
      try {
        const reason = reasons[item.id]?.trim() || null
        const { error } = await privilegedRpc(
          supabase,
          'admin.business.reject',
          'reject_business',
          { p_org_id: item.id, p_reason: reason },
          { action: 'business.reject', target_id: item.id }
        )
        if (error) throw error
        setPending((prev) => prev.filter((p) => p.id !== item.id))
      } catch (err) {
        logger.error('admin.business.reject', err, { org_id: item.id, outcome: 'error' })
        setQueueError(`Reject failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      } finally {
        setProcessingId(null)
      }
    },
    [supabase, reasons]
  )

  const startEdit = useCallback((item: Business) => {
    setApprovedError(null)
    setEditingId(item.id)
    setDraft(toDraft(item))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setDraft(null)
  }, [])

  const setDraftField = useCallback((key: keyof EditDraft, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }, [])

  // "Edit in admin" landing. The viewer lookup is the page's shared one (no extra RPC).
  const viewer = useAdminViewer(false)
  // The row a followed link opened: scrolled into view and its Name field focused once rendered.
  const [revealId, setRevealId] = useState<string | null>(null)
  // This tab claims ?focus=business:<uuid> (useAdminFocusSession) and, once the tier and the approved
  // list are known, writes found (that row opens in edit mode) or not_found; invalid / forbidden are
  // the shell's gate. The tab is shown to resource admins, but only a platform admin can save a
  // business: for anyone else the link is not_found with a plain "only platform admins" line.
  const focusSession = useAdminFocusSession('business', 'businesses')
  const [focusNotice, setFocusNotice] = useState<AdminFocusNotice | null>(null)
  useEffect(() => {
    if (!focusSession?.isOpen() || viewer.status === 'loading' || loadingApproved) return
    const editable = viewer.status === 'ready' && canEditBusinesses(viewer.tier)
    const item = editable ? approved.find((b) => b.id.toLowerCase() === focusSession.focus.id) : undefined
    if (item) {
      focusSession.resolve('found')
      startEdit(item)
      setRevealId(item.id)
    } else {
      focusSession.resolve('not_found')
      setFocusNotice(editable ? 'not_found' : 'not_editable')
    }
  }, [focusSession, viewer, loadingApproved, approved, startEdit])
  useEffect(() => {
    // Waits for the row to be on screen (the pending queue's first load hides both sections).
    const field = revealId && !loading ? document.getElementById(`edit-name-${revealId}`) : null
    if (!field) return
    field.scrollIntoView({ block: 'center' })
    field.focus({ preventScroll: true })
    setRevealId(null)
  }, [revealId, loading])

  const handleSaveEdit = useCallback(
    async (item: Business) => {
      if (!draft || !draft.name.trim() || savingId) return
      setSavingId(item.id)
      setApprovedError(null)
      try {
        const fields: AdminBusinessEdit = {
          name: draft.name,
          description: draft.description,
          phone: draft.phone,
          email: draft.email,
          website: draft.website,
        }
        await adminUpdateBusiness(supabase, item.id, fields)
        setEditingId(null)
        setDraft(null)
        await loadApproved()
      } catch (err) {
        logger.error('admin.business.update', err, { org_id: item.id, outcome: 'error' })
        setApprovedError(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      } finally {
        setSavingId(null)
      }
    },
    [supabase, draft, savingId, loadApproved]
  )

  const handleToggleActive = useCallback(
    async (item: AdminBusiness) => {
      const next = !item.is_active
      setTogglingId(item.id)
      setApprovedError(null)
      // Truthful optimistic toggle: flip is_active in place (badge + button update, the row STAYS in
      // the list so both directions stay visible), then AWAIT the persist and revert on failure. The
      // admin reader projects is_active, so the flipped state is what a later refetch would show too.
      setApproved((prev) => prev.map((b) => (b.id === item.id ? { ...b, is_active: next } : b)))
      try {
        await adminSetBusinessActive(supabase, item.id, next)
      } catch (err) {
        setApproved((prev) => prev.map((b) => (b.id === item.id ? { ...b, is_active: item.is_active } : b)))
        logger.error('admin.business.set_active', err, { org_id: item.id, active: next, outcome: 'error' })
        setApprovedError(
          `${next ? 'Reactivate' : 'Deactivate'} failed: ${err instanceof Error ? err.message : 'unknown error'}`
        )
      } finally {
        setTogglingId(null)
      }
    },
    [supabase]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-stone-600">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Section 1 — pending queue (unchanged behavior). */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[#4a5d23]">Awaiting review</h3>
        {queueError && (
          <div role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
            {queueError}
          </div>
        )}

        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
            No businesses awaiting review.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => {
              const isProcessing = processingId === item.id
              const addr = [item.address, item.city, item.state].filter(Boolean).join(', ')
              return (
                <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
                      <Leaf className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-stone-800">{item.name}</h4>
                      {item.description && (
                        <p className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                        {addr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {addr}
                          </span>
                        )}
                        {item.phone && <span>{item.phone}</span>}
                        {item.website && <span className="truncate">{item.website}</span>}
                      </div>
                      <div className="mt-1">
                        {/* fetchPendingBusinesses returns status='pending' rows: members cannot see them yet. */}
                        <MemberViewLink
                          to={{ kind: 'business', id: item.id }}
                          visibility={businessVisibility({ status: 'pending', is_active: true })}
                          label="View public page"
                          itemName={item.name}
                          source="businesses"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                    <label htmlFor={`reason-${item.id}`} className="sr-only">
                      Rejection reason for {item.name}
                    </label>
                    <input
                      id={`reason-${item.id}`}
                      value={reasons[item.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder="Optional reason (shown to submitter on reject)"
                      className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500"
                      disabled={isProcessing}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                        onClick={() => void handleApprove(item)}
                        disabled={isProcessing}
                        aria-label={`Approve ${item.name}`}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8 text-xs"
                        onClick={() => void handleReject(item)}
                        disabled={isProcessing}
                        aria-label={`Reject ${item.name}`}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Section 2 — approved businesses (edit / deactivate). */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[#4a5d23]">
          Approved businesses {!loadingApproved && `(${approved.length})`}
        </h3>
        {approvedError && (
          <div role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
            {approvedError}
          </div>
        )}
        <AdminFocusNoticeLine notice={focusNotice} kind="business" onDismiss={() => setFocusNotice(null)} />

        {loadingApproved ? (
          <div className="flex items-center gap-2 py-6 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : approved.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
            No approved businesses yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {approved.map((item) => {
              const isEditing = editingId === item.id
              const isSaving = savingId === item.id
              const isToggling = togglingId === item.id
              const addr = [item.address, item.city, item.state].filter(Boolean).join(', ')
              return (
                <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
                      <Leaf className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-stone-800">{item.name}</h4>
                      {item.description && (
                        <p className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                        {addr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {addr}
                          </span>
                        )}
                        {item.phone && <span>{item.phone}</span>}
                        {item.website && <span className="truncate">{item.website}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {/* fetchAdminBusinessList returns status='approved' rows only. */}
                        <MemberViewLink
                          to={{ kind: 'business', id: item.id }}
                          visibility={businessVisibility({ status: 'approved', is_active: item.is_active })}
                          label="View public page"
                          itemName={item.name}
                          source="businesses"
                        />
                        {/* Its pin on the members' map (businesses_in_bounds also needs a location). */}
                        <BusinessMapLink item={item} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className={
                          item.is_active
                            ? 'text-xs text-[#4a5d23] border-[#4a5d23]/30'
                            : 'text-xs text-stone-500 border-stone-300'
                        }
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {!isEditing && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            disabled={isToggling}
                            className="text-[#4a5d23] hover:text-[#3d4d1c] text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(item)}
                            disabled={isToggling}
                            className={
                              item.is_active
                                ? 'text-red-500 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50'
                                : 'text-[#4a5d23] hover:text-[#3d4d1c] text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50'
                            }
                            aria-label={`${item.is_active ? 'Deactivate' : 'Reactivate'} ${item.name}`}
                          >
                            {isToggling ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : item.is_active ? (
                              <X className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            {item.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form — the business's own descriptive + contact fields. */}
                  {isEditing && draft && (
                    <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <label htmlFor={`edit-name-${item.id}`} className="text-stone-700 text-xs font-medium">
                            Name
                          </label>
                          <Input
                            id={`edit-name-${item.id}`}
                            value={draft.name}
                            onChange={(e) => setDraftField('name', e.target.value)}
                            placeholder="Business name"
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label htmlFor={`edit-desc-${item.id}`} className="text-stone-700 text-xs font-medium">
                            Description
                          </label>
                          <Textarea
                            id={`edit-desc-${item.id}`}
                            value={draft.description}
                            onChange={(e) => setDraftField('description', e.target.value)}
                            placeholder="Optional description"
                            rows={2}
                            className={`${inputClass} resize-none`}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor={`edit-phone-${item.id}`} className="text-stone-700 text-xs font-medium">
                            Phone
                          </label>
                          <Input
                            id={`edit-phone-${item.id}`}
                            value={draft.phone}
                            onChange={(e) => setDraftField('phone', e.target.value)}
                            placeholder="Phone"
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor={`edit-email-${item.id}`} className="text-stone-700 text-xs font-medium">
                            Email
                          </label>
                          <Input
                            id={`edit-email-${item.id}`}
                            value={draft.email}
                            onChange={(e) => setDraftField('email', e.target.value)}
                            placeholder="Email"
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label htmlFor={`edit-website-${item.id}`} className="text-stone-700 text-xs font-medium">
                            Website
                          </label>
                          <Input
                            id={`edit-website-${item.id}`}
                            value={draft.website}
                            onChange={(e) => setDraftField('website', e.target.value)}
                            placeholder="https://…"
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white h-8 text-xs"
                          onClick={() => void handleSaveEdit(item)}
                          disabled={isSaving || !draft.name.trim()}
                        >
                          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/** An approved business row's "View on map": its pin on the members' map, or why it has none — not
 *  repeated when it is the reason the row already shows for the public page (inactive). */
function BusinessMapLink({ item }: { item: AdminBusiness }) {
  const page = businessVisibility({ status: 'approved', is_active: item.is_active })
  const map = businessMapVisibility({
    status: 'approved',
    is_active: item.is_active,
    has_map_location: isMapPoint(parseGeographyPoint(item.location)),
  })
  if (!showsMapControl(page, map)) return null
  return (
    <MemberViewLink
      to={{ kind: 'map_focus', focus: { kind: 'business', id: item.id } }}
      visibility={map}
      label={adminNavT('en', 'viewOnMap')}
      itemName={item.name}
      source="businesses"
    />
  )
}
