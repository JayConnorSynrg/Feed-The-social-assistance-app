'use client'

import { useState } from 'react'
import { LayoutDashboard, Calendar, ShieldAlert, Users, Settings, Database, ListChecks, Building2, UserCog } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminOrgs } from './use-admin-orgs'
import { useAdminTier } from '@/hooks/use-admin-tier'
import { useIsOrgAdmin } from '@/hooks/use-is-org-admin'
import { tierLabel } from '@/lib/admin-tier'
import { visibleTabs } from './admin-shell-tabs'
import { logger } from '@/lib/logger'
import { OverviewTab } from './overview-tab'
import { EventScheduler } from './event-scheduler'
import { ModerationTab } from './moderation-tab'
import { CommunityTab } from './community-tab'
import { ResourcesTab } from './resources-tab'
import { ManageResourcesTab } from './manage-resources-tab'
import { OrgsSection } from './orgs-section'
import { PeopleTab } from './people-tab'

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-stone-400">
      <span className="text-sm">{label} — coming soon</span>
    </div>
  )
}

const TRIGGER_CLASS = 'flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-lime-600 data-[state=active]:text-white'

export function AdminShell() {
  const { orgs, loading: orgsLoading } = useAdminOrgs()
  // P3.1: each tier sees only the sections its tier is entitled to (§5). A non-tier org admin
  // (route-allowed by is_org_admin_any) sees ONLY the Events section, scoped to their orgs.
  const { tier, isFounder } = useAdminTier()
  const isOrgAdmin = useIsOrgAdmin()
  const tabs = visibleTabs(tier, isOrgAdmin)

  const [selectedOrgId, setSelectedOrgId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')
  // Fall back to the first visible tab when the requested tab is not entitled for this tier.
  const effectiveTab = (tabs as string[]).includes(activeTab) ? activeTab : (tabs[0] ?? 'events')

  // Header label: the tier marker, or "Organizer" for a non-tier org admin.
  const headerLabel = tierLabel(tier) ?? 'Organizer'

  function handleTabChange(tab: string) {
    logger.info('admin.shell.tab_switch', { to_tab: tab, from_tab: activeTab, org_id: selectedOrgId })
    setActiveTab(tab)
  }

  function handleOrgChange(orgId: string) {
    logger.info('admin.shell.org_switch', { org_id: orgId })
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
              <OverviewTab selectedOrgId={selectedOrgId} />
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
              <OrgsSection />
            </TabsContent>
          )}
          {tabs.includes('resources') && (
            <TabsContent value="resources" className="mt-4">
              <ResourcesTab />
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
    </div>
  )
}
