'use client'

// apps/web/src/app/(admin)/moderation/orgs-section.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Platform-admin Organizations tab: a list of every NON-business organization (active and
// inactive). "Create organization" (top right, and in the empty state) and each row's Edit open the
// setup panel, which the admin shell owns (it also serves the Overview quick action and deep
// links). Each row's menu offers Deactivate / Reactivate (confirmed, truthful optimistic toggle
// via admin_set_org_active, reverted on failure), Open admin and View public page (active orgs; an
// inactive org shows why members cannot see it instead). Each row's name links to that organization's admin page (/moderation/org/<id>). The
// membership roster stays available as a row expansion; OrgMembers is also the Members tab of the
// organization admin page, read-only there for organization admins. The roster reads in the
// admin's language (lib/i18n-org-admin.ts, P6 W4); a failure shows a sentence for its code and
// writes one admin.org.members_failed row (code + op, never text); each change is announced in an
// always-mounted status line, and Remove hands focus to the next row (else the add box).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ExternalLink, LayoutDashboard, Loader2, Map as MapIcon, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { DropdownMenu as Menu } from 'radix-ui'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { dir, type Locale } from '@/lib/i18n'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { adminNavT, memberReasonText } from '@/lib/i18n-admin-nav'
import { organizationMapVisibility, organizationVisibility, showsMapControl, type MemberVisibility } from '@/lib/member-visibility'
import { orgFormT, type OrgFormMessages } from '@/lib/i18n-org-forms'
import { formatMessage } from '@/lib/format-message'
import { orgAdminT, orgRoleLabel, type OrgAdminMessages } from '@/lib/i18n-org-admin'
import { namedControl } from '@/lib/i18n-admin-resources'
import { formatDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { logger } from '@/lib/logger'
import { failureCode } from '@/lib/failure-code'
import { afterLayout, announce, focusAfterRowRemoval } from './row-focus'
import { fetchAdminOrgList, type AdminOrgListRow } from '@/lib/org-data'
import { adminSetOrgActive } from '@/lib/org-admin-rpc'
import { orgTypeKey } from '@/components/org-form/org-labels'
import { orgAdminHref } from '@/lib/org-admin-paths'
import { finishToggle, guardBusyTrigger, startToggle } from './org-toggle-inflight'
import {
  addOrgMember,
  changeOrgMemberRole,
  fetchOrgMembers,
  removeOrgMember,
  type MemberRole,
  type OrgMember,
  type RosterFailure,
} from './org-members-data'

export interface OrgsSectionProps {
  locale: Locale
  onCreate: () => void
  onEdit: (orgId: string) => void
  /** Bumped by the shell after a save so the list reloads. */
  refreshKey: number
  /** "<name> was created/saved." after a save, announced politely. */
  notice: string | null
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const PRIMARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60 ' +
  FOCUS_RING
const SECONDARY =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-500 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-60 ' +
  FOCUS_RING
// The reason a "View public page" link is absent: a menu line arrow keys reach (so screen readers read
// it), announced as unavailable (aria-disabled), that does nothing when chosen.
const MENU_REASON =
  'flex min-h-9 select-none items-center rounded-md px-3 text-sm text-stone-600 outline-none data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-brand'
const MENU_ITEM =
  'flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 text-sm text-stone-800 outline-none data-[highlighted]:bg-stone-100 data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-brand'

type ConfirmTarget = { org: AdminOrgListRow; next: boolean }

const moreButtonId = (orgId: string) => `more-${orgId}`

export function OrgsSection({ locale, onCreate, onEdit, refreshKey, notice }: OrgsSectionProps) {
  const supabase = useMemo(() => createClient(), [])
  const tr = useCallback((key: keyof OrgFormMessages) => orgFormT(locale, key), [locale])

  const [orgs, setOrgs] = useState<AdminOrgListRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  // A toggle result, shown until the shell posts a newer notice (e.g. after a save).
  const [toggleNotice, setToggleNotice] = useState<{ text: string; over: string | null } | null>(null)
  const noticeRef = useRef(notice)
  useEffect(() => {
    noticeRef.current = notice
  }, [notice])
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminOrgList(supabase).then(
      (rows) => {
        if (cancelled) return
        setOrgs(rows)
        setLoadState('ready')
      },
      () => {
        if (!cancelled) setLoadState('error')
      }
    )
    return () => {
      cancelled = true
    }
  }, [supabase, refreshKey, reload])

  // Truthful optimistic toggle: capture -> set -> await the RPC -> revert + explain on failure.
  const applyToggle = useCallback(
    async ({ org, next }: ConfirmTarget) => {
      setToggleError(null)
      setToggleNotice(null)
      setBusyIds((s) => startToggle(s, org.id))
      const previous = org.is_active
      setOrgs((rows) => rows.map((r) => (r.id === org.id ? { ...r, is_active: next } : r)))
      const res = await adminSetOrgActive(supabase, org.id, next)
      if (!res.ok) {
        setOrgs((rows) => rows.map((r) => (r.id === org.id ? { ...r, is_active: previous } : r)))
        setToggleError(formatMessage(tr('toggleFailed'), { name: org.name }))
      } else {
        setToggleNotice({ text: formatMessage(tr(next ? 'orgReactivated' : 'orgDeactivated'), { name: org.name }), over: noticeRef.current })
      }
      setBusyIds((s) => finishToggle(s, org.id))
    },
    [supabase, tr]
  )

  const header = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-stone-900">
          {loadState === 'ready' ? formatMessage(tr('listTitle'), { count: orgs.length }) : tr('listTitleLoading')}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{tr('listIntro')}</p>
      </div>
      <button type="button" className={PRIMARY} onClick={onCreate} data-org-create="">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {tr('createOrganization')}
      </button>
    </div>
  )

  return (
    <div dir={dir(locale)} lang={locale}>
      {header}
      <p aria-live="polite" className="mb-3 text-sm font-medium text-brand empty:hidden">
        {toggleNotice && toggleNotice.over === notice ? toggleNotice.text : notice}
      </p>
      {toggleError && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {toggleError}
        </p>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        {loadState === 'loading' ? (
          <p className="flex items-center gap-2 p-6 text-sm text-stone-600" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {tr('listLoading')}
          </p>
        ) : loadState === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-red-700">{tr('listError')}</p>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => {
                setLoadState('loading')
                setReload((n) => n + 1)
              }}
            >
              {tr('listRetry')}
            </button>
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-stone-900">{tr('listEmptyTitle')}</h3>
            <p className="max-w-sm text-sm text-stone-600">{tr('listEmptyBody')}</p>
            <button type="button" className={PRIMARY} onClick={onCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {tr('createOrganization')}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {orgs.map((org) => {
              const where = [org.city, org.state].filter(Boolean).join(', ')
              const expanded = expandedId === org.id
              return (
                <li key={org.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-stone-900">
                        <OrgNameLink org={org} tr={tr} />
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-org/10 px-2 py-0.5 font-medium text-org">{tr(orgTypeKey(org.org_type))}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            org.is_active ? 'bg-lime-100 text-lime-900' : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {org.is_active ? tr('statusActive') : tr('statusInactive')}
                        </span>
                        {where && <span className="text-stone-600">{where}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={SECONDARY}
                        onClick={() => onEdit(org.id)}
                        aria-label={formatMessage(tr('actionEditNamed'), { name: org.name })}
                      >
                        {tr('actionEdit')}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY}
                        aria-expanded={expanded}
                        aria-controls={expanded ? `members-${org.id}` : undefined}
                        aria-label={formatMessage(tr('actionMembersNamed'), { name: org.name })}
                        onClick={() => setExpandedId(expanded ? null : org.id)}
                      >
                        {tr('actionMembers')}
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      <Menu.Root dir={dir(locale)}>
                        <Menu.Trigger asChild>
                          <button
                            id={moreButtonId(org.id)}
                            type="button"
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-500 bg-white text-stone-700 hover:bg-stone-100 aria-disabled:cursor-not-allowed aria-disabled:text-stone-700/60 aria-disabled:border-stone-500/60 ${FOCUS_RING}`}
                            aria-label={formatMessage(tr('actionMore'), { name: org.name })}
                            aria-disabled={busyIds.has(org.id) || undefined}
                            // Stays focusable while the toggle runs; just does not open.
                            onPointerDown={(e) => guardBusyTrigger(busyIds, org.id, e)}
                            onKeyDown={(e) => guardBusyTrigger(busyIds, org.id, e)}
                          >
                            {busyIds.has(org.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </Menu.Trigger>
                        <Menu.Portal>
                          {/* Portaled under <body>, outside the lang wrapper: set lang here. Its dir
                              comes from Menu.Root. */}
                          <Menu.Content
                            lang={locale}
                            align="end"
                            sideOffset={4}
                            className="z-50 min-w-[12rem] rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
                          >
                            <OrgRowMenuItems org={org} tr={tr} locale={locale} onToggle={() => setConfirm({ org, next: !org.is_active })} />
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    </div>
                  </div>
                  {expanded && (
                    <div id={`members-${org.id}`} className="mt-3">
                      <OrgMembers orgId={org.id} locale={locale} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => (o ? undefined : setConfirm(null))}>
        {confirm && (
          <AlertDialogContent
            dir={dir(locale)}
            lang={locale}
            onCloseAutoFocus={(e) => {
              // Back to the row's More button (Radix would aim at the menu trigger it no longer tracks).
              e.preventDefault()
              document.getElementById(moreButtonId(confirm.org.id))?.focus()
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {formatMessage(tr(confirm.next ? 'reactivateTitle' : 'deactivateTitle'), { name: confirm.org.name })}
              </AlertDialogTitle>
              <AlertDialogDescription>{tr(confirm.next ? 'reactivateBody' : 'deactivateBody')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tr('confirmCancel')}</AlertDialogCancel>
              <AlertDialogAction
                className={confirm.next ? undefined : 'bg-red-700 hover:bg-red-800'}
                onClick={() => {
                  const target = confirm
                  setConfirm(null)
                  void applyToggle(target)
                }}
              >
                {tr(confirm.next ? 'actionReactivate' : 'actionDeactivate')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Row pieces, exported so the list wiring is testable without a DOM.
// ---------------------------------------------------------------------------------------------

/** The row's name: an underlined link to that organization's admin page ("<name> – admin page"). */
export function OrgNameLink({
  org,
  tr,
}: {
  org: Pick<AdminOrgListRow, 'id' | 'name'>
  tr: (key: keyof OrgFormMessages) => string
}) {
  return (
    <Link
      href={orgAdminHref(org.id)}
      className={`rounded-sm text-stone-900 underline decoration-stone-500 underline-offset-2 hover:decoration-stone-900 ${FOCUS_RING}`}
    >
      {org.name}
      <span className="sr-only">{` – ${tr('linkAdminPageSuffix')}`}</span>
    </Link>
  )
}

/** The row's More menu entries (rendered inside Menu.Content). */
export function OrgRowMenuItems({
  org,
  tr,
  locale,
  onToggle,
}: {
  org: Pick<AdminOrgListRow, 'id' | 'name' | 'is_active' | 'has_map_location'>
  tr: (key: keyof OrgFormMessages) => string
  locale: Locale
  onToggle: () => void
}) {
  const visibility = organizationVisibility(org)
  const mapVisibility = organizationMapVisibility(org)
  return (
    <>
      <Menu.Item className={MENU_ITEM} onSelect={onToggle}>
        {org.is_active ? tr('actionDeactivate') : tr('actionReactivate')}
      </Menu.Item>
      <Menu.Item className={MENU_ITEM} asChild>
        <Link href={orgAdminHref(org.id)}>
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          {tr('actionOpenAdmin')}
        </Link>
      </Menu.Item>
      {visibility.visible ? (
        <Menu.Item className={MENU_ITEM} asChild>
          <MemberViewLink
            locale={locale}
            to={{ kind: 'organization', id: org.id }}
            visibility={visibility}
            label={tr('actionViewPublic')}
            itemName={org.name}
            source="orgs_section"
            icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
            className={MENU_ITEM}
          />
        </Menu.Item>
      ) : (
        <MenuReason locale={locale} visibility={visibility} />
      )}
      {/* The org's pin on the members' map, or why it has none (inactive, no location). */}
      {mapVisibility.visible ? (
        <Menu.Item className={MENU_ITEM} asChild>
          <MemberViewLink
            locale={locale}
            to={{ kind: 'map_focus', focus: { kind: 'organization', id: org.id } }}
            visibility={mapVisibility}
            label={adminNavT(locale, 'viewOnMap')}
            itemName={org.name}
            source="orgs_section"
            icon={<MapIcon className="h-4 w-4" aria-hidden="true" />}
            className={MENU_ITEM}
          />
        </Menu.Item>
      ) : showsMapControl(visibility, mapVisibility) ? (
        <MenuReason locale={locale} visibility={mapVisibility} />
      ) : null}
    </>
  )
}

/** Where a "View …" link would be: why members cannot open it. Not `disabled` — Radix skips
 *  disabled items with the arrow keys. aria-disabled survives because Radix spreads the item's own
 *  props after its defaults (@radix-ui/react-menu 2.1.18 MenuItemImpl). */
function MenuReason({ locale, visibility }: { locale: Locale; visibility: Extract<MemberVisibility, { visible: false }> }) {
  return (
    <Menu.Item className={MENU_REASON} aria-disabled="true" onSelect={(e) => e.preventDefault()}>
      {memberReasonText(locale, visibility.reason)}
    </Menu.Item>
  )
}

// ---------------------------------------------------------------------------------------------
// Membership roster: a row expansion here, and the Members tab of the organization admin page.
// Every read and write is filtered by orgId (org-members-data.ts). readOnly (organization admins)
// shows the roster without the add / role / remove controls; the database refuses those writes
// for anyone but a platform admin either way.
// ---------------------------------------------------------------------------------------------

type RosterOp = 'load' | 'add' | 'remove' | 'role'

/** The sentence for a failed roster call, by its code. */
export function rosterFailureText(op: RosterOp, code: RosterFailure, locale: Locale): string {
  const key: keyof OrgAdminMessages =
    op === 'load'
      ? 'membersLoadFailed'
      : op === 'remove'
        ? 'removeFailed'
        : op === 'role'
          ? 'roleFailed'
          : code === '23505'
            ? 'addDuplicate'
            : code === '22P02'
              ? 'addInvalid'
              : code === '23503'
                ? 'addNoAccount'
                : 'addFailed'
  return orgAdminT(locale, key)
}

/** Ids the roster's focus moves use (one roster per organization on a page). */
export const rosterAddInputId = (orgId: string) => `roster-${orgId}-user-id`
export const rosterRemoveId = (orgId: string, memberId: string) => `roster-${orgId}-remove-${memberId}`
export const rosterRoleId = (orgId: string, memberId: string) => `roster-${orgId}-role-${memberId}`

export function OrgMembers({ orgId, readOnly = false, locale }: { orgId: string; readOnly?: boolean; locale: Locale }) {
  const supabase = useMemo(() => createClient(), [])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<MemberRole>('member')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  // The member whose Remove is running (a second press on that row does nothing).
  const [removingId, setRemovingId] = useState<string | null>(null)
  // After a role change: the row's role trigger, focused once the roster has re-rendered.
  const focusAfter = useRef<string | null>(null)

  const fail = useCallback(
    (op: RosterOp, code: RosterFailure) => {
      // No other row records a roster call: one row with its code (never a message).
      logger.warn('admin.org.members_failed', { op, code })
      return rosterFailureText(op, code, locale)
    },
    [locale]
  )

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      setMembers(await fetchOrgMembers(supabase, orgId))
      setLoadError(null)
    } catch (e) {
      setLoadError(fail('load', failureCode(e)))
    } finally {
      setLoadingMembers(false)
    }
  }, [supabase, orgId, fail])

  useEffect(() => {
    void fetchMembers()
    // The first load (and a new organization) only; writes re-read explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, orgId])

  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    afterLayout(() => document.getElementById(target)?.focus())
  }, [members])

  const handleAddMember = useCallback(async () => {
    if (readOnly || addingMember || !addUserId.trim()) return
    setAddingMember(true)
    setAddMemberError(null)
    // An earlier remove / role failure no longer applies once the admin acts again.
    setRosterError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const err = await addOrgMember(supabase, orgId, addUserId.trim(), addRole, user?.id ?? null)
      if (err) {
        setAddMemberError(fail('add', err))
      } else {
        setAddUserId('')
        setAddRole('member')
        announce(setStatus, orgAdminT(locale, 'memberAdded'))
        await fetchMembers()
      }
    } finally {
      setAddingMember(false)
    }
  }, [readOnly, addingMember, supabase, orgId, addUserId, addRole, fetchMembers, fail, locale])

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (readOnly || removingId === memberId) return
      setRemovingId(memberId)
      setRosterError(null)
      try {
        const err = await removeOrgMember(supabase, orgId, memberId)
        if (err) {
          setRosterError(fail('remove', err))
          return
        }
        // Move focus NOW, while its row is still on screen, to a control that stays (the next row's
        // Remove, else the add box): focus never passes through <body> when the row leaves.
        const next = focusAfterRowRemoval(members.map((m) => m.id), memberId)
        document.getElementById(next ? rosterRemoveId(orgId, next) : rosterAddInputId(orgId))?.focus()
        announce(setStatus, orgAdminT(locale, 'memberRemoved'))
        await fetchMembers()
      } finally {
        setRemovingId(null)
      }
    },
    [readOnly, removingId, supabase, orgId, fetchMembers, fail, members, locale]
  )

  const handleChangeRole = useCallback(
    async (memberId: string, nextRole: MemberRole) => {
      if (readOnly) return
      setRosterError(null)
      const err = await changeOrgMemberRole(supabase, orgId, memberId, nextRole)
      if (err) {
        setRosterError(fail('role', err))
        return
      }
      focusAfter.current = rosterRoleId(orgId, memberId)
      announce(setStatus, orgAdminT(locale, 'roleChanged'))
      await fetchMembers()
    },
    [readOnly, supabase, orgId, fetchMembers, fail, locale]
  )

  return (
    <OrgMembersView
      orgId={orgId}
      locale={locale}
      members={members}
      loading={loadingMembers}
      loadError={loadError}
      rosterError={rosterError}
      status={status}
      removingId={removingId}
      readOnly={readOnly}
      add={{ userId: addUserId, role: addRole, adding: addingMember, error: addMemberError }}
      onAddUserIdChange={setAddUserId}
      onAddRoleChange={setAddRole}
      onAdd={handleAddMember}
      onRemove={handleRemoveMember}
      onChangeRole={handleChangeRole}
    />
  )
}

export interface OrgMembersViewProps {
  orgId: string
  locale: Locale
  members: OrgMember[]
  loading: boolean
  /** Already in the admin's language (rosterFailureText). */
  loadError: string | null
  rosterError: string | null
  /** The last change's result, announced by an always-mounted status line. */
  status: string
  /** The member whose Remove is running, if any. */
  removingId?: string | null
  readOnly: boolean
  add: { userId: string; role: MemberRole; adding: boolean; error: string | null }
  onAddUserIdChange: (v: string) => void
  onAddRoleChange: (v: MemberRole) => void
  onAdd: () => void
  onRemove: (memberId: string) => void
  onChangeRole: (memberId: string, role: MemberRole) => void
}

export function OrgMembersView(props: OrgMembersViewProps) {
  const { orgId, locale, members, loading, loadError, rosterError, status, readOnly, add, removingId = null } = props
  const t = (key: keyof OrgAdminMessages) => orgAdminT(locale, key)
  const tz = browserTimeZone()
  const addId = rosterAddInputId(orgId)
  // Busy (adding) keeps its colours — the label says "Adding…"; empty (invalid) is a solid grey.
  const addInvalid = !add.userId.trim()
  const addDisabled = add.adding || addInvalid
  const alert = rosterError ?? loadError
  return (
    <div lang={locale} dir={dir(locale)} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={addId} className="text-xs font-medium text-stone-700">
              {t('userIdLabel')} <span>({orgFormT(locale, 'fieldRequired')})</span>
            </label>
            <Input
              id={addId}
              required
              aria-required="true"
              value={add.userId}
              onChange={(e) => props.onAddUserIdChange(e.target.value)}
              dir="ltr"
              className="w-64 max-w-full font-mono text-sm text-stone-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span id={`${addId}-role`} className="text-xs font-medium text-stone-700">{t('roleLabel')}</span>
            <Select value={add.role} onValueChange={(v) => props.onAddRoleChange(v as MemberRole)}>
              <SelectTrigger className="w-32 border-stone-500 text-sm text-stone-900" aria-labelledby={`${addId}-role`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent lang={locale} dir={dir(locale)}>
                <SelectItem value="member">{t('roleMember')}</SelectItem>
                <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* aria-disabled (not disabled): the pressed button keeps focus while the add runs. */}
          <button
            type="button"
            onClick={() => { if (!addDisabled) props.onAdd() }}
            aria-disabled={addDisabled || undefined}
            className={addInvalid ? `${PRIMARY} bg-stone-200 text-stone-700 hover:bg-stone-200` : PRIMARY}
          >
            {add.adding ? t('adding') : t('addMember')}
          </button>
        </div>
      )}
      {/* The add form's own alert, always mounted: an add failure is shown and announced even while
          an earlier roster line is on screen. */}
      {!readOnly && (
        <p role="alert" data-testid={`roster-add-alert-${orgId}`} className={add.error ? 'mb-2 text-xs text-red-700' : 'sr-only'}>
          {add.error ?? ''}
        </p>
      )}
      {/* Always mounted, so a change or a failure is announced when its line appears. */}
      <p role="status" data-testid={`roster-status-${orgId}`} className="sr-only">{status}</p>
      <p role="alert" data-testid={`roster-alert-${orgId}`} className={alert ? 'mb-2 text-xs text-red-700' : 'sr-only'}>
        {alert ?? ''}
      </p>

      {/* A re-read keeps the table on screen (so focus inside it survives); the loading line is only
          for a roster with nothing to show yet. */}
      {members.length === 0 ? (
        loading ? (
          <p className="text-sm text-stone-600">{t('membersLoading')}</p>
        ) : loadError ? null : (
          <p className="text-sm text-stone-600">{t('membersEmpty')}</p>
        )
      ) : (
        <div aria-busy={loading || undefined} className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-stone-600">{t('userIdLabel')}</th>
                <th className="px-3 py-2 text-start font-medium text-stone-600">{t('roleLabel')}</th>
                <th className="px-3 py-2 text-start font-medium text-stone-600">{t('colJoined')}</th>
                {!readOnly && (
                  <th className="px-3 py-2">
                    <span className="sr-only">{t('colActions')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td dir="ltr" className="max-w-[180px] truncate px-3 py-2 text-start font-mono text-xs text-stone-700">{m.user_id}</td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-xs text-stone-800">{orgRoleLabel(m.role, locale)}</span>
                    ) : (
                      <Select
                        value={m.role === 'admin' ? 'admin' : 'member'}
                        onValueChange={(v) => props.onChangeRole(m.id, v as MemberRole)}
                      >
                        <SelectTrigger id={rosterRoleId(orgId, m.id)} className="h-8 w-32 border-stone-500 text-xs text-stone-900" aria-label={namedControl(t('roleLabel'), m.user_id)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent lang={locale} dir={dir(locale)}>
                          <SelectItem value="member">{t('roleMember')}</SelectItem>
                          <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">{formatDate(m.joined_at, locale, tz)}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-end">
                      <button
                        type="button"
                        id={rosterRemoveId(orgId, m.id)}
                        onClick={() => { if (removingId !== m.id) props.onRemove(m.id) }}
                        aria-disabled={removingId === m.id || undefined}
                        aria-label={namedControl(t('remove'), m.user_id)}
                        className={`inline-flex min-h-6 min-w-6 items-center gap-1 rounded px-1 text-xs font-medium text-red-700 hover:text-red-800 ${FOCUS_RING}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" /> {t('remove')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
