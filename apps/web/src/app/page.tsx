'use client'

// apps/web/src/app/page.tsx
// Root page - renders the FEED app with floating card layout

import React from 'react'
import { FeedShell, usePanelContext } from '@/components/layout/feed-shell'
import { ChatPanel } from '@/components/panels/chat-panel'
import { MapPanel } from '@/components/panels/map-panel'
import { OverviewPanel } from '@/components/panels/overview-panel'
import { FeedPanel } from '@/components/panels/feed-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { ApplicationsPanel } from '@/components/panels/applications-panel'
import { DocumentsPanel } from '@/components/panels/documents-panel'
import { FormsPanel } from '@/components/panels/forms-panel'

// Placeholder panels for unbuilt features (Phase 2)
function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">🚧</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-muted-foreground">
            This feature is under development. Check back soon!
          </p>
        </div>
      </div>
    </div>
  )
}

// Dynamic Panel Renderer - renders content based on active panel
function PanelRenderer() {
  const { activePanel, setActivePanel } = usePanelContext()

  switch (activePanel) {
    case 'overview':
      return <OverviewPanel onNavigateToPanel={(panel) => setActivePanel(panel as any)} />

    case 'chat':
      return <ChatPanel onNavigateToMap={() => setActivePanel('map')} />

    case 'map':
      return <MapPanel />

    case 'feed':
      return <FeedPanel />

    case 'settings':
      return <SettingsPanel />

    // Phase 2 panels (role-restricted)
    case 'applications':
      return <ApplicationsPanel />

    case 'documents':
      return <DocumentsPanel />

    case 'forms':
      return <FormsPanel />

    default:
      return <OverviewPanel onNavigateToPanel={(panel) => setActivePanel(panel as any)} />
  }
}

// Main Page Component
export default function HomePage() {
  return (
    <FeedShell
      isAuthenticated={false}
      backgroundImage="/images/wheat-field-bg.jpg"
    >
      <PanelRenderer />
    </FeedShell>
  )
}
