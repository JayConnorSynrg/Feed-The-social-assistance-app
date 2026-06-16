'use client'

import { useState } from 'react'
import { LayoutDashboard, Calendar, ShieldAlert, Users, Settings } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminOrgs } from './use-admin-orgs'
import { logger } from '@/lib/logger'
import { OverviewTab } from './overview-tab'
import { EventScheduler } from './event-scheduler'
import { ModerationTab } from './moderation-tab'
import { CommunityTab } from './community-tab'

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-stone-400">
      <span className="text-sm">{label} — coming soon</span>
    </div>
  )
}

export function AdminShell() {
  const { orgs, loading: orgsLoading } = useAdminOrgs()
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')

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
        <h1 className="font-semibold text-stone-900 text-sm sm:text-base shrink-0">Admin</h1>

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
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Tab bar — horizontally scrollable on mobile */}
          <div className="overflow-x-auto -mx-2 px-2 pb-1">
            <TabsList className="flex-nowrap inline-flex w-auto min-w-full bg-white border border-stone-200 rounded-xl p-1 gap-1">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-lime-600 data-[state=active]:text-white">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-lime-600 data-[state=active]:text-white">
                <Calendar className="h-3.5 w-3.5" />
                Events
              </TabsTrigger>
              <TabsTrigger value="moderation" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-lime-600 data-[state=active]:text-white">
                <ShieldAlert className="h-3.5 w-3.5" />
                Moderation
              </TabsTrigger>
              <TabsTrigger value="community" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-lime-600 data-[state=active]:text-white">
                <Users className="h-3.5 w-3.5" />
                Community
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap rounded-lg data-[state=active]:bg-lime-600 data-[state=active]:text-white">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab selectedOrgId={selectedOrgId} />
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <EventScheduler selectedOrgId={selectedOrgId} />
          </TabsContent>
          <TabsContent value="moderation" className="mt-4">
            <ModerationTab selectedOrgId={selectedOrgId} />
          </TabsContent>
          <TabsContent value="community" className="mt-4">
            <CommunityTab selectedOrgId={selectedOrgId} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <PlaceholderTab label="Settings" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
