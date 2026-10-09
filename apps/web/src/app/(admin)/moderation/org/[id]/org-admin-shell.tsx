'use client'

// apps/web/src/app/(admin)/moderation/org/[id]/org-admin-shell.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization admin page: the admin shell, scoped to ONE organization. The server page
// (./page.tsx) has already decided access with can_admin_org and hands this shell the org it may
// administer. Every tab is fed by that org id: Overview (this org's numbers), Events (its events),
// Profile (the setup panel in edit mode for this org only — no duplicate-name index, no "Edit
// existing" switch; the organization type is read-only for organization admins), Members (read-only
// for organization admins; platform admins keep add / role / remove). Deactivate / Reactivate stays
// in the platform Organizations list.
//
// Language: the root carries the viewer's lang/dir; the shell's own copy is English for now and is
// marked lang="en" dir="ltr" where it appears (same convention as the roster in orgs-section.tsx).
//
// The open tab is in the URL (`?tab=overview|events|profile|members`, replaced on each switch) so a
// reload or a shared link lands on the same tab; an unknown value opens Overview.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Calendar, ExternalLink, LayoutDashboard, Map as MapIcon, Pencil, Users } from 'lucide-react'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { organizationMapVisibility, organizationVisibility, showsMapControl } from '@/lib/member-visibility'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { dir, resolveUserLocale, type Locale } from '@/lib/i18n'
import { orgFormT, formatMessage } from '@/lib/i18n-org-forms'
import { ORG_ADMIN_INDEX } from '@/lib/org-admin-paths'
import { orgTypeKey } from '@/components/org-form/org-labels'
import { OrgFormPanel } from '@/components/org-form/org-form-panel'
import { restoreFocusAfterPanel } from '../../org-panel-focus'
import { ORG_ADMIN_TABS, readTabParam, tabParamHref, type OrgAdminTab } from '../../admin-tab-url'
import { OrgMembers } from '../../orgs-section'
import { OrgOverview } from '../org-overview'
import { OrgEventsTab } from './org-events-tab'
import { useAdminFocusGate } from '../../use-admin-focus'
import { orgPageOwnerTab } from '../../admin-focus-session'

export interface OrgAdminOrg {
  id: string
  name: string
  org_type: string
  is_active: boolean
  city: string | null
  state: string | null
  /** A point the members' map draws (location set, neither coordinate 0). */
  has_map_location: boolean
}

export interface OrgAdminShellProps {
  org: OrgAdminOrg
  /** Platform admins keep roster writes; organization admins see the roster read-only. */
  isPlatformAdmin: boolean
}

const TRIGGER_CLASS =
  'flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-brand data-[state=active]:text-white'
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const SECONDARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-500 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-100 ' +
  FOCUS_RING

export function OrgAdminShell({ org, isPlatformAdmin }: OrgAdminShellProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const locale: Locale = useMemo(
    () => (profile ? resolveUserLocale((profile as { preferred_language?: string | null }).preferred_language ?? null) : 'en'),
    [profile]
  )

  const [tab, setTab] = useState<OrgAdminTab>('overview')
  // Deep link: window.location exists only after mount, so setState in this effect is the idiom
  // (same as the admin shell's ?tab / ?org read).
  useEffect(() => {
    const requested = readTabParam(window.location.search, ORG_ADMIN_TABS)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (requested) setTab(requested)
  }, [])
  // "Edit in admin" (?focus=event:<id>) opens on the Events tab, which resolves it; any other focus
  // here is reported invalid (every tab is shown, so there is no forbidden case on this page).
  useAdminFocusGate(true, ORG_ADMIN_TABS, orgPageOwnerTab)
  const handleTabChange = useCallback((next: string) => {
    if (!(ORG_ADMIN_TABS as readonly string[]).includes(next)) return
    setTab(next as OrgAdminTab)
    window.history.replaceState(window.history.state, '', tabParamHref(window.location, next))
  }, [])

  const [panelOpen, setPanelOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)

  const handleSaved = useCallback(
    (result: { id: string; created: boolean; name: string }) => {
      setNotice(formatMessage(orgFormT(locale, 'savedUpdated'), { name: result.name }))
      setPanelOpen(false)
      // Re-run the server page so the header shows the saved name.
      router.refresh()
    },
    [locale, router]
  )

  const tr = (key: Parameters<typeof orgFormT>[1]) => orgFormT(locale, key)
  const where = [org.city, org.state].filter(Boolean).join(', ')
  const back = isPlatformAdmin
    ? { href: '/moderation?tab=organizations', label: 'All organizations' }
    : { href: ORG_ADMIN_INDEX, label: 'Your organizations' }

  return (
    <div className="min-h-screen bg-stone-100" lang={locale} dir={dir(locale)}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Link
          lang="en"
          dir="ltr"
          href={back.href}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 ${FOCUS_RING}`}
          aria-label={back.label}
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-stone-900 sm:text-base">{org.name}</h1>
          <p className="truncate text-xs text-stone-600">
            {[tr(orgTypeKey(org.org_type)), where, tr(org.is_active ? 'statusActive' : 'statusInactive')]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-2 py-4 sm:px-4">
        {/* Always rendered (no empty:hidden) so screen readers announce the saved notice. */}
        <p aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-brand">
          {notice}
        </p>
        <Tabs value={tab} onValueChange={handleTabChange}>
          <div className="-mx-2 overflow-x-auto px-2 pb-1">
            <TabsList
              lang="en"
              dir="ltr"
              aria-label="Organization admin sections"
              className="inline-flex w-auto min-w-full flex-nowrap gap-1 rounded-xl border border-stone-200 bg-white p-1">
              <TabsTrigger value="overview" className={TRIGGER_CLASS}>
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="events" className={TRIGGER_CLASS}>
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                Events
              </TabsTrigger>
              <TabsTrigger value="profile" className={TRIGGER_CLASS}>
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="members" className={TRIGGER_CLASS}>
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Members
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <OrgOverview orgId={org.id} />
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <OrgEventsTab orgId={org.id} />
          </TabsContent>
          <TabsContent value="profile" className="mt-4">
            <section lang="en" dir="ltr" aria-labelledby="org-profile-heading" className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 id="org-profile-heading" className="text-base font-semibold text-stone-900">
                Public profile
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Name, description, contact details, hours, map pin, photos and linked resources shown on this
                organization’s public page.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" ref={editButtonRef} className={SECONDARY} onClick={() => setPanelOpen(true)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit profile
                </button>
                {/* Members see the public page only while the org is active; otherwise the reason shows. */}
                <MemberViewLink
                  lang={locale}
                  dir={dir(locale)}
                  locale={locale}
                  to={{ kind: 'organization', id: org.id }}
                  visibility={organizationVisibility(org)}
                  label={tr('actionViewPublic')}
                  itemName={org.name}
                  source="org_admin_profile"
                  icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
                  className={SECONDARY}
                  reasonClassName="inline-flex min-h-10 items-center text-sm text-stone-600"
                />
                {/* The org's pin on the members' map, or why it has none (inactive, no location). */}
                {showsMapControl(organizationVisibility(org), organizationMapVisibility(org)) && (
                  <MemberViewLink
                    lang={locale}
                    dir={dir(locale)}
                    locale={locale}
                    to={{ kind: 'map_focus', focus: { kind: 'organization', id: org.id } }}
                    visibility={organizationMapVisibility(org)}
                    label={adminNavT(locale, 'viewOnMap')}
                    itemName={org.name}
                    source="org_admin_profile"
                    icon={<MapIcon className="h-4 w-4" aria-hidden="true" />}
                    className={SECONDARY}
                    reasonClassName="inline-flex min-h-10 items-center text-sm text-stone-600"
                  />
                )}
              </div>
            </section>
          </TabsContent>
          <TabsContent value="members" className="mt-4">
            <OrgMembers orgId={org.id} readOnly={!isPlatformAdmin} />
          </TabsContent>
        </Tabs>
      </main>

      <OrgFormPanel
        open={panelOpen}
        mode="edit"
        kind="org"
        orgId={org.id}
        locale={locale}
        checkDuplicateNames={false}
        canChangeType={isPlatformAdmin}
        onOpenChange={(open) => {
          if (!open) setPanelOpen(false)
        }}
        onSaved={handleSaved}
        onCloseAutoFocus={(e) => restoreFocusAfterPanel(e, editButtonRef.current)}
      />
    </div>
  )
}
