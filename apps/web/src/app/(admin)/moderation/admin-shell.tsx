'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutDashboard, Calendar, ShieldAlert, Users, Settings, Database, ListChecks, Building2, UserCog, Leaf } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminOrgs } from './use-admin-orgs'
import { useAdminTier } from '@/hooks/use-admin-tier'
import { useIsOrgAdmin } from '@/hooks/use-is-org-admin'
import { canCreateOrganizations, tierLabel } from '@/lib/admin-tier'
import { resolveAdminTab, TAB_ORDER, visibleTabs } from './admin-shell-tabs'
import { readTabParam, tabParamHref } from './admin-tab-url'
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
import { resolveUserLocale, type Locale } from '@/lib/i18n'
import { orgFormT, formatMessage } from '@/lib/i18n-org-forms'
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

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-stone-400">
      <span className="text-sm">{label} — coming soon</span>
    </div>
  )
}

const TRIGGER_CLASS = 'flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-brand data-[state=active]:text-white'

export function AdminShell() {
  const { orgs, loading: orgsLoading } = useAdminOrgs()
  // P3.1: each tier sees only the sections its tier is entitled to (§5). A non-tier org admin
  // (route-allowed by is_org_admin_any) sees ONLY the Events section, scoped to their orgs.
  const { tier, isFounder } = useAdminTier()
  const isOrgAdmin = useIsOrgAdmin()
  const tabs = visibleTabs(tier, isOrgAdmin)

  const [selectedOrgId, setSelectedOrgId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('overview')
  // Fall back to the first visible tab when the requested tab is not entitled for this tier.
  const effectiveTab = resolveAdminTab(activeTab, tabs)

  // Header label: the tier marker, or "Organizer" for a non-tier org admin.
  const headerLabel = tierLabel(tier) ?? 'Organizer'

  // Locale for the organization screens: the profile language once it loads (server render and
  // first client render both use 'en', so hydration matches).
  const { profile } = useAuth()
  const locale: Locale = useMemo(
    () => (profile ? resolveUserLocale((profile as { preferred_language?: string | null }).preferred_language ?? null) : 'en'),
    [profile]
  )
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
    const target = readOrgPanelTarget(search)
    const requested = readTabParam(search, TAB_ORDER)
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
           style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <LayoutDashboard className="h-5 w-5 text-lime-600 shrink-0" />
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
              onChange={e => handleOrgChange(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              <option value="all">All Organizations</option>
              {orgs.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
        <Tabs value={effectiveTab} onValueChange={handleTabChange}>
          {/* Tab bar — horizontally scrollable on mobile. Only entitled tabs render (§5). */}
          <div className="overflow-x-auto -mx-2 px-2 pb-1">
            <TabsList className="flex-nowrap inline-flex w-auto min-w-full bg-white border border-stone-200 rounded-xl p-1 gap-1">
              {tabs.includes('overview') && (
                <TabsTrigger value="overview" className={TRIGGER_CLASS}>
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
              )}
              {tabs.includes('events') && (
                <TabsTrigger value="events" className={TRIGGER_CLASS}>
                  <Calendar className="h-3.5 w-3.5" />
                  Events
                </TabsTrigger>
              )}
              {tabs.includes('moderation') && (
                <TabsTrigger value="moderation" className={TRIGGER_CLASS}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Moderation
                </TabsTrigger>
              )}
              {tabs.includes('community') && (
                <TabsTrigger value="community" className={TRIGGER_CLASS}>
                  <Users className="h-3.5 w-3.5" />
                  Community
                </TabsTrigger>
              )}
              {tabs.includes('organizations') && (
                <TabsTrigger value="organizations" className={TRIGGER_CLASS}>
                  <Building2 className="h-3.5 w-3.5" />
                  Organizations
                </TabsTrigger>
              )}
              {tabs.includes('resources') && (
                <TabsTrigger value="resources" className={TRIGGER_CLASS}>
                  <Database className="h-3.5 w-3.5" />
                  Resources
                </TabsTrigger>
              )}
              {tabs.includes('businesses') && (
                <TabsTrigger value="businesses" className={TRIGGER_CLASS}>
                  <Leaf className="h-3.5 w-3.5" />
                  Businesses
                </TabsTrigger>
              )}
              {tabs.includes('manage') && (
                <TabsTrigger value="manage" className={TRIGGER_CLASS}>
                  <ListChecks className="h-3.5 w-3.5" />
                  Manage
                </TabsTrigger>
              )}
              {tabs.includes('people') && (
                <TabsTrigger value="people" className={TRIGGER_CLASS}>
                  <UserCog className="h-3.5 w-3.5" />
                  People
                </TabsTrigger>
              )}
              {tabs.includes('settings') && (
                <TabsTrigger value="settings" className={TRIGGER_CLASS}>
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {tabs.includes('events') && (
            <TabsContent value="events" className="mt-4">
              <EventScheduler selectedOrgId={selectedOrgId} />
            </TabsContent>
          )}
          {tabs.includes('overview') && (
            <TabsContent value="overview" className="mt-4">
              <OverviewTab
                selectedOrgId={selectedOrgId}
                locale={locale}
                onCreateOrganization={canManageOrgs ? () => openCreate('org') : undefined}
              />
            </TabsContent>
          )}
          {tabs.includes('moderation') && (
            <TabsContent value="moderation" className="mt-4">
              <ModerationTab selectedOrgId={selectedOrgId} />
            </TabsContent>
          )}
          {tabs.includes('community') && (
            <TabsContent value="community" className="mt-4">
              <CommunityTab selectedOrgId={selectedOrgId} />
            </TabsContent>
          )}
          {tabs.includes('organizations') && (
            <TabsContent value="organizations" className="mt-4">
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
            <TabsContent value="resources" className="mt-4">
              <ResourcesTab />
            </TabsContent>
          )}
          {tabs.includes('businesses') && (
            <TabsContent value="businesses" className="mt-4">
              <BusinessesTab />
            </TabsContent>
          )}
          {tabs.includes('manage') && (
            <TabsContent value="manage" className="mt-4">
              <ManageResourcesTab />
            </TabsContent>
          )}
          {tabs.includes('people') && (
            <TabsContent value="people" className="mt-4">
              <PeopleTab viewerTier={tier} isFounder={isFounder} />
            </TabsContent>
          )}
          {tabs.includes('settings') && (
            <TabsContent value="settings" className="mt-4">
              <PlaceholderTab label="Settings" />
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
        />
      )}
    </div>
  )
}
