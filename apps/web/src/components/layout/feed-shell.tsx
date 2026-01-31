'use client'

// apps/web/src/components/layout/feed-shell.tsx
// New FEED layout with floating card design over nature background
// Based on concept: Single-page app with persistent shell and dynamic content area
// V2: Separated interactive area from metrics, role-based content visibility

import React, { useState, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  Map,
  Newspaper,
  FileText,
  FolderOpen,
  ClipboardList,
  Settings,
  Home,
  ChevronDown,
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

type PanelType = 'chat' | 'map' | 'feed' | 'applications' | 'documents' | 'forms' | 'settings' | 'overview'

interface ShellContextType {
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void
  userRole: UserRole
  setUserRole: (role: UserRole) => void
  userFocus: UserFocus[]
  setUserFocus: (focus: UserFocus[]) => void
}

const ShellContext = createContext<ShellContextType>({
  activePanel: 'chat',
  setActivePanel: () => {},
  userRole: 'recipient',
  setUserRole: () => {},
  userFocus: ['food'],
  setUserFocus: () => {},
})

export const useShellContext = () => useContext(ShellContext)
// Legacy export for backwards compatibility
export const usePanelContext = () => {
  const { activePanel, setActivePanel } = useContext(ShellContext)
  return { activePanel, setActivePanel }
}

// ============================================
// NAVIGATION CONFIG
// ============================================
const TOP_NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/mission', label: 'Our mission', hasDropdown: true },
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Resources' },
]

const SIDEBAR_ICONS: { panel: PanelType; icon: React.ElementType; label: string; roles?: UserRole[] }[] = [
  { panel: 'overview', icon: Home, label: 'Overview' },
  { panel: 'chat', icon: MessageSquare, label: 'AI Assistant' },
  { panel: 'map', icon: Map, label: 'Resource Map' },
  { panel: 'feed', icon: Newspaper, label: 'Community Feed' },
  { panel: 'applications', icon: ClipboardList, label: 'Applications', roles: ['recipient', 'agency', 'program'] },
  { panel: 'documents', icon: FolderOpen, label: 'Documents', roles: ['recipient', 'agency', 'program'] },
  { panel: 'forms', icon: FileText, label: 'Forms', roles: ['recipient', 'agency', 'program'] },
  { panel: 'settings', icon: Settings, label: 'Settings' },
]

// ============================================
// TOP NAVIGATION BAR
// ============================================
interface TopNavProps {
  isAuthenticated?: boolean
  userName?: string
}

function TopNav({ isAuthenticated = false, userName }: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-stone-200/50 bg-white flex-shrink-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[#4a5d23]/20 flex items-center justify-center">
          <span className="text-[#4a5d23] font-bold text-sm">F</span>
        </div>
        <span className="font-semibold text-stone-800 hidden sm:inline">FEED</span>
      </Link>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {TOP_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors flex items-center gap-1"
          >
            {item.label}
            {item.hasDropdown && <ChevronDown className="w-3 h-3" />}
          </Link>
        ))}
      </nav>

      {/* Auth Buttons */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-500 hidden sm:inline">
              Welcome, {userName}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#4a5d23]/20" />
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors hidden sm:inline-flex items-center gap-2 text-stone-700"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-lg bg-[#4a5d23] text-white hover:bg-[#3d4d1c] transition-colors inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
              <span className="hidden sm:inline">→</span>
            </Link>
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
              <Link
                key={item.href}
                href={item.href}
                className="text-sm py-2 px-4 rounded-lg hover:bg-stone-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
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
    <aside className="w-14 flex flex-col items-center py-4 gap-2 border-r border-stone-200/50 bg-white flex-shrink-0">
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
    <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm">
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
// METRICS SECTION (Role-Based)
// ============================================
interface MetricsSectionProps {
  userRole: UserRole
  userFocus: UserFocus[]
}

function MetricsSection({ userRole, userFocus }: MetricsSectionProps) {
  // Define all available metric tiles with role/focus visibility
  const allMetrics: MetricTileProps[] = [
    // RECIPIENT METRICS
    {
      title: 'Welcome back!',
      subtitle: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      value: '48%',
      icon: TrendingUp,
      chart: 'line',
      trend: { value: 12, positive: true },
      roles: ['recipient'],
    },
    {
      title: 'Applications progress',
      value: '33%',
      icon: Target,
      chart: 'ring',
      progress: 33,
      action: { label: 'View applications', href: '/?panel=applications' },
      roles: ['recipient'],
    },
    {
      title: 'Resources saved',
      value: '12',
      subtitle: 'Near your location',
      icon: Heart,
      chart: 'bar',
      progress: 75,
      roles: ['recipient'],
    },

    // DONOR METRICS
    {
      title: 'Your donations',
      subtitle: 'This month',
      value: '23',
      icon: HandHeart,
      chart: 'line',
      trend: { value: 18, positive: true },
      roles: ['donor'],
    },
    {
      title: 'Meals provided',
      value: '156',
      subtitle: 'Through your contributions',
      icon: Utensils,
      trend: { value: 24, positive: true },
      roles: ['donor'],
    },
    {
      title: 'Impact score',
      value: '89%',
      icon: Award,
      chart: 'ring',
      progress: 89,
      roles: ['donor'],
    },

    // VOLUNTEER METRICS
    {
      title: 'Hours volunteered',
      value: '48',
      subtitle: 'This month',
      icon: Users,
      trend: { value: 15, positive: true },
      roles: ['volunteer'],
    },
    {
      title: 'Events joined',
      value: '7',
      icon: Target,
      action: { label: 'Find events', href: '/?panel=feed' },
      roles: ['volunteer'],
    },

    // AGENCY/PROGRAM METRICS
    {
      title: 'Active clients',
      value: '1,540',
      icon: Users,
      trend: { value: 8, positive: true },
      roles: ['agency', 'program'],
    },
    {
      title: 'Applications received',
      value: '89',
      subtitle: 'This week',
      icon: ClipboardList,
      trend: { value: 12, positive: true },
      roles: ['agency', 'program'],
    },
    {
      title: 'Processing time',
      value: '2.3d',
      subtitle: 'Average',
      icon: TrendingUp,
      chart: 'bar',
      progress: 65,
      roles: ['agency', 'program'],
    },

    // COMMUNITY METRICS (visible to all)
    {
      title: 'Community impact',
      value: '12,480',
      subtitle: 'People helped this year',
      icon: Leaf,
      trend: { value: 33, positive: true },
    },
    {
      title: 'Resources available',
      value: '324',
      subtitle: 'In your area',
      icon: Building2,
      action: { label: 'Browse map', href: '/?panel=map' },
    },
    {
      title: 'Active programs',
      value: '47',
      icon: Package,
    },
  ]

  // Filter metrics based on role and focus
  const visibleMetrics = allMetrics.filter((metric) => {
    // If no roles specified, show to everyone
    if (!metric.roles) return true
    // Check if user's role matches
    return metric.roles.includes(userRole)
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {visibleMetrics.map((metric, index) => (
        <MetricTile key={index} {...metric} />
      ))}
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
}

export function FeedShell({
  children,
  isAuthenticated = false,
  userName,
  userRole: initialRole = 'recipient',
  userFocus: initialFocus = ['food'],
  backgroundImage = '/images/wheat-field-bg.jpg',
}: FeedShellProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('chat')
  const [userRole, setUserRole] = useState<UserRole>(initialRole)
  const [userFocus, setUserFocus] = useState<UserFocus[]>(initialFocus)
  const pathname = usePathname()

  // Sync URL to panel state
  React.useEffect(() => {
    const panelFromPath = pathname.split('/')[1] as PanelType
    if (SIDEBAR_ICONS.some((item) => item.panel === panelFromPath)) {
      setActivePanel(panelFromPath)
    }
  }, [pathname])

  return (
    <ShellContext.Provider value={{
      activePanel,
      setActivePanel,
      userRole,
      setUserRole,
      userFocus,
      setUserFocus
    }}>
      {/* Full-screen nature background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Floating card container */}
      <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-7xl bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* Top Navigation - Fixed */}
          <TopNav isAuthenticated={isAuthenticated} userName={userName} />

          {/* Main Content Area - Scrollable */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Icon Sidebar - Desktop Only */}
            <div className="hidden md:block">
              <IconSidebar />
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto">
              {/* Interactive Content Panel - Separate bordered area */}
              <div className="p-6">
                <div className="bg-[#faf9f6] rounded-2xl border border-stone-200/50 p-6 shadow-sm">
                  {children}
                </div>
              </div>

              {/* Metrics Section - Below interactive area */}
              <div className="px-6 pb-6">
                <div className="mb-4">
                  <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
                    {userRole === 'donor' ? 'Your Impact' :
                     userRole === 'agency' || userRole === 'program' ? 'Program Metrics' :
                     'Your Progress & Community'}
                  </h2>
                </div>
                <MetricsSection userRole={userRole} userFocus={userFocus} />
              </div>
            </div>
          </div>
        </div>
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
