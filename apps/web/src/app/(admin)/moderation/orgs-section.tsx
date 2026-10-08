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
// organization admin page, read-only there for organization admins.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ExternalLink, LayoutDashboard, Loader2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
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
import { memberReasonText } from '@/lib/i18n-admin-nav'
import { organizationVisibility } from '@/lib/member-visibility'
import { orgFormT, formatMessage, type OrgFormMessages } from '@/lib/i18n-org-forms'
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
                      <OrgMembers orgId={org.id} />
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
  org: Pick<AdminOrgListRow, 'id' | 'name' | 'is_active'>
  tr: (key: keyof OrgFormMessages) => string
  locale: Locale
  onToggle: () => void
}) {
  const visibility = organizationVisibility(org)
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
        // Where the link would be: why members cannot open this org's public page. Not `disabled` —
        // Radix skips disabled items with the arrow keys. aria-disabled survives because Radix spreads
        // the item's own props after its defaults (@radix-ui/react-menu 2.1.18 MenuItemImpl).
        <Menu.Item className={MENU_REASON} aria-disabled="true" onSelect={(e) => e.preventDefault()}>
          {memberReasonText(locale, visibility.reason)}
        </Menu.Item>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Membership roster: a row expansion here, and the Members tab of the organization admin page.
// Every read and write is filtered by orgId (org-members-data.ts). readOnly (organization admins)
// shows the roster without the add / role / remove controls; the database refuses those writes
// for anyone but a platform admin either way.
// ---------------------------------------------------------------------------------------------

export function OrgMembers({ orgId, readOnly = false }: { orgId: string; readOnly?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<MemberRole>('member')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      setMembers(await fetchOrgMembers(supabase, orgId))
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load members.')
    } finally {
      setLoadingMembers(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const handleAddMember = useCallback(async () => {
    if (readOnly || !addUserId.trim()) return
    setAddingMember(true)
    setAddMemberError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const err = await addOrgMember(supabase, orgId, addUserId.trim(), addRole, user?.id ?? null)
      if (err) {
        setAddMemberError(err)
      } else {
        setAddUserId('')
        setAddRole('member')
        await fetchMembers()
      }
    } finally {
      setAddingMember(false)
    }
  }, [readOnly, supabase, orgId, addUserId, addRole, fetchMembers])

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (readOnly) return
      setRosterError(null)
      const err = await removeOrgMember(supabase, orgId, memberId)
      if (err) {
        setRosterError(err)
        return
      }
      await fetchMembers()
    },
    [readOnly, supabase, orgId, fetchMembers]
  )

  const handleChangeRole = useCallback(
    async (memberId: string, nextRole: MemberRole) => {
      if (readOnly) return
      setRosterError(null)
      const err = await changeOrgMemberRole(supabase, orgId, memberId, nextRole)
      if (err) {
        setRosterError(err)
        return
      }
      await fetchMembers()
    },
    [readOnly, supabase, orgId, fetchMembers]
  )

  return (
    <OrgMembersView
      members={members}
      loading={loadingMembers}
      loadError={loadError}
      rosterError={rosterError}
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
  members: OrgMember[]
  loading: boolean
  loadError: string | null
  rosterError: string | null
  readOnly: boolean
  add: { userId: string; role: MemberRole; adding: boolean; error: string | null }
  onAddUserIdChange: (v: string) => void
  onAddRoleChange: (v: MemberRole) => void
  onAdd: () => void
  onRemove: (memberId: string) => void
  onChangeRole: (memberId: string, role: MemberRole) => void
}

export function OrgMembersView(props: OrgMembersViewProps) {
  const { members, loading, loadError, rosterError, readOnly, add } = props
  return (
    // The roster is English-only for now; mark it so screen readers do not read it as the admin locale.
    <div lang="en" dir="ltr" className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      {!readOnly && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            value={add.userId}
            onChange={(e) => props.onAddUserIdChange(e.target.value)}
            placeholder="User UUID"
            aria-label="User UUID"
            className="w-64 text-sm text-stone-900 placeholder:text-stone-500"
          />
          <Select value={add.role} onValueChange={(v) => props.onAddRoleChange(v as MemberRole)}>
            <SelectTrigger className="w-28 text-sm text-stone-900" aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent lang="en">
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <button type="button" onClick={props.onAdd} disabled={add.adding || !add.userId.trim()} className={PRIMARY}>
            {add.adding ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      )}
      {add.error && (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {add.error}
        </p>
      )}
      {(rosterError || loadError) && (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {rosterError ?? loadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-stone-600">Loading members…</p>
      ) : loadError ? null : members.length === 0 ? (
        <p className="text-sm text-stone-600">No members yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-stone-600">User ID</th>
                <th className="px-3 py-2 text-start font-medium text-stone-600">Role</th>
                <th className="px-3 py-2 text-start font-medium text-stone-600">Joined</th>
                {!readOnly && (
                  <th className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs text-stone-700">{m.user_id}</td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-xs text-stone-800">{m.role === 'admin' ? 'Admin' : 'Member'}</span>
                    ) : (
                      <Select
                        value={m.role === 'admin' ? 'admin' : 'member'}
                        onValueChange={(v) => props.onChangeRole(m.id, v as MemberRole)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs text-stone-900" aria-label="Role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent lang="en">
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">{new Date(m.joined_at).toLocaleDateString()}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-end">
                      <button
                        type="button"
                        onClick={() => props.onRemove(m.id)}
                        aria-label={`Remove member ${m.user_id}`}
                        className={`inline-flex min-h-6 min-w-6 items-center gap-1 rounded px-1 text-xs font-medium text-red-700 hover:text-red-800 ${FOCUS_RING}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
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
