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
//
// P6 W4: the admin's language throughout (lib/i18n-admin-resources.ts; Active / Edit / Deactivate
// and the toggle lines are the Organizations tab's, lib/i18n-org-forms.ts). Business names,
// descriptions and addresses keep their own (lang="" dir="auto"). A failure shows a translated line,
// never the server's text (the data layer's withMetric / logger.error rows already record it). Each
// result is announced in an always-mounted status line; when a row or a button leaves, focus moves
// to the next row (else the section heading) or to the control that replaces it; a busy button is
// aria-disabled, so it keeps focus.

import { useCallback, useEffect, useRef, useState } from 'react'
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
  BUSINESS_NOT_SAVED_MESSAGE,
  fetchPendingBusinesses,
  fetchAdminBusinessList,
  adminSetBusinessActive,
  adminUpdateBusiness,
  type PendingBusiness,
  type AdminBusiness,
  type AdminBusinessEdit,
} from '@/lib/business-data'
import type { Business } from '@/lib/business'
import { useAdminTier } from '@/hooks/use-admin-tier'
import { canEditBusinesses } from '@/lib/admin-tier'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { orgFormT } from '@/lib/i18n-org-forms'
import { adminResourcesT, namedControl } from '@/lib/i18n-admin-resources'
import { DESTRUCTIVE_BUTTON_CLASS } from './post-moderation-actions'
import { useAdminFocusSession } from './use-admin-focus'
import { AdminFocusNoticeLine, type AdminFocusNotice } from './admin-focus-notice'
import { AnnouncementText, NO_ANNOUNCEMENT, afterLayout, announce, focusAfterRowRemoval, type Announcement } from './row-focus'

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

const inputClass = 'text-stone-900 placeholder:text-stone-500'
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-1'
const HEADING = `rounded-sm text-base font-semibold text-[#4a5d23] ${FOCUS_RING}`
/** Stable element ids focus returns to. */
export const pendingApproveId = (id: string) => `business-approve-${id}`
export const editButtonId = (id: string) => `business-edit-${id}`

export function BusinessesTab({ locale }: { locale: Locale }) {
  const supabase = createClient()
  const t = (key: Parameters<typeof adminResourcesT>[1]) => adminResourcesT(locale, key)
  const tr = (key: Parameters<typeof orgFormT>[1]) => orgFormT(locale, key)

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
  // Rows whose Deactivate / Reactivate is running: each row blocks only its own second press.
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(() => new Set())

  // The result of the last action (always mounted, so each one is announced).
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const pendingHeading = useRef<HTMLHeadingElement | null>(null)
  const approvedHeading = useRef<HTMLHeadingElement | null>(null)
  // Where focus goes once the list it waits for has re-rendered (an element id, or the heading).
  const pendingFocus = useRef<{ id: string | null } | null>(null)
  const approvedFocus = useRef<{ id: string } | null>(null)

  const loadPending = useCallback(async () => {
    setLoading(true)
    setQueueError(null)
    try {
      setPending(await fetchPendingBusinesses(supabase))
    } catch {
      // business.pending.fetch (withMetric) has recorded the failure with its error class.
      setQueueError(adminResourcesT(locale, 'pendingLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [supabase, locale])

  const loadApproved = useCallback(async () => {
    setLoadingApproved(true)
    setApprovedError(null)
    try {
      setApproved(await fetchAdminBusinessList(supabase))
    } catch {
      // business.admin.list.fetch (withMetric) has recorded the failure with its error class.
      setApprovedError(adminResourcesT(locale, 'approvedLoadFailed'))
    } finally {
      setLoadingApproved(false)
    }
  }, [supabase, locale])

  useEffect(() => {
    loadPending()
    loadApproved()
    // The first load only; actions reload explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    afterLayout(() => {
      const node = target.id ? document.getElementById(pendingApproveId(target.id)) : null
      ;(node ?? pendingHeading.current)?.focus()
    })
  }, [pending])

  useEffect(() => {
    const target = approvedFocus.current
    if (!target || loadingApproved) return
    approvedFocus.current = null
    afterLayout(() => {
      ;(document.getElementById(editButtonId(target.id)) ?? approvedHeading.current)?.focus()
    })
  }, [approved, loadingApproved, editingId])

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
        pendingFocus.current = { id: focusAfterRowRemoval(pending.map((p) => p.id), item.id) }
        announce(setStatus, formatMessage(adminResourcesT(locale, 'approvedStatus'), { name: isolate(item.name) }))
        setPending((prev) => prev.filter((p) => p.id !== item.id))
        // The row moves from pending -> approved; refresh the approved list so it appears there.
        await loadApproved()
      } catch (err) {
        logger.error('admin.business.approve', err, { org_id: item.id, outcome: 'error' })
        setQueueError(formatMessage(adminResourcesT(locale, 'businessApproveFailed'), { name: isolate(item.name) }))
      } finally {
        setProcessingId(null)
      }
    },
    [supabase, loadApproved, pending, locale]
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
        pendingFocus.current = { id: focusAfterRowRemoval(pending.map((p) => p.id), item.id) }
        announce(setStatus, formatMessage(adminResourcesT(locale, 'rejectedStatus'), { name: isolate(item.name) }))
        setPending((prev) => prev.filter((p) => p.id !== item.id))
      } catch (err) {
        logger.error('admin.business.reject', err, { org_id: item.id, outcome: 'error' })
        setQueueError(formatMessage(adminResourcesT(locale, 'businessRejectFailed'), { name: isolate(item.name) }))
      } finally {
        setProcessingId(null)
      }
    },
    [supabase, reasons, pending, locale]
  )

  // The row a followed link opened, or whose Edit was pressed: scrolled into view and its Name field
  // focused once rendered (Edit itself leaves while the form is open).
  const [revealId, setRevealId] = useState<string | null>(null)

  const startEdit = useCallback((item: Business) => {
    setApprovedError(null)
    setEditingId(item.id)
    setDraft(toDraft(item))
  }, [])

  const cancelEdit = useCallback(() => {
    // Cancel leaves with the form: focus returns to the row's Edit button.
    if (editingId) approvedFocus.current = { id: editingId }
    setEditingId(null)
    setDraft(null)
  }, [editingId])

  const setDraftField = useCallback((key: keyof EditDraft, value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }, [])

  // "Edit in admin" landing. The tier is the shell's shared lookup (useAdminTier: no extra RPC).
  const { tier, loading: tierLoading } = useAdminTier()
  // This tab claims ?focus=business:<uuid> (useAdminFocusSession) and, once the tier and the approved
  // list are known, writes found (that row opens in edit mode) or not_found; invalid / forbidden are
  // the shell's gate. The tab is shown to resource admins, but only a platform admin can save a
  // business: for anyone else the link is not_found with a plain "only platform admins" line.
  const focusSession = useAdminFocusSession('business', 'businesses')
  const [focusNotice, setFocusNotice] = useState<AdminFocusNotice | null>(null)
  useEffect(() => {
    if (!focusSession?.isOpen() || tierLoading || loadingApproved) return
    const editable = canEditBusinesses(tier)
    const item = editable ? approved.find((b) => b.id.toLowerCase() === focusSession.focus.id) : undefined
    if (item) {
      focusSession.resolve('found')
      startEdit(item)
      setRevealId(item.id)
    } else {
      focusSession.resolve('not_found')
      setFocusNotice(editable ? 'not_found' : 'not_editable')
    }
  }, [focusSession, tier, tierLoading, loadingApproved, approved, startEdit])
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
        // The form and the list leave while the list reloads: hold focus on the section heading,
        // then return it to the row's Edit button.
        approvedHeading.current?.focus()
        approvedFocus.current = { id: item.id }
        announce(setStatus, formatMessage(orgFormT(locale, 'savedUpdated'), { name: isolate(draft.name.trim()) }))
        setEditingId(null)
        setDraft(null)
        await loadApproved()
      } catch (err) {
        logger.error('admin.business.update', err, { org_id: item.id, outcome: 'error' })
        const notSaved = err instanceof Error && err.message === BUSINESS_NOT_SAVED_MESSAGE
        setApprovedError(
          notSaved
            ? adminResourcesT(locale, 'businessNotSaved')
            : formatMessage(adminResourcesT(locale, 'businessSaveFailed'), { name: isolate(item.name) })
        )
      } finally {
        setSavingId(null)
      }
    },
    [supabase, draft, savingId, loadApproved, locale]
  )

  const handleToggleActive = useCallback(
    async (item: AdminBusiness) => {
      if (togglingIds.has(item.id)) return
      const next = !item.is_active
      setTogglingIds((ids) => new Set(ids).add(item.id))
      setApprovedError(null)
      // Truthful optimistic toggle: flip is_active in place (badge + button update, the row STAYS in
      // the list so both directions stay visible), then AWAIT the persist and revert on failure. The
      // admin reader projects is_active, so the flipped state is what a later refetch would show too.
      setApproved((prev) => prev.map((b) => (b.id === item.id ? { ...b, is_active: next } : b)))
      try {
        await adminSetBusinessActive(supabase, item.id, next)
        announce(setStatus, formatMessage(orgFormT(locale, next ? 'orgReactivated' : 'orgDeactivated'), { name: isolate(item.name) }))
      } catch (err) {
        setApproved((prev) => prev.map((b) => (b.id === item.id ? { ...b, is_active: item.is_active } : b)))
        logger.error('admin.business.set_active', err, { org_id: item.id, active: next, outcome: 'error' })
        setApprovedError(formatMessage(orgFormT(locale, 'toggleFailed'), { name: isolate(item.name) }))
      } finally {
        setTogglingIds((ids) => {
          const left = new Set(ids)
          left.delete(item.id)
          return left
        })
      }
    },
    [supabase, togglingIds, locale]
  )

  // "Edit in admin" link that opened nothing, and the action result line. Rendered from the first
  // render — through the loading spinner too — so their live regions exist before a notice arrives
  // and are announced. Both returns put them first inside the same root <div>, so React keeps the
  // same DOM nodes when loading ends.
  const liveLines = (
    <>
      <AdminFocusNoticeLine notice={focusNotice} kind="business" locale={locale} onDismiss={() => setFocusNotice(null)} />
      <p role="status" data-testid="businesses-status" className="sr-only"><AnnouncementText announcement={status} /></p>
    </>
  )

  if (loading) {
    return (
      <div className="space-y-8" lang={locale} dir={dir(locale)}>
        {liveLines}
        <div className="flex items-center justify-center py-12 text-stone-600">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8" lang={locale} dir={dir(locale)}>
      {liveLines}
      {/* Section 1 — pending queue (unchanged behavior). */}
      <div className="space-y-3">
        <h3 ref={pendingHeading} tabIndex={-1} className={HEADING}>{t('awaitingTitle')}</h3>
        <div role="alert" data-testid="businesses-queue-alert" className={queueError ? 'rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800' : 'sr-only'}>
          {queueError ?? ''}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-600">
            {t('noPending')}
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => {
              const isProcessing = processingId === item.id
              const busy = isProcessing
              const addr = [item.address, item.city, item.state].filter(Boolean).join(', ')
              const titleId = `pending-title-${item.id}`
              return (
                <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-800">
                      <Leaf className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 id={titleId} lang="" dir="auto" className="font-semibold text-stone-800">{item.name}</h4>
                      {item.description && (
                        <p lang="" dir="auto" className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600">
                        {addr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            <span lang="" dir="auto">{addr}</span>
                          </span>
                        )}
                        {item.phone && <span dir="ltr">{item.phone}</span>}
                        {item.website && <span dir="ltr" className="truncate">{item.website}</span>}
                      </div>
                      <div className="mt-1">
                        {/* fetchPendingBusinesses returns status='pending' rows: members cannot see them yet. */}
                        <MemberViewLink
                          to={{ kind: 'business', id: item.id }}
                          visibility={businessVisibility({ status: 'pending', is_active: true })}
                          label={tr('actionViewPublic')}
                          locale={locale}
                          itemName={item.name}
                          source="businesses"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                    <label htmlFor={`reason-${item.id}`} className="block text-xs font-medium text-stone-700">
                      {t('rejectReasonLabel')}
                    </label>
                    <input
                      id={`reason-${item.id}`}
                      aria-describedby={titleId}
                      value={reasons[item.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                      dir="auto"
                      className="w-full rounded-lg border border-stone-500 bg-white px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700"
                      disabled={isProcessing}
                    />
                    {/* aria-disabled while an action runs (not disabled): the pressed button keeps focus. */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        id={pendingApproveId(item.id)}
                        size="sm"
                        className="flex-1 bg-green-700 hover:bg-green-800 text-white h-8 text-xs"
                        onClick={() => { if (!busy) void handleApprove(item) }}
                        aria-disabled={busy || undefined}
                        aria-label={namedControl(t('approve'), item.name)}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                        )}
                        {t('approve')}
                      </Button>
                      <Button
                        size="sm"
                        className={`flex-1 h-8 text-xs ${DESTRUCTIVE_BUTTON_CLASS}`}
                        onClick={() => { if (!busy) void handleReject(item) }}
                        aria-disabled={busy || undefined}
                        aria-label={namedControl(t('reject'), item.name)}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                        )}
                        {t('reject')}
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
        <h3 ref={approvedHeading} tabIndex={-1} className={HEADING}>
          {loadingApproved
            ? t('approvedBusinessesTitle')
            : formatMessage(t('approvedBusinessesCount'), { count: formatCount(approved.length, locale) })}
        </h3>
        <div role="alert" data-testid="businesses-approved-alert" className={approvedError ? 'rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800' : 'sr-only'}>
          {approvedError ?? ''}
        </div>

        {loadingApproved ? (
          <div className="flex items-center gap-2 py-6 text-sm text-stone-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('loading')}
          </div>
        ) : approved.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-600">
            {t('noApproved')}
          </div>
        ) : (
          <ul className="space-y-3">
            {approved.map((item) => {
              const isEditing = editingId === item.id
              const isSaving = savingId === item.id
              const isToggling = togglingIds.has(item.id)
              const addr = [item.address, item.city, item.state].filter(Boolean).join(', ')
              return (
                <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-800">
                      <Leaf className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 id={`business-title-${item.id}`} lang="" dir="auto" className="font-semibold text-stone-800">{item.name}</h4>
                      {item.description && (
                        <p lang="" dir="auto" className="mt-0.5 text-sm text-stone-600">{item.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600">
                        {addr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            <span lang="" dir="auto">{addr}</span>
                          </span>
                        )}
                        {item.phone && <span dir="ltr">{item.phone}</span>}
                        {item.website && <span dir="ltr" className="truncate">{item.website}</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {/* fetchAdminBusinessList returns status='approved' rows only. */}
                        <MemberViewLink
                          to={{ kind: 'business', id: item.id }}
                          visibility={businessVisibility({ status: 'approved', is_active: item.is_active })}
                          label={tr('actionViewPublic')}
                          locale={locale}
                          itemName={item.name}
                          source="businesses"
                        />
                        {/* Its pin on the members' map (businesses_in_bounds also needs a location). */}
                        <BusinessMapLink item={item} locale={locale} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        className={
                          item.is_active
                            ? 'text-xs text-[#4a5d23] border-[#4a5d23]'
                            : 'text-xs text-stone-600 border-stone-500'
                        }
                      >
                        {tr(item.is_active ? 'statusActive' : 'statusInactive')}
                      </Badge>
                      {!isEditing && (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            id={editButtonId(item.id)}
                            onClick={() => {
                              if (isToggling) return
                              startEdit(item)
                              // Edit leaves while the form is open: focus its Name field.
                              setRevealId(item.id)
                            }}
                            aria-disabled={isToggling || undefined}
                            className={`min-h-6 rounded-sm text-[#4a5d23] hover:text-[#3d4d1c] text-xs font-medium inline-flex items-center gap-1 ${FOCUS_RING}`}
                            aria-label={namedControl(tr('actionEdit'), item.name)}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" /> {tr('actionEdit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(item)}
                            aria-disabled={isToggling || undefined}
                            className={
                              (item.is_active
                                ? 'text-red-700 hover:text-red-800'
                                : 'text-[#4a5d23] hover:text-[#3d4d1c]') +
                              ` min-h-6 rounded-sm text-xs font-medium inline-flex items-center gap-1 ${FOCUS_RING}`
                            }
                            aria-label={namedControl(tr(item.is_active ? 'actionDeactivate' : 'actionReactivate'), item.name)}
                          >
                            {isToggling ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : item.is_active ? (
                              <X className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Check className="h-3 w-3" aria-hidden="true" />
                            )}
                            {tr(item.is_active ? 'actionDeactivate' : 'actionReactivate')}
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
                            {t('fieldName')} <span>({t('required')})</span>
                          </label>
                          <Input
                            id={`edit-name-${item.id}`}
                            // Names the business being edited when this field takes focus (a followed link focuses it).
                            aria-describedby={`business-title-${item.id}`}
                            required
                            aria-required="true"
                            value={draft.name}
                            onChange={(e) => setDraftField('name', e.target.value)}
                            lang=""
                            dir="auto"
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label htmlFor={`edit-desc-${item.id}`} className="text-stone-700 text-xs font-medium">
                            {t('fieldDescription')}
                          </label>
                          <Textarea
                            id={`edit-desc-${item.id}`}
                            value={draft.description}
                            onChange={(e) => setDraftField('description', e.target.value)}
                            rows={2}
                            lang=""
                            dir="auto"
                            className={`${inputClass} resize-none`}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor={`edit-phone-${item.id}`} className="text-stone-700 text-xs font-medium">
                            {t('fieldPhone')}
                          </label>
                          <Input
                            id={`edit-phone-${item.id}`}
                            type="tel"
                            dir="ltr"
                            value={draft.phone}
                            onChange={(e) => setDraftField('phone', e.target.value)}
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor={`edit-email-${item.id}`} className="text-stone-700 text-xs font-medium">
                            {t('fieldEmail')}
                          </label>
                          <Input
                            id={`edit-email-${item.id}`}
                            dir="ltr"
                            value={draft.email}
                            onChange={(e) => setDraftField('email', e.target.value)}
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label htmlFor={`edit-website-${item.id}`} className="text-stone-700 text-xs font-medium">
                            {t('fieldWebsite')}
                          </label>
                          <Input
                            id={`edit-website-${item.id}`}
                            dir="ltr"
                            value={draft.website}
                            onChange={(e) => setDraftField('website', e.target.value)}
                            placeholder="https://…"
                            className={inputClass}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                      {/* aria-disabled (not disabled): a pressed Save keeps focus while it runs. */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className={
                            draft.name.trim()
                              ? 'bg-[#4a5d23] hover:bg-[#3d4d1c] text-white h-8 text-xs'
                              : 'bg-stone-200 text-stone-700 hover:bg-stone-200 h-8 text-xs'
                          }
                          onClick={() => void handleSaveEdit(item)}
                          aria-disabled={isSaving || !draft.name.trim() || undefined}
                        >
                          {isSaving ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{t('saving')}</>
                          ) : (
                            t('save')
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-stone-500 text-xs"
                          onClick={() => { if (!isSaving) cancelEdit() }}
                          aria-disabled={isSaving || undefined}
                        >
                          {t('cancel')}
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
function BusinessMapLink({ item, locale }: { item: AdminBusiness; locale: Locale }) {
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
      label={adminNavT(locale, 'viewOnMap')}
      locale={locale}
      itemName={item.name}
      source="businesses"
    />
  )
}
