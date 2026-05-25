'use client'
import React from 'react'
import { FeedShell, usePanelContext } from '@/components/layout/feed-shell'
import { useAuthContext } from '@/providers/auth-provider'
import {
  ChatPanel,
  MapPanel,
  OverviewPanel,
  FeedPanel,
  SettingsPanel,
  DocumentsPanel,
  ApplicationsPanel,
  FormsPanel,
} from '@/components/panels'

function PanelRenderer() {
  const { activePanel, setActivePanel } = usePanelContext()

  switch (activePanel) {
    case 'chat':
      return <ChatPanel onNavigateToMap={() => setActivePanel('map')} />
    case 'map':
      return <MapPanel />
    case 'feed':
      return <FeedPanel />
    case 'applications':
      return <ApplicationsPanel />
    case 'documents':
      return <DocumentsPanel />
    case 'forms':
      return <FormsPanel />
    case 'settings':
      return <SettingsPanel />
    case 'overview':
    default:
      return <OverviewPanel onNavigateToPanel={setActivePanel as (panel: string) => void} />
  }
}

export default function FeedAppPage() {
  const { isAuthenticated, profile, user } = useAuthContext()

  return (
    <FeedShell
      isAuthenticated={isAuthenticated}
      userName={(profile as any)?.full_name || user?.email || undefined}
      backgroundImage="/images/wheat-field-bg.jpg"
    >
      <PanelRenderer />
    </FeedShell>
  )
}
