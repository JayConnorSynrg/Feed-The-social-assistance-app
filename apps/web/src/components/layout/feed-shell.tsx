'use client'

// apps/web/src/components/layout/feed-shell.tsx
// New FEED layout with floating card design over nature background
// Based on concept: Single-page app with persistent shell and dynamic content area
// V2: Separated interactive area from metrics, role-based content visibility

import React, { useState, createContext, useContext, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { VolunteerResourceFAB } from '@/components/volunteer/volunteer-resource-fab'
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
  Users,
  Target,
  Award,
  Heart,
  Package,
  Building2,
  Leaf,
  HandHeart,
  Utensils,
  ExternalLink,
} from 'lucide-react'

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

type PanelType = 'chat' | 'map' | 'feed' | 'applications' | 'documents' | 'forms' | 'settings' | 'overview' | 'messages'

interface ShellContextType {
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void
  userRole: UserRole
  setUserRole: (role: UserRole) => void
  userFocus: UserFocus[]
  setUserFocus: (focus: UserFocus[]) => void
  panelParams: Record<string, unknown>
  setPanelParams: (params: Record<string, unknown>) => void
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
const TOP_NAV_ITEMS: { label: string; panel?: PanelType; href?: string }[] = [
  { label: 'Home', panel: 'overview' },
  { label: 'AI Assistant', panel: 'chat' },
  { label: 'Resources', panel: 'map' },
  { label: 'Community', panel: 'feed' },
]

const SIDEBAR_ICONS: { panel: PanelType; icon: React.ElementType; label: string; roles?: UserRole[] }[] = [
  { panel: 'overview', icon: Home, label: 'Overview' },
  { panel: 'chat', icon: MessageSquare, label: 'AI Assistant' },
  { panel: 'map', icon: Map, label: 'Resource Map' },
  { panel: 'feed', icon: Newspaper, label: 'Community Feed' },
  { panel: 'applications', icon: ClipboardList, label: 'Applications', roles: ['recipient', 'agency', 'program'] },
  { panel: 'documents', icon: FolderOpen, label: 'Documents', roles: ['recipient', 'agency', 'program'] },
  { panel: 'forms', icon: FileText, label: 'Forms', roles: ['recipient', 'agency', 'program'] },
  { panel: 'messages' as PanelType, icon: MessageSquare, label: 'Messages' },
  { panel: 'settings', icon: Settings, label: 'Settings' },
]

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
        {TOP_NAV_ITEMS.map((item) => (
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
        ))}
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
                onClick={onSignOut}
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
            {TOP_NAV_ITEMS.map((item) => (
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
            ))}
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

  // Filter icons based on user role
  const visibleIcons = SIDEBAR_ICONS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  return (
    <aside className="w-14 flex flex-col items-center py-4 justify-evenly border-r border-stone-200/50 bg-white flex-shrink-0">
      {visibleIcons.map(({ panel, icon: Icon, label }) => {
        const isActive = activePanel === panel
        return (
          <button
            key={panel}
            onClick={() => setActivePanel(panel)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
              isActive
                ? 'bg-[#4a5d23] text-white shadow-lg'
                : 'hover:bg-stone-100 text-stone-500 hover:text-stone-800'
            }`}
            title={label}
          >
            <Icon className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute left-14 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

// ============================================
// METRIC TILE COMPONENT
// ============================================
interface MetricTileProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; positive: boolean }
  chart?: 'line' | 'ring' | 'bar'
  progress?: number
  action?: { label: string; href: string }
  roles?: UserRole[]
  focus?: UserFocus[]
}

function MetricTile({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  chart,
  progress,
  action
}: MetricTileProps) {
  return (
    <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm min-h-[120px] flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-stone-600">{title}</h3>
          {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
        </div>
        <Icon className="w-4 h-4 text-stone-400" />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-stone-800">{value}</p>
          {trend && (
            <p className={`text-xs ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>

        {/* Mini Chart */}
        {chart === 'ring' && progress !== undefined && (
          <div className="w-12 h-12 relative">
            <svg className="w-12 h-12 -rotate-90">
              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-stone-200" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${progress * 1.25} 125`} className="text-[#4a5d23]" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-stone-700">
              {progress}%
            </span>
          </div>
        )}

        {chart === 'line' && (
          <div className="flex items-end gap-0.5 h-8">
            {[40, 65, 45, 70, 55, 80, 60].map((h, i) => (
              <div key={i} className="w-1 bg-[#4a5d23]/60 rounded-full" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}

        {chart === 'bar' && (
          <div className="w-20 h-2 bg-stone-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#4a5d23] rounded-full" style={{ width: `${progress || 0}%` }} />
          </div>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className="mt-3 text-xs text-[#4a5d23] hover:underline inline-flex items-center gap-1"
        >
          {action.label} <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
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

  // Different messaging based on role
  const roleLabels: Record<UserRole, { title: string; metric: string }> = {
    recipient: { title: 'Our community impact', metric: '48%' },
    donor: { title: 'Your giving impact', metric: '89%' },
    volunteer: { title: 'Your volunteer impact', metric: '72%' },
    agency: { title: 'Client outcomes', metric: '65%' },
    program: { title: 'Program effectiveness', metric: '78%' },
    admin: { title: 'Platform health', metric: '94%' },
  }

  const { title, metric } = roleLabels[userRole]

  return (
    <div className="bg-[#f8f6f1] rounded-xl p-5 border border-stone-200/50 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-stone-800">Welcome back, {userName}!</h3>
        <ExternalLink className="w-4 h-4 text-stone-400" />
      </div>
      <p className="text-xs text-stone-400 mb-4">{today}</p>

      <p className="text-sm text-stone-600 mb-2">{title}</p>

      {/* Large percentage with mini line chart */}
      <div className="flex-1 flex items-end justify-between">
        <div>
          <p className="text-5xl font-bold text-stone-800">{metric}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 bg-[#4a5d23] text-white text-xs rounded font-medium">High</span>
            <div className="flex items-center text-xs text-stone-500">
              <span className="w-8 h-px bg-stone-300 mr-1"></span>
              60
            </div>
          </div>
        </div>

        {/* Mini sparkline chart */}
        <div className="flex items-end gap-1 h-16">
          {[30, 45, 35, 55, 40, 65, 50, 70, 55, 75, 60, 80].map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-[#4a5d23]/40 rounded-full"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// METRICS SECTION (Role-Based with Layout)
// ============================================
interface MetricsSectionProps {
  userRole: UserRole
  userFocus: UserFocus[]
  userName?: string
}

function MetricsSection({ userRole, userFocus, userName }: MetricsSectionProps) {
  // Top row metrics (Impact overview style)
  const topRowMetrics: Record<UserRole, MetricTileProps[]> = {
    recipient: [
      {
        title: 'Impact overview',
        value: '',
        icon: ExternalLink,
        roles: ['recipient'],
      },
      {
        title: 'Applications progress',
        value: '33%',
        icon: Target,
        chart: 'ring',
        progress: 33,
        roles: ['recipient'],
      },
    ],
    donor: [
      {
        title: 'Impact overview',
        value: '',
        icon: ExternalLink,
        roles: ['donor'],
      },
      {
        title: 'Tax deductions',
        value: '$2,450',
        icon: Award,
        chart: 'ring',
        progress: 75,
        roles: ['donor'],
      },
    ],
    volunteer: [
      {
        title: 'Impact overview',
        value: '',
        icon: ExternalLink,
        roles: ['volunteer'],
      },
      {
        title: 'Hours this month',
        value: '48',
        icon: Target,
        chart: 'ring',
        progress: 80,
        roles: ['volunteer'],
      },
    ],
    agency: [
      {
        title: 'Impact overview',
        value: '',
        icon: ExternalLink,
        roles: ['agency'],
      },
      {
        title: 'Processing rate',
        value: '89%',
        icon: Target,
        chart: 'ring',
        progress: 89,
        roles: ['agency'],
      },
    ],
    program: [
      {
        title: 'Impact overview',
        value: '',
        icon: ExternalLink,
        roles: ['program'],
      },
      {
        title: 'Approval rate',
        value: '72%',
        icon: Target,
        chart: 'ring',
        progress: 72,
        roles: ['program'],
      },
    ],
    admin: [
      {
        title: 'System health',
        value: '',
        icon: ExternalLink,
        roles: ['admin'],
      },
      {
        title: 'Uptime',
        value: '99.9%',
        icon: Target,
        chart: 'ring',
        progress: 99,
        roles: ['admin'],
      },
    ],
  }

  // Bottom row metrics (Contribution style)
  const bottomRowMetrics: Record<UserRole, MetricTileProps[]> = {
    recipient: [
      {
        title: 'Resources accessed',
        subtitle: 'this week',
        value: '7%',
        icon: TrendingUp,
        chart: 'bar',
        progress: 7,
        roles: ['recipient'],
      },
      {
        title: 'Your contribution',
        value: '',
        subtitle: 'Events joined: 12\nArticles read: 6\nActions completed: 83',
        icon: Award,
        roles: ['recipient'],
      },
    ],
    donor: [
      {
        title: 'Meals provided',
        subtitle: 'this month',
        value: '156',
        icon: Utensils,
        chart: 'bar',
        progress: 65,
        roles: ['donor'],
      },
      {
        title: 'Your contribution',
        value: '',
        subtitle: 'Donations: 23\nFood drives: 4\nVolunteer hours: 12',
        icon: HandHeart,
        roles: ['donor'],
      },
    ],
    volunteer: [
      {
        title: 'People helped',
        subtitle: 'this month',
        value: '34',
        icon: Users,
        chart: 'bar',
        progress: 55,
        roles: ['volunteer'],
      },
      {
        title: 'Your contribution',
        value: '',
        subtitle: 'Events: 7\nHours: 48\nImpact score: 89',
        icon: Award,
        roles: ['volunteer'],
      },
    ],
    agency: [
      {
        title: 'Clients served',
        subtitle: 'this week',
        value: '89',
        icon: Users,
        chart: 'bar',
        progress: 72,
        roles: ['agency'],
      },
      {
        title: 'Program metrics',
        value: '',
        subtitle: 'Applications: 156\nApproved: 89\nPending: 34',
        icon: ClipboardList,
        roles: ['agency'],
      },
    ],
    program: [
      {
        title: 'Applications processed',
        subtitle: 'this week',
        value: '234',
        icon: ClipboardList,
        chart: 'bar',
        progress: 82,
        roles: ['program'],
      },
      {
        title: 'Program metrics',
        value: '',
        subtitle: 'Approved: 189\nDenied: 23\nPending: 45',
        icon: Target,
        roles: ['program'],
      },
    ],
    admin: [
      {
        title: 'Active users',
        subtitle: 'today',
        value: '1,234',
        icon: Users,
        chart: 'bar',
        progress: 78,
        roles: ['admin'],
      },
      {
        title: 'Platform metrics',
        value: '',
        subtitle: 'Errors: 0\nLatency: 45ms\nLoad: 23%',
        icon: TrendingUp,
        roles: ['admin'],
      },
    ],
  }

  // Impact overview list items based on role
  const impactItems: Record<UserRole, { label: string; value: string }[]> = {
    recipient: [
      { label: 'Trees planted', value: '12,480' },
      { label: 'Waste reduced', value: '320 tons' },
      { label: 'Active volunteers', value: '1,540' },
      { label: 'Projects supported', value: '38' },
    ],
    donor: [
      { label: 'Meals funded', value: '45,230' },
      { label: 'Families helped', value: '2,340' },
      { label: 'Food rescued (lbs)', value: '12,500' },
      { label: 'Partner agencies', value: '47' },
    ],
    volunteer: [
      { label: 'Total volunteer hours', value: '8,450' },
      { label: 'Events completed', value: '156' },
      { label: 'People served', value: '4,230' },
      { label: 'Active volunteers', value: '1,540' },
    ],
    agency: [
      { label: 'Clients served', value: '12,480' },
      { label: 'Applications processed', value: '3,420' },
      { label: 'Resources distributed', value: '8,900' },
      { label: 'Partner programs', value: '23' },
    ],
    program: [
      { label: 'Total applications', value: '15,670' },
      { label: 'Benefits distributed', value: '$2.4M' },
      { label: 'Active recipients', value: '8,920' },
      { label: 'Partner agencies', value: '47' },
    ],
    admin: [
      { label: 'Total users', value: '45,230' },
      { label: 'Daily active', value: '12,480' },
      { label: 'Resources listed', value: '324' },
      { label: 'Transactions', value: '156K' },
    ],
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Left Column - Welcome Card (spans full height) */}
      <div className="w-full md:w-[280px] flex-shrink-0">
        <WelcomeCard userName={userName} userRole={userRole} />
      </div>

      {/* Right Column - 2x2 Grid of metric cards */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-fr">
        {/* Top Left - Impact Overview (list style) */}
        <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm min-h-[120px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-stone-600">Impact overview</h3>
            <ExternalLink className="w-4 h-4 text-stone-400" />
          </div>
          <div className="space-y-2">
            {impactItems[userRole].map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-stone-500">• {item.label}</span>
                <span className="font-medium text-stone-700">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Right - Ring chart metric */}
        <MetricTile {...topRowMetrics[userRole][1]} />

        {/* Bottom Left - Bar chart metric */}
        <MetricTile {...bottomRowMetrics[userRole][0]} />

        {/* Bottom Right - Contribution list */}
        <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm min-h-[120px]">
          <h3 className="text-sm font-medium text-stone-600 mb-3">Your contribution</h3>
          <div className="space-y-2">
            {bottomRowMetrics[userRole][1].subtitle?.split('\n').map((line, i) => {
              const [label, value] = line.split(': ')
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-stone-500">{label}</span>
                  <span className="font-medium text-stone-700">{value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MOBILE BOTTOM NAV
// ============================================
function MobileBottomNav() {
  const { activePanel, setActivePanel, userRole } = useShellContext()

  const visibleIcons = SIDEBAR_ICONS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  ).slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t md:hidden z-50 safe-area-pb">
      <div className="flex justify-around py-2">
        {visibleIcons.map(({ panel, icon: Icon, label }) => {
          const isActive = activePanel === panel
          return (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              className={`flex flex-col items-center p-2 min-w-[60px] ${
                isActive ? 'text-[#4a5d23]' : 'text-stone-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-1">{label.split(' ')[0]}</span>
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
  userName?: string
  userRole?: UserRole
  userFocus?: UserFocus[]
  backgroundImage?: string
  onSignOut?: () => void
}

// Valid panel names for URL hash routing
const VALID_PANELS: PanelType[] = ['overview', 'chat', 'map', 'feed', 'applications', 'documents', 'forms', 'settings', 'messages']

// Get panel from URL hash (e.g., #chat -> 'chat')
function getPanelFromHash(): PanelType {
  if (typeof window === 'undefined') return 'chat'
  const hash = window.location.hash.slice(1) // Remove #
  if (hash && VALID_PANELS.includes(hash as PanelType)) {
    return hash as PanelType
  }
  return 'chat' // Default panel
}

export function FeedShell({
  children,
  isAuthenticated = false,
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

  // Initialize from hash on mount
  useEffect(() => {
    setActivePanelState(getPanelFromHash())
    setIsInitialized(true)
  }, [])

  // Wrapped setActivePanel that also updates URL hash
  const setActivePanel = useCallback((panel: PanelType) => {
    setActivePanelState(panel)
    // Update URL hash without triggering navigation (SPA model)
    if (typeof window !== 'undefined') {
      const newHash = `#${panel}`
      if (window.location.hash !== newHash) {
        window.history.pushState(null, '', newHash)
      }
    }
  }, [])

  // Listen for browser back/forward (hashchange event)
  useEffect(() => {
    const handleHashChange = () => {
      const panelFromHash = getPanelFromHash()
      setActivePanelState(panelFromHash)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return (
    <ShellContext.Provider value={{
      activePanel,
      setActivePanel,
      userRole,
      setUserRole,
      userFocus,
      setUserFocus,
      panelParams,
      setPanelParams,
    }}>
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
            <div className="hidden md:flex w-14 flex-shrink-0 border-r border-stone-200/50 bg-white items-center justify-center py-4">
              <div className="w-8 h-8 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#4a5d23]" />
              </div>
            </div>

            {/* Metrics Section */}
            <div className="flex-1 p-6">
              <MetricsSection userRole={userRole} userFocus={userFocus} userName={userName} />
            </div>
          </div>
        </div>

        {/* Spacer for mobile bottom nav */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      <VolunteerResourceFAB />
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
