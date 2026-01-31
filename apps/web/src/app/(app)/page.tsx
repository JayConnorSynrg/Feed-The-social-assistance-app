'use client'

// apps/web/src/app/(app)/page.tsx
// Main FEED app page with new floating card layout
// This is the single-page app entry point

import React from 'react'
import { FeedShell, usePanelContext, ContentPanel } from '@/components/layout/feed-shell'
import { ChatPanel } from '@/components/panels/chat-panel'
import { MapPanel } from '@/components/panels/map-panel'

// Placeholder panels for unbuilt features
function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <ContentPanel title={title} subtitle={description}>
      <div className="h-full flex items-center justify-center">
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
    </ContentPanel>
  )
}

// Dynamic Panel Renderer
function PanelRenderer() {
  const { activePanel, setActivePanel } = usePanelContext()

  switch (activePanel) {
    case 'chat':
      return <ChatPanel onNavigateToMap={() => setActivePanel('map')} />

    case 'map':
      return <MapPanel />

    case 'feed':
      return (
        <PlaceholderPanel
          title="Community Feed"
          description="Connect with others in your community"
        />
      )

    case 'applications':
      return (
        <PlaceholderPanel
          title="My Applications"
          description="Track your benefit applications"
        />
      )

    case 'documents':
      return (
        <PlaceholderPanel
          title="Documents"
          description="Manage your uploaded documents"
        />
      )

    case 'forms':
      return (
        <PlaceholderPanel
          title="Forms"
          description="Fill out benefit applications"
        />
      )

    case 'settings':
      return (
        <PlaceholderPanel
          title="Settings"
          description="Manage your account preferences"
        />
      )

    case 'overview':
    default:
      return <ChatPanel onNavigateToMap={() => setActivePanel('map')} />
  }
}

// Main Page Component
export default function FeedAppPage() {
  return (
    <FeedShell
      isAuthenticated={false}
      backgroundImage="/images/wheat-field-bg.jpg"
    >
      <PanelRenderer />
    </FeedShell>
  )
}
