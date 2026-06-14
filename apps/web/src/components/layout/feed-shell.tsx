'use client'

// apps/web/src/components/layout/feed-shell.tsx
// New FEED layout with floating card design over nature background
// Based on concept: Single-page app with persistent shell and dynamic content area
// V2: Separated interactive area from metrics, role-based content visibility

import React, { useState, createContext, useContext, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  Map,
  Newspaper,
  FileText,
  FolderOpen,
  ClipboardList,
  Settings,
  Home,
  LogIn,
  UserPlus,
  Menu,
  X,
  TrendingUp,
  Heart,
  Package,
  Building2,
  Leaf,
  ExternalLink,
  Compass,
  Search,
  ScrollText,
  Calendar,
  ShieldAlert,
} from 'lucide-react'
import { logger } from '@/lib/logger'
import { track } from '@vercel/analytics'
import { useIsAdmin } from '@/hooks/use-is-admin'

// ============================================
// USER ROLES & CONTEXT
// ============================================
export type UserRole =
  | 'recipient'      // Seeking food/assistance
  | 'donor'          // Donating food/resources
  | 'volunteer'      // Community volunteer
  | 'agency'         // Nonprofit organization
  | 'program'        // Government program
  | 'admin'          // Platform administrator

export type UserFocus =
  | 'food'           // Food assistance focus
  | 'housing'        // Housing assistance
  | 'healthcare'     // Healthcare services
  | 'employment'     // Job assistance
  | 'community'      // General community
  | 'donations'      // Donating/giving

type PanelType = 'chat' | 'map' | 'programs' | 'feed' | 'applications' | 'documents' | 'forms' | 'settings' | 'overview' | 'messages' | 'wizard' | 'petitions' | 'events'

interface ShellContextType {
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void
  userRole: UserRole
  setUserRole: (role: UserRole) => void
  userFocus: UserFocus[]
  setUserFocus: (focus: UserFocus[]) => void
  panelParams: Record<string, unknown>
  setPanelParams: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}

const ShellContext = createContext<ShellContextType>({
  activePanel: 'chat',
  setActivePanel: () => {},
  userRole: 'recipient',
  setUserRole: () => {},
  userFocus: ['food'],
  setUserFocus: () => {},
  panelParams: {},
  setPanelParams: () => {},
})

export const useShellContext = () => useContext(ShellContext)
// Legacy export for backwards compatibility
export const usePanelContext = () => {
  const { activePanel, setActivePanel, panelParams, setPanelParams } = useContext(ShellContext)
  return { activePanel, setActivePanel, panelParams, setPanelParams }
}

// ============================================
// NAVIGATION CONFIG
// ============================================
type TopNavItem = { label: string; panel?: PanelType; href?: string }

const TOP_NAV_ITEMS: TopNavItem[] = [
  { label: 'Home', panel: 'overview' },
  { label: 'AI Assistant', panel: 'chat' },
  { label: 'Resources', panel: 'map' },
  { label: 'Community', panel: 'feed' },
]

// Admin nav entry — appended only for admins (is_current_user_admin RPC).
// Uses href so the click navigates to the server-gated /moderation route
// rather than switching an in-shell panel.
const ADMIN_TOP_NAV_ITEM: TopNavItem = { label: 'Admin', href: '/moderation' }

type SidebarIconItem = {
  panel?: PanelType
  href?: string
  icon: React.ElementType
  label: string
  roles?: UserRole[]
}

const SIDEBAR_ICONS: SidebarIconItem[] = [
  { panel: 'overview', icon: Home, label: 'Overview' },
  { panel: 'chat', icon: MessageSquare, label: 'AI Assistant' },
  { panel: 'map', icon: Map, label: 'Resource Map' },
  { panel: 'programs', icon: Search, label: 'Browse Programs' },
  { panel: 'feed', icon: Newspaper, label: 'Community & Messages' },
  { panel: 'applications', icon: ClipboardList, label: 'Applications', roles: ['recipient', 'agency', 'program'] },
  { panel: 'documents', icon: FolderOpen, label: 'Documents & Forms', roles: ['recipient', 'agency', 'program'] },
  { panel: 'wizard', icon: Compass, label: 'Get Help Finding Resources' },
  { panel: 'petitions', icon: ScrollText, label: 'Petitions' },
  { panel: 'events', icon: Calendar, label: 'Events' },
  { panel: 'settings', icon: Settings, label: 'Settings' },
]

// Admin sidebar entry — appended only for admins. href navigates to the
// server-gated /moderation route (no in-shell panel for admin).
const ADMIN_SIDEBAR_ICON: SidebarIconItem = {
  href: '/moderation',
  icon: ShieldAlert,
  label: 'Admin',
}

// Panel aliases: 'forms' and 'messages' are deep-link inputs that resolve to
// a parent panel + subtab. They remain valid PanelType inputs to setActivePanel
// but never become the resolved activePanel value.
const PANEL_ALIASES: Record<string, { panel: PanelType; subtab: string }> = {
  forms: { panel: 'documents', subtab: 'forms' },
  messages: { panel: 'feed', subtab: 'messages' },
}

// ============================================
// TOP NAVIGATION BAR
// ============================================
interface TopNavProps {
  isAuthenticated?: boolean
  userName?: string
  onSignOut?: () => void
}

function TopNav({ isAuthenticated = false, userName, onSignOut }: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { activePanel, setActivePanel } = useShellContext()
  const router = useRouter()
  const isAdmin = useIsAdmin()

  // Admin entry is appended only when the verified admin signal is true.
  const navItems = isAdmin ? [...TOP_NAV_ITEMS, ADMIN_TOP_NAV_ITEM] : TOP_NAV_ITEMS

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-stone-200/50 bg-white flex-shrink-0">
      {/* Logo */}
      <button onClick={() => setActivePanel('overview')} className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[#4a5d23]/20 flex items-center justify-center">
          <span className="text-[#4a5d23] font-bold text-sm">F</span>
        </div>
        <span className="font-semibold text-stone-800 hidden sm:inline">FEED</span>
      </button>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {navItems.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm transition-colors flex items-center gap-1 text-[#4a5d23] hover:text-[#3d4d1c] font-medium"
            >
              <ShieldAlert className="w-4 h-4" />
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              onClick={() => item.panel && setActivePanel(item.panel)}
              className={`text-sm transition-colors flex items-center gap-1 ${
                item.panel === activePanel
                  ? 'text-[#4a5d23] font-medium'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {item.label}
            </button>
          )
        )}
      </nav>

      {/* Auth Buttons */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500 hidden sm:inline">
              {userName}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#4a5d23]/20 flex items-center justify-center text-xs font-medium text-[#4a5d23]">
              {userName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {onSignOut && (
              <button
                onClick={async () => {
                  logger.info('auth.signout', { surface: 'topnav' })
                  await onSignOut()
                  router.push('/login')
                }}
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        ) : (
          <>
            <a
              href="/login"
              className="text-sm px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors hidden sm:inline-flex items-center gap-2 text-stone-700"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </a>
            <a
              href="/signup"
              className="text-sm px-4 py-2 rounded-lg bg-[#4a5d23] text-white hover:bg-[#3d4d1c] transition-colors inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
              <span className="hidden sm:inline">→</span>
            </a>
          </>
        )}

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 hover:bg-stone-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b shadow-lg md:hidden z-50">
          <nav className="flex flex-col p-4 gap-2">
            {navItems.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm py-2 px-4 rounded-lg text-left flex items-center gap-2 text-[#4a5d23] font-medium hover:bg-[#4a5d23]/10"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  className={`text-sm py-2 px-4 rounded-lg text-left ${
                    item.panel === activePanel ? 'bg-[#4a5d23]/10 text-[#4a5d23] font-medium' : 'hover:bg-stone-100'
                  }`}
                  onClick={() => {
                    if (item.panel) setActivePanel(item.panel)
                    setMobileMenuOpen(false)
                  }}
                >
                  {item.label}
                </button>
              )
            )}
          </nav>
        </div>
      )}
    </header>
  )
}

// ============================================
// LEFT ICON SIDEBAR
// ============================================
function IconSidebar() {
  const { activePanel, setActivePanel, userRole } = useShellContext()
  const isAdmin = useIsAdmin()

  // Filter icons based on user role, then append the admin entry for admins.
  const visibleIcons = SIDEBAR_ICONS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )
  const icons = isAdmin ? [...visibleIcons, ADMIN_SIDEBAR_ICON] : visibleIcons

  return (
    <aside className="w-24 flex flex-col items-center py-4 px-1.5 justify-evenly border-r border-stone-200/50 bg-white flex-shrink-0">
      {icons.map(({ panel, href, icon: Icon, label }) => {
        // href entries (Admin) navigate to a server-gated route via Link.
        if (href) {
          return (
            <Link
              key={label}
              href={href}
              data-testid="sidebar-admin"
              className="flex flex-col items-center gap-1 px-1.5 py-2 rounded-xl transition-all duration-200 ease-out transform-gpu origin-center group relative w-full hover:scale-[1.08] text-[#4a5d23] hover:bg-[#4a5d23]/10 hover:shadow-sm"
              title={label}
            >
              <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-[11px] leading-tight text-center break-words w-full font-medium text-[#4a5d23]">
                {label}
              </span>
            </Link>
          )
        }
        // A sidebar entry is active when the resolved activePanel matches its panel.
        // Since aliases ('forms', 'messages') resolve to parent panels, the parent
        // entry lights up correctly without special-casing here.
        const isActive = activePanel === panel
        return (
          <button
            key={panel}
            data-testid={`sidebar-${panel}`}
            onClick={() => panel && setActivePanel(panel)}
            // Hover expansion uses a transform scale (not font-size/padding) so the
            // segment + title grow together without reflowing the justify-evenly stack —
            // a low-vision affordance that keeps the layout stable. transform-gpu +
            // origin-center keep the growth centered and smooth.
            className={`flex flex-col items-center gap-1 px-1.5 py-2 rounded-xl transition-all duration-200 ease-out transform-gpu origin-center group relative w-full hover:scale-[1.08] ${
              isActive
                ? 'bg-[#4a5d23] text-white shadow-lg scale-[1.04]'
                : 'hover:bg-stone-100 hover:shadow-sm text-stone-500 hover:text-stone-800'
            }`}
            title={label}
          >
            <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            <span className={`text-[11px] leading-tight text-center break-words w-full ${
              isActive ? 'text-white font-medium' : 'text-stone-700'
            }`}>
              {label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

// ============================================
// WELCOME CARD (Large left card with gauge)
// ============================================
interface WelcomeCardProps {
  userName?: string
  userRole: UserRole
}

function WelcomeCard({ userName = 'User', userRole }: WelcomeCardProps) {
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

  // Honest, role-aware tagline — no fabricated stats. Real impact metrics
  // arrive in a later wave; until then the card welcomes the user warmly.
  const roleTaglines: Record<UserRole, string> = {
    recipient: 'Find the support you need, all in one place.',
    donor: 'Thank you for helping your community.',
    volunteer: 'Thank you for giving your time.',
    agency: 'Manage the people and programs you serve.',
    program: 'Reach the people your program is built for.',
    admin: 'Keep the community safe and supported.',
  }

  const tagline = roleTaglines[userRole]

  return (
    <div className="bg-[#f8f6f1] rounded-xl p-5 border border-stone-200/50 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-stone-800">Welcome back, {userName}!</h3>
        <Leaf className="w-4 h-4 text-[#4a5d23]" />
      </div>
      <p className="text-xs text-stone-400 mb-6">{today}</p>

      <div className="flex-1 flex flex-col justify-center">
        <p className="text-base text-stone-700 leading-relaxed">{tagline}</p>
      </div>
    </div>
  )
}

// ============================================
// METRICS SECTION (Role-Based with Layout)
// ============================================
interface MetricsSectionProps {
  userRole: UserRole
  userName?: string
}

function MetricsSection({ userRole, userName }: MetricsSectionProps) {
  const { setActivePanel } = useShellContext()

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Left Column - Welcome Card (spans full height) */}
      <div className="w-full md:w-[280px] flex-shrink-0">
        <WelcomeCard userName={userName} userRole={userRole} />
      </div>

      {/* Right Column - 2x2 Grid of metric cards */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr">
        {/* Impact overview — real metrics arrive in a later wave. Until then,
            show an honest neutral state rather than fabricated totals. */}
        <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm min-h-[120px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-stone-600">Impact overview</h3>
            <ExternalLink className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-sm text-stone-500">
            Community impact metrics are on the way. Explore resources and the
            community to start making a difference.
          </p>
        </div>

        {/* Quick actions — honest navigation affordance, no fabricated stats. */}
        <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm min-h-[120px] flex flex-col">
          <h3 className="text-sm font-medium text-stone-600 mb-3">Quick links</h3>
          <div className="space-y-2 text-sm">
            <button
              onClick={() => setActivePanel('map')}
              className="text-[#4a5d23] hover:text-[#3d4d1c] font-medium"
            >
              Find resources near you →
            </button>
            <button
              onClick={() => setActivePanel('feed')}
              className="block text-[#4a5d23] hover:text-[#3d4d1c] font-medium"
            >
              Visit the community →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MOBILE BOTTOM NAV
// ============================================

// Short labels for mobile bottom nav — explicit map avoids truncation surprises
// when full labels change (e.g. 'Get Help Finding Resources' → 'Get Help').
const MOBILE_SHORT_LABELS: Record<string, string> = {
  'Overview': 'Home',
  'AI Assistant': 'Assistant',
  'Resource Map': 'Map',
  'Browse Programs': 'Programs',
  'Community & Messages': 'Community',
  'Applications': 'Applications',
  'Documents & Forms': 'Documents',
  'Get Help Finding Resources': 'Get Help',
  'Petitions': 'Petitions',
  'Settings': 'Settings',
}

function MobileBottomNav() {
  const { activePanel, setActivePanel, userRole } = useShellContext()

  const visibleIcons = SIDEBAR_ICONS.filter(
    (item) => (!item.roles || item.roles.includes(userRole)) && item.panel
  ).slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t md:hidden z-50 safe-area-pb">
      <div className="flex justify-around py-2">
        {visibleIcons.map(({ panel, icon: Icon, label }) => {
          const isActive = activePanel === panel
          const shortLabel = MOBILE_SHORT_LABELS[label] ?? label.split(' ')[0]
          return (
            <button
              key={panel}
              onClick={() => panel && setActivePanel(panel)}
              className={`flex flex-col items-center p-2 min-w-[60px] ${
                isActive ? 'text-[#4a5d23]' : 'text-stone-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-1">{shortLabel}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ============================================
// MAIN SHELL COMPONENT
// ============================================
interface FeedShellProps {
  children: React.ReactNode
  isAuthenticated?: boolean
  /** True when the session is anonymous (guest) — shows a persistent browse-as-guest banner. */
  isAnonymous?: boolean
  userName?: string
  userRole?: UserRole
  userFocus?: UserFocus[]
  backgroundImage?: string
  onSignOut?: () => void
}

// Valid panel names for URL hash routing (aliases included for deep-link init)
const VALID_PANELS: PanelType[] = ['overview', 'chat', 'map', 'programs', 'feed', 'applications', 'documents', 'forms', 'settings', 'messages', 'wizard', 'petitions', 'events']

// Resolve a hash value to a panel + optional subtab.
// Alias hashes (#forms, #messages) map to their parent panel + subtab.
function resolveHashToPanel(hash: string): { panel: PanelType; subtab?: string } {
  if (hash in PANEL_ALIASES) {
    return PANEL_ALIASES[hash]
  }
  if (hash && VALID_PANELS.includes(hash as PanelType)) {
    return { panel: hash as PanelType }
  }
  return { panel: 'chat' }
}

// Get panel from URL hash (e.g., #chat -> 'chat')
function getPanelFromHash(): PanelType {
  if (typeof window === 'undefined') return 'chat'
  const hash = window.location.hash.slice(1)
  return resolveHashToPanel(hash).panel
}

export function FeedShell({
  children,
  isAuthenticated = false,
  isAnonymous = false,
  userName,
  userRole: initialRole = 'recipient',
  userFocus: initialFocus = ['food'],
  backgroundImage = '/images/wheat-field-bg.jpg',
  onSignOut,
}: FeedShellProps) {
  const [userRole, setUserRole] = useState<UserRole>(initialRole)
  const [userFocus, setUserFocus] = useState<UserFocus[]>(initialFocus)
  const [panelParams, setPanelParams] = useState<Record<string, unknown>>({})

  // Initialize panel from URL hash (client-side only)
  const [activePanel, setActivePanelState] = useState<PanelType>('chat')
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize from hash on mount — resolve aliases so #forms boots into
  // documents panel with subtab='forms'. Reads window.location (browser API,
  // unavailable during SSR), so setState in effect is the correct idiom here.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.slice(1)
    const resolved = resolveHashToPanel(hash)
    // Initializing panel state from window.location.hash — browser API only
    // available after mount, so setState in effect is the correct idiom here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivePanelState(resolved.panel)
    if (resolved.subtab) {
      setPanelParams((prev) => ({ ...prev, subtab: resolved.subtab }))
    }
    setIsInitialized(true)
  }, [])

  // Alias-aware setActivePanel.
  // - If called with 'forms' or 'messages', resolves to parent panel + sets
  //   panelParams.subtab. Merges into existing panelParams so callers that
  //   pre-set openConversationId (or other params) are not overwritten.
  // - For non-alias panels, sets activePanel directly and pushes hash.
  const setActivePanel = useCallback((panel: PanelType) => {
    if (panel in PANEL_ALIASES) {
      const { panel: parent, subtab } = PANEL_ALIASES[panel]
      logger.info('nav.alias.resolve', { input: panel, panel: parent, subtab })
      setActivePanelState(parent)
      // Functional update merges — preserves any existing params (e.g. openConversationId)
      setPanelParams((prev) => ({ ...prev, subtab }))
      if (typeof window !== 'undefined') {
        const newHash = `#${panel}`
        if (window.location.hash !== newHash) {
          window.history.pushState(null, '', newHash)
        }
      }
    } else {
      setActivePanelState(panel)
      if (typeof window !== 'undefined') {
        const newHash = `#${panel}`
        if (window.location.hash !== newHash) {
          window.history.pushState(null, '', newHash)
        }
      }
    }
  }, [])

  // Listen for browser back/forward (hashchange event).
  // Alias hashes resolve to parent panel + subtab.
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      const resolved = resolveHashToPanel(hash)
      setActivePanelState(resolved.panel)
      if (resolved.subtab) {
        setPanelParams((prev) => ({ ...prev, subtab: resolved.subtab }))
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Memoize context value so consumers only re-render when relevant state changes.
  // setActivePanel and setPanelParams are stable (useCallback/useState) so this
  // memo recomputes only on real state transitions.
  const shellValue = useMemo<ShellContextType>(() => ({
    activePanel,
    setActivePanel,
    userRole,
    setUserRole,
    userFocus,
    setUserFocus,
    panelParams,
    setPanelParams,
  }), [activePanel, setActivePanel, userRole, setUserRole, userFocus, setUserFocus, panelParams, setPanelParams])

  return (
    <ShellContext.Provider value={shellValue}>
      {/* Full-screen nature background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Main layout container - Two separate floating cards with gap */}
      <div className="relative min-h-screen flex flex-col p-4 md:p-8 gap-4 md:gap-6 overflow-y-auto">
        {/* CONTAINER 1: Interactive Content (Header + Sidebar + Content Panel) */}
        <div className="w-full max-w-7xl mx-auto bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 'max(400px, calc(100vh - 250px))' }}>
          {/* Top Navigation - Fixed */}
          <TopNav isAuthenticated={isAuthenticated} userName={userName} onSignOut={onSignOut} />

          {/* Guest banner — persistent for anonymous sessions */}
          {isAnonymous && (
            <div
              className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm"
              data-testid="guest-banner"
            >
              <span className="text-stone-700 font-medium">
                Browsing as guest — your info isn&apos;t saved
              </span>
              <Link
                href="/signup"
                className="flex-shrink-0 text-lime-700 font-semibold underline hover:text-lime-900 text-xs"
                data-testid="guest-banner-signup-link"
              >
                Create free account
              </Link>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Icon Sidebar - Desktop Only */}
            <div className="hidden md:flex">
              <IconSidebar />
            </div>

            {/* Interactive Content Panel */}
            <div className="flex-1 px-6 pt-6 pb-0 overflow-y-auto">
              <div className="bg-[#faf9f6] rounded-2xl border border-stone-200/50 p-6 shadow-sm h-full flex flex-col">
                {children}
              </div>
            </div>
          </div>
        </div>

        {/* CONTAINER 2: Metrics Dashboard (Separate floating card) */}
        <div className="w-full max-w-7xl mx-auto bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex">
            {/* Left Icon Sidebar continuation - Desktop Only (visual continuity) */}
            <div className="hidden md:flex w-24 flex-shrink-0 border-r border-stone-200/50 bg-white items-center justify-center py-4">
              <div className="w-8 h-8 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#4a5d23]" />
              </div>
            </div>

            {/* Metrics Section */}
            <div className="flex-1 p-6">
              <MetricsSection userRole={userRole} userName={userName} />
            </div>
          </div>
        </div>

        {/* Spacer for mobile bottom nav */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </ShellContext.Provider>
  )
}

// ============================================
// CONTENT PANEL WRAPPER
// ============================================
interface ContentPanelProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export function ContentPanel({ children, title, subtitle }: ContentPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h1 className="text-2xl font-bold text-stone-800">{title}</h1>}
          {subtitle && <p className="text-stone-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  )
}

// Re-export context for use in content panels
export { ShellContext as PanelContext }
