'use client'

// apps/web/src/app/page.tsx
// Root page - renders the FEED app with floating card layout
// Auth-aware: shows real user data when authenticated

import React from 'react'
import dynamic from 'next/dynamic'
import { FeedShell, usePanelContext } from '@/components/layout/feed-shell'
import { ChatPanel } from '@/components/panels/chat-panel'
import { OverviewPanel } from '@/components/panels/overview-panel'
import { FeedPanel } from '@/components/panels/feed-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { ApplicationsPanel } from '@/components/panels/applications-panel'
import { DocumentsPanel } from '@/components/panels/documents-panel'
import { FormsPanel } from '@/components/panels/forms-panel'
import { MessagesPanel } from '@/components/panels/messages-panel'
import { WizardPanel } from '@/components/panels/wizard-panel'
import { ProgramsPanel } from '@/components/panels/programs-panel'
import { useAuth } from '@/hooks/use-auth'

// MapPanel pulls supercluster + react-map-gl into its chunk. Map is not the
// default panel, so load it on demand to keep those deps out of the initial
// `/` bundle. ssr:false because Mapbox GL requires the browser.
const MapPanel = dynamic(
  () => import('@/components/panels/map-panel').then((m) => m.MapPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#4a5d23]/20 animate-pulse" />
          <div className="w-32 h-3 bg-stone-200 rounded animate-pulse" />
        </div>
      </div>
    ),
  }
)

// Panel-level error boundary — shell stays mounted if a panel throws
class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Panel error:', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center p-6">
          <div className="text-3xl">🌾</div>
          <p className="text-stone-600 text-sm">This panel encountered an error.</p>
          <button
            className="text-xs text-lime-700 underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
      return (
        <MapPanel
          onNavigateToChat={(resourceContext) => {
            setActivePanel('chat' as any)
          }}
        />
      )

    case 'programs':
      return <ProgramsPanel />

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

    case 'messages':
      return <MessagesPanel />

    case 'wizard':
      return <WizardPanel />

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
      <PanelErrorBoundary>
        <PanelRenderer />
      </PanelErrorBoundary>
    </FeedShell>
  )
}
