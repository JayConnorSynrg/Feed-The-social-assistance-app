'use client'

// apps/web/src/app/(admin)/moderation/admin-shell.tsx
// The admin console shell (/moderation): header, organization selector and the tab bar, in the
// admin's language (lib/i18n-admin-shell.ts; the tier marker is roleLabel, lib/i18n-feed-card.ts).
// The locale is useProfileLocale(), so the cookie the server rendered with, the profile and the
// device choice agree from the first paint. The header, the tab bar and the translated tabs
// (Moderation, Community, People) carry that language; every other tab's content is marked English
// (lang="en" dir="ltr") until its own wave translates it, and a translated part inside one (Events,
// Organizations…) sets its own lang on its root.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutDashboard, Calendar, ShieldAlert, Users, Database, ListChecks, Building2, UserCog, Leaf, type LucideIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminOrgs } from './use-admin-orgs'
import { useAdminTier } from '@/hooks/use-admin-tier'
import { useIsOrgAdminState } from '@/hooks/use-is-org-admin'
import { canCreateOrganizations } from '@/lib/admin-tier'
import { resolveAdminTab, TAB_ORDER, visibleTabs, type AdminTabId } from './admin-shell-tabs'
import { invalidTabRow, readTabParam, tabParamHref, withoutTabHref } from './admin-tab-url'
import type { AdminDeeplinkRow } from './admin-focus-session'
import { useAdminFocusGate } from './use-admin-focus'
import { shellOwnerTab } from './admin-focus-session'
import { AdminFocusGateStatus } from './admin-focus-gate-status'
import { OrgPanelFocus, type OrgPanelState } from './org-focus'
import { logEvent } from '@/lib/logger'
import { OverviewTab } from './overview-tab'
import { EventScheduler } from './event-scheduler'
import { ModerationTab } from './moderation-tab'
import { CommunityTab } from './community-tab'
import { ResourcesTab } from './resources-tab'
import { BusinessesTab } from './businesses-tab'
import { ManageResourcesTab } from './manage-resources-tab'
import { OrgsSection } from './orgs-section'
import { PeopleTab } from './people-tab'
import { useAuth } from '@/hooks/use-auth'
import { dir } from '@/lib/i18n'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { orgFormT } from '@/lib/i18n-org-forms'
import { formatMessage } from '@/lib/format-message'
import { roleLabel } from '@/lib/i18n-feed-card'
import { adminShellT, adminTabLabel } from '@/lib/i18n-admin-shell'
import { OrgFormPanel, type OrgFormPanelHandle } from '@/components/org-form/org-form-panel'
import type { OrgFormKind } from '@/components/org-form/org-form-model'
import { restoreFocusAfterPanel } from './org-panel-focus'
import {
  closeUrlAction,
  orgPanelHref,
  readOrgPanelTarget,
  readsOrganizationsTab,
  type OrgPanelTarget,
} from './org-panel-url'

const TAB_ICONS: Record<AdminTabId, LucideIcon> = {
  overview: LayoutDashboard,
  events: Calendar,
  moderation: ShieldAlert,
  community: Users,
  organizations: Building2,
  resources: Database,
  businesses: Leaf,
  manage: ListChecks,
  people: UserCog,
}

const TRIGGER_CLASS = 'flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-brand data-[state=active]:text-white'

export function AdminShell() {
  const { orgs, loading: orgsLoading } = useAdminOrgs()
  // P3.1: each tier sees only the sections its tier is entitled to (§5). A non-tier org admin
  // (route-allowed by is_org_admin_any) sees ONLY the Events section, scoped to their orgs.
  const { tier, isFounder, loading: tierLoading } = useAdminTier()
  const { isOrgAdmin, loaded: orgAdminLoaded } = useIsOrgAdminState()
  const tabs = visibleTabs(tier, isOrgAdmin)
  // "Edit in admin" (?focus=): the tab that owns the item resolves it; once the tabs are final, a
  // focus no shown tab will take is reported here (invalid / forbidden).
  const focusGateRow = useAdminFocusGate(!tierLoading && orgAdminLoaded, tabs, shellOwnerTab)

  const [selectedOrgId, setSelectedOrgId] = useState<string>('all')
  // Starts at 'overview' and the mount effect below applies a `?tab=` deep link, so a deep link
  // paints the default tab for one frame. Deliberate: a lazy initializer reading window.location would
  // differ between the server render and the first client render (hydration mismatch).
  const [activeTab, setActiveTab] = useState<string>('overview')
  // Fall back to the first visible tab when the requested tab is not entitled for this tier.
  const effectiveTab = resolveAdminTab(activeTab, tabs)

  // The admin's language: the cookie the server rendered with, then the profile, then a device
  // choice (the one rule every surface reads).
  const { user } = useAuth()
  const locale = useProfileLocale()

  // Header label: the tier marker, or "Organizer" for a non-tier org admin.
  const headerLabel = tier ? roleLabel(tier, locale) : adminShellT(locale, 'organizer')

  // A `?tab=` naming no tab (e.g. a bookmark of the removed Settings tab) writes one row on mount.
  const [tabGateRow, setTabGateRow] = useState<AdminDeeplinkRow | null>(null)
  const tabGateRanRef = useRef(false)
  const canManageOrgs = canCreateOrganizations(tier)

  // ---- Organization setup panel: owned here so the list, the Overview quick action and deep links
  // (?tab=organizations&org=new|<id>) all open the same panel. Opening pushes a history entry;
  // closing pops it (or strips `org` from a deep-linked URL); the phone Back button closes the panel
  // through the panel's discard guard.
  const [panel, setPanel] = useState<{ open: boolean; mode: 'create' | 'edit'; orgId: string | null; kind: OrgFormKind }>({
    open: false,
    mode: 'create',
    orgId: null,
    kind: 'org',
  })
  const panelHandle = useRef<OrgFormPanelHandle>(null)
  // The panel's own read of the organization it opened (an organization "Edit in admin" link resolves
  // from it: OrgPanelFocus in org-focus.tsx).
  const [orgLoad, setOrgLoad] = useState<OrgPanelState['load']>(null)
  const orgPanelState = useMemo<OrgPanelState>(
    () => ({ openOrgId: panel.open && panel.mode === 'edit' ? panel.orgId : null, load: orgLoad }),
    [panel.open, panel.mode, panel.orgId, orgLoad]
  )
  const [orgListKey, setOrgListKey] = useState(0)
  const [orgNotice, setOrgNotice] = useState<string | null>(null)
  const pushedRef = useRef(false)
  const panelOpenRef = useRef(false)
  const closingViaPopRef = useRef(false)
  const panelTargetRef = useRef<OrgPanelTarget | null>(null)
  // The control that opened the panel gets focus back when it closes.
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const showPanel = useCallback((target: OrgPanelTarget) => {
    panelOpenRef.current = true
    panelTargetRef.current = target
    setPanel(target === 'new' ? { open: true, mode: 'create', orgId: null, kind: 'org' } : { open: true, mode: 'edit', orgId: target, kind: 'org' })
  }, [])

  const openOrgPanel = useCallback(
    (target: OrgPanelTarget) => {
      setActiveTab('organizations')
      setOrgNotice(null)
      if (!panelOpenRef.current) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        // The panel switches the shell to Organizations (e.g. from the Overview quick action): record
        // that tab on the entry Back returns to, so closing the panel lands on a URL that matches.
        window.history.replaceState(window.history.state, '', tabParamHref(window.location, 'organizations'))
      }
      const href = orgPanelHref(window.location, target)
      if (panelOpenRef.current) {
        // Switching target inside an open panel ("Edit existing") reuses its history entry.
        window.history.replaceState(window.history.state, '', href)
      } else {
        window.history.pushState(window.history.state, '', href)
        pushedRef.current = true
      }
      showPanel(target)
    },
    [showPanel]
  )

  /** Open the setup panel for a new entity. PR-B adds kind 'business'. */
  const openCreate = useCallback((kind: OrgFormKind) => {
    if (kind === 'org') openOrgPanel('new')
  }, [openOrgPanel])

  const closePanel = useCallback(() => {
    const action = closeUrlAction(pushedRef.current, closingViaPopRef.current)
    pushedRef.current = false
    closingViaPopRef.current = false
    panelOpenRef.current = false
    panelTargetRef.current = null
    setPanel((p) => ({ ...p, open: false }))
    if (action === 'back') window.history.back()
    else if (action === 'replace') window.history.replaceState(window.history.state, '', orgPanelHref(window.location, null))
  }, [])

  // Deep link: read ?tab / ?org once on mount. window.location exists only after mount, so
  // setState in this effect is the correct idiom (same as feed-shell's hash routing). Any tab id is
  // honoured; resolveAdminTab still clamps it to the tabs this tier is entitled to.
  useEffect(() => {
    const search = window.location.search
    // A `?tab=` naming no tab: the default tab is shown, one row is written, the param is dropped.
    if (!tabGateRanRef.current) {
      tabGateRanRef.current = true
      const row = invalidTabRow(search, TAB_ORDER)
      if (row) {
        logEvent('admin.deeplink.resolve', { kind: row.kind, outcome: row.outcome, tab: row.tab })
        window.history.replaceState(window.history.state, '', withoutTabHref(window.location))
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTabGateRow(row)
      }
    }
    const target = readOrgPanelTarget(search)
    const requested = readTabParam(search, TAB_ORDER)
    if (readsOrganizationsTab(search) || target) setActiveTab('organizations')
    else if (requested) setActiveTab(requested)
    if (target) showPanel(target)
  }, [showPanel])

  // Back / Forward: a URL without `org` asks the open panel to close (guarded); a URL with `org`
  // opens it.
  useEffect(() => {
    const onPop = () => {
      const target = readOrgPanelTarget(window.location.search)
      if (target === null) {
        if (panelOpenRef.current) {
          closingViaPopRef.current = true
          panelHandle.current?.requestClose()
        }
        return
      }
      // Opened by Forward/Back, not by a control: no opener to return to (the list's Create
      // organization is the fallback). A stale opener from an earlier open must not be reused; an
      // already-open panel keeps the control that really opened it.
      if (!panelOpenRef.current) returnFocusRef.current = null
      pushedRef.current = true
      setActiveTab('organizations')
      showPanel(target)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [showPanel])

  // "Keep editing" after Back: restore the entry Back removed.
  const restorePanelEntry = useCallback(() => {
    closingViaPopRef.current = false
    const target = panelTargetRef.current
    if (!target) return
    window.history.pushState(window.history.state, '', orgPanelHref(window.location, target))
    pushedRef.current = true
  }, [])

  const handleOrgSaved = useCallback(
    (result: { id: string; created: boolean; name: string }) => {
      setOrgNotice(formatMessage(orgFormT(locale, result.created ? 'savedCreated' : 'savedUpdated'), { name: result.name }))
      setOrgListKey((n) => n + 1)
      closePanel()
    },
    [locale, closePanel]
  )

  function handleTabChange(tab: string) {
    logEvent('admin.shell.tab_switch', { to_tab: tab, from_tab: effectiveTab, org_id: selectedOrgId })
    setActiveTab(tab)
    // Replace (not push): the open tab is in the URL for reloads and links, without a Back entry per
    // click. Other params and the org panel's own entries are untouched.
    window.history.replaceState(window.history.state, '', tabParamHref(window.location, tab))
  }

  function handleOrgChange(orgId: string) {
    logEvent('admin.shell.org_switch', { org_id: orgId })
    setSelectedOrgId(orgId)
  }

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <div lang={locale} dir={dir(locale)}
           className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
           style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <LayoutDashboard aria-hidden="true" className="h-5 w-5 text-lime-600 shrink-0" />
        <h1 className="font-semibold text-stone-900 text-sm sm:text-base shrink-0">
          {headerLabel}
        </h1>

        {/* Org selector */}
        <div className="flex-1 min-w-0">
          {orgsLoading ? (
            <div className="h-8 bg-stone-100 rounded-lg animate-pulse" />
          ) : orgs.length > 0 ? (
            <select
              value={selectedOrgId}
              aria-label={adminShellT(locale, 'organization')}
              onChange={e => handleOrgChange(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="all">{adminShellT(locale, 'allOrganizations')}</option>
              {orgs.map(org => (
                // An organization's name is its own: no page language.
                <option key={org.id} value={org.id} lang="" dir="auto">{org.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
        <AdminFocusGateStatus row={focusGateRow ?? tabGateRow} locale={locale} />
        {/* An organization link (?tab=organizations&org=<id>&focus=organization:<id>) is claimed, like a
            tab's focus, only while the Organizations tab is shown; it resolves from the setup panel. */}
        {tabs.includes('organizations') && <OrgPanelFocus panel={orgPanelState} />}
        {/* dir: arrow keys move along the tab bar in reading direction (Radix reads it). */}
        <Tabs value={effectiveTab} onValueChange={handleTabChange} dir={dir(locale)}>
          {/* Tab bar — horizontally scrollable on mobile. Only entitled tabs render (§5). */}
          <div className="overflow-x-auto -mx-2 px-2 pb-1">
            <TabsList
              lang={locale}
              aria-label={adminShellT(locale, 'sections')}
              className="flex-nowrap inline-flex w-auto min-w-full bg-white border border-stone-200 rounded-xl p-1 gap-1"
            >
              {tabs.map((id) => {
                const Icon = TAB_ICONS[id]
                return (
                  <TabsTrigger key={id} value={id} className={TRIGGER_CLASS}>
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                    {adminTabLabel(id, locale)}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          {tabs.includes('events') && (
            <TabsContent value="events" lang="en" dir="ltr" className="mt-4">
              <EventScheduler selectedOrgId={selectedOrgId} />
            </TabsContent>
          )}
          {tabs.includes('overview') && (
            <TabsContent value="overview" lang="en" dir="ltr" className="mt-4">
              <OverviewTab
                selectedOrgId={selectedOrgId}
                locale={locale}
                onCreateOrganization={canManageOrgs ? () => openCreate('org') : undefined}
              />
            </TabsContent>
          )}
          {tabs.includes('moderation') && (
            <TabsContent value="moderation" lang={locale} dir={dir(locale)} className="mt-4">
              <ModerationTab selectedOrgId={selectedOrgId} viewerId={user?.id ?? null} locale={locale} />
            </TabsContent>
          )}
          {tabs.includes('community') && (
            <TabsContent value="community" lang={locale} dir={dir(locale)} className="mt-4">
              <CommunityTab selectedOrgId={selectedOrgId} locale={locale} />
            </TabsContent>
          )}
          {tabs.includes('organizations') && (
            <TabsContent value="organizations" lang="en" dir="ltr" className="mt-4">
              <OrgsSection
                locale={locale}
                onCreate={() => openCreate('org')}
                onEdit={(id) => openOrgPanel(id)}
                refreshKey={orgListKey}
                notice={orgNotice}
              />
            </TabsContent>
          )}
          {tabs.includes('resources') && (
            <TabsContent value="resources" lang="en" dir="ltr" className="mt-4">
              <ResourcesTab />
            </TabsContent>
          )}
          {tabs.includes('businesses') && (
            <TabsContent value="businesses" lang="en" dir="ltr" className="mt-4">
              <BusinessesTab />
            </TabsContent>
          )}
          {tabs.includes('manage') && (
            <TabsContent value="manage" lang="en" dir="ltr" className="mt-4">
              <ManageResourcesTab />
            </TabsContent>
          )}
          {tabs.includes('people') && (
            <TabsContent value="people" lang={locale} dir={dir(locale)} className="mt-4">
              <PeopleTab viewerTier={tier} isFounder={isFounder} locale={locale} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {canManageOrgs && (
        <OrgFormPanel
          open={panel.open}
          mode={panel.mode}
          kind={panel.kind}
          orgId={panel.orgId}
          locale={locale}
          onOpenChange={(open) => {
            if (!open) closePanel()
          }}
          onSaved={handleOrgSaved}
          onEditExisting={(id) => openOrgPanel(id)}
          ref={panelHandle}
          onCloseAutoFocus={(e) => restoreFocusAfterPanel(e, returnFocusRef.current)}
          onCloseRequestDeclined={restorePanelEntry}
          onLoadResult={(orgId, ok) => setOrgLoad({ orgId, ok })}
        />
      )}
    </div>
  )
}
