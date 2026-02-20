'use client'

// apps/web/src/app/page.tsx
// Root page - renders the FEED app with floating card layout
// Auth-aware: shows real user data when authenticated

import React from 'react'
import { useRouter } from 'next/navigation'
import { FeedShell, usePanelContext } from '@/components/layout/feed-shell'
import { ChatPanel } from '@/components/panels/chat-panel'
import { MapPanel } from '@/components/panels/map-panel'
import { OverviewPanel } from '@/components/panels/overview-panel'
import { FeedPanel } from '@/components/panels/feed-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { ApplicationsPanel } from '@/components/panels/applications-panel'
import { DocumentsPanel } from '@/components/panels/documents-panel'
import { FormsPanel } from '@/components/panels/forms-panel'
import { useAuth } from '@/hooks/use-auth'

// Dynamic Panel Renderer - renders content based on active panel
function PanelRenderer() {
  const { activePanel, setActivePanel } = usePanelContext()
  const { user, profile } = useAuth()

  switch (activePanel) {
    case 'overview':
      return (
        <OverviewPanel
          userName={profile?.full_name || undefined}
          onNavigateToPanel={(panel) => setActivePanel(panel as any)}
        />
      )

    case 'chat':
      return <ChatPanel onNavigateToMap={() => setActivePanel('map')} />

    case 'map':
      return <MapPanel />

    case 'feed':
      return <FeedPanel userId={user?.id} />

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
      return (
        <OverviewPanel
          userName={profile?.full_name || undefined}
          onNavigateToPanel={(panel) => setActivePanel(panel as any)}
        />
      )
  }
}

// Loading skeleton while auth initializes
function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#4a5d23]/20 animate-pulse" />
        <div className="w-32 h-3 bg-stone-200 rounded animate-pulse" />
      </div>
    </div>
  )
}

// Main Page Component
export default function HomePage() {
  const { user, profile, isAuthenticated, loading, signOut } = useAuth()
  const router = useRouter()

  // TODO: Add onboarding_completed field to profiles table if needed
  // const needsOnboarding = isAuthenticated && profile && !profile.onboarding_completed

  // Redirect to onboarding if needed (but only after loading)
  // React.useEffect(() => {
  //   if (!loading && needsOnboarding) {
  //     router.push('/onboarding')
  //   }
  // }, [loading, needsOnboarding, router])

  if (loading) {
    return (
      <FeedShell
        isAuthenticated={false}
        backgroundImage="/images/wheat-field-bg.jpg"
      >
        <LoadingSkeleton />
      </FeedShell>
    )
  }

  return (
    <FeedShell
      isAuthenticated={isAuthenticated}
      userName={profile?.full_name || user?.email?.split('@')[0]}
      onSignOut={signOut}
      backgroundImage="/images/wheat-field-bg.jpg"
    >
      <PanelRenderer />
    </FeedShell>
  )
}
