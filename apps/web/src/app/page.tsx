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
import { DocumentsPanel } from '@/components/panels/documents-panel'
import { WizardPanel } from '@/components/panels/wizard-panel'
import { ProgramsPanel } from '@/components/panels/programs-panel'
// PetitionsPanel, EventsPanel, BusinessesPanel are now rendered as subtabs inside
// DocumentsPanel (applications) and FeedPanel (events, businesses, petitions) — not top-level panels.
import { useAuth } from '@/hooks/use-auth'
import { logger } from '@/lib/logger'

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
  // The fallback message receives focus when it appears, so keyboard and
  // screen-reader users land on it instead of a now-removed panel element.
  private messageRef = React.createRef<HTMLParagraphElement>()

  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  componentDidUpdate(_prevProps: { children: React.ReactNode }, prevState: { hasError: boolean }) {
    if (this.state.hasError && !prevState.hasError) this.messageRef.current?.focus()
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Persist one error row (code + capped message); the component stack stays console-only.
    logger.error('panel.error.boundary', error, { surface: 'panel' })
    console.error('Panel error component stack:', info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center h-64 gap-4 text-center p-6">
          <div className="text-3xl" aria-hidden="true">🌾</div>
          <p
            ref={this.messageRef}
            tabIndex={-1}
            className="text-stone-600 text-sm rounded focus:outline-none focus:ring-2 focus:ring-lime-700 focus:ring-offset-2"
          >
            This panel encountered an error.
          </p>
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

// PanelId is the parameter type of setActivePanel, inferred from context — no
// need to re-export PanelType from feed-shell.
type PanelId = Parameters<ReturnType<typeof usePanelContext>['setActivePanel']>[0]

// Dynamic Panel Renderer - renders content based on active panel
function PanelRenderer() {
  const { activePanel, setActivePanel } = usePanelContext()
  const { user, profile } = useAuth()

  switch (activePanel) {
    case 'overview':
      return (
        <OverviewPanel
          userName={profile?.full_name || undefined}
          onNavigateToPanel={(panel) => setActivePanel(panel as PanelId)}
        />
      )

    case 'chat':
      return <ChatPanel onNavigateToMap={() => setActivePanel('map')} />

    case 'map':
      return (
        <MapPanel
          onNavigateToChat={(resourceContext) => {
            setActivePanel('chat')
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
    case 'documents':
      return <DocumentsPanel />

    // 'forms', 'messages', 'applications', 'petitions', 'events', 'businesses' are alias inputs —
    // setActivePanel resolves them to their parent panel + subtab before they reach
    // the switch. They never appear as activePanel, so these cases are intentionally absent.

    case 'wizard':
      return <WizardPanel />

    default:
      return (
        <OverviewPanel
          userName={profile?.full_name || undefined}
          onNavigateToPanel={(panel) => setActivePanel(panel as PanelId)}
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
  const { user, profile, isAuthenticated, isAnonymous, loading, signOut } = useAuth()

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
      isAnonymous={isAnonymous}
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
