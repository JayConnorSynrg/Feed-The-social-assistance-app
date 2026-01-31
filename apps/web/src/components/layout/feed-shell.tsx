'use client'

// apps/web/src/components/layout/feed-shell.tsx
// New FEED layout with floating card design over nature background
// Based on concept: Single-page app with persistent shell and dynamic content area

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
} from 'lucide-react'

// ============================================
// CONTEXT: Panel Navigation State
// ============================================
type PanelType = 'chat' | 'map' | 'feed' | 'applications' | 'documents' | 'forms' | 'settings' | 'overview'

interface PanelContextType {
  activePanel: PanelType
  setActivePanel: (panel: PanelType) => void
}

const PanelContext = createContext<PanelContextType>({
  activePanel: 'chat',
  setActivePanel: () => {},
})

export const usePanelContext = () => useContext(PanelContext)

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

const SIDEBAR_ICONS: { panel: PanelType; icon: React.ElementType; label: string }[] = [
  { panel: 'overview', icon: Home, label: 'Overview' },
  { panel: 'chat', icon: MessageSquare, label: 'AI Assistant' },
  { panel: 'map', icon: Map, label: 'Resource Map' },
  { panel: 'feed', icon: Newspaper, label: 'Community Feed' },
  { panel: 'applications', icon: ClipboardList, label: 'Applications' },
  { panel: 'documents', icon: FolderOpen, label: 'Documents' },
  { panel: 'forms', icon: FileText, label: 'Forms' },
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
    <header className="h-16 flex items-center justify-between px-6 border-b border-stone-200/50 bg-white">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-sm">F</span>
        </div>
        <span className="font-semibold text-foreground hidden sm:inline">FEED</span>
      </Link>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {TOP_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
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
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Welcome, {userName}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/20" />
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors hidden sm:inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
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
          className="md:hidden p-2 hover:bg-muted rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-card border-b shadow-lg md:hidden z-50">
          <nav className="flex flex-col p-4 gap-2">
            {TOP_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm py-2 px-4 rounded-lg hover:bg-muted"
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
  const { activePanel, setActivePanel } = usePanelContext()

  return (
    <aside className="w-14 flex flex-col items-center py-4 gap-2 border-r border-stone-200/50 bg-white">
      {SIDEBAR_ICONS.map(({ panel, icon: Icon, label }) => {
        const isActive = activePanel === panel
        return (
          <button
            key={panel}
            onClick={() => setActivePanel(panel)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title={label}
          >
            <Icon className="w-5 h-5" />
            {/* Tooltip */}
            <span className="absolute left-14 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

// ============================================
// BOTTOM STATS ROW
// ============================================
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; positive: boolean }
  chart?: 'line' | 'ring' | 'bar'
  progress?: number
}

function StatCard({ title, value, subtitle, icon: Icon, trend, chart, progress }: StatCardProps) {
  return (
    <div className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 flex-1 min-w-[200px] shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
        </div>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold">{value}</p>
          {trend && (
            <p className={`text-xs ${trend.positive ? 'text-green-500' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>

        {/* Mini Chart Placeholder */}
        {chart === 'ring' && progress !== undefined && (
          <div className="w-12 h-12 relative">
            <svg className="w-12 h-12 -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted/20"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${progress * 1.25} 125`}
                className="text-primary"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {progress}%
            </span>
          </div>
        )}

        {chart === 'line' && (
          <div className="flex items-end gap-0.5 h-8">
            {[40, 65, 45, 70, 55, 80, 60].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-primary/60 rounded-full"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}

        {chart === 'bar' && (
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress || 0}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function BottomStatsRow() {
  return (
    <div className="flex gap-4 p-4 overflow-x-auto">
      <StatCard
        title="Welcome back, User!"
        subtitle="26 Jan, 2026"
        value="48%"
        icon={TrendingUp}
        chart="line"
        trend={{ value: 12, positive: true }}
      />
      <StatCard
        title="Impact overview"
        value="1,540"
        subtitle="Active community members"
        icon={Users}
        trend={{ value: 8, positive: true }}
      />
      <StatCard
        title="Applications progress"
        value="33%"
        icon={Target}
        chart="ring"
        progress={33}
      />
      <StatCard
        title="Your contribution"
        value="12"
        subtitle="Actions completed"
        icon={Award}
        chart="bar"
        progress={75}
      />
    </div>
  )
}

// ============================================
// MOBILE BOTTOM NAV
// ============================================
function MobileBottomNav() {
  const { activePanel, setActivePanel } = usePanelContext()

  const mobileItems = SIDEBAR_ICONS.slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t md:hidden z-50 safe-area-pb">
      <div className="flex justify-around py-2">
        {mobileItems.map(({ panel, icon: Icon, label }) => {
          const isActive = activePanel === panel
          return (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              className={`flex flex-col items-center p-2 min-w-[60px] ${
                isActive ? 'text-primary' : 'text-muted-foreground'
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
  backgroundImage?: string
}

export function FeedShell({
  children,
  isAuthenticated = false,
  userName,
  backgroundImage = '/images/wheat-field-bg.jpg',
}: FeedShellProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('chat')
  const pathname = usePathname()

  // Sync URL to panel state
  React.useEffect(() => {
    const panelFromPath = pathname.split('/')[1] as PanelType
    if (SIDEBAR_ICONS.some((item) => item.panel === panelFromPath)) {
      setActivePanel(panelFromPath)
    }
  }, [pathname])

  return (
    <PanelContext.Provider value={{ activePanel, setActivePanel }}>
      {/* Full-screen nature background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      />

      {/* Floating card container */}
      <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-7xl bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* Top Navigation */}
          <TopNav isAuthenticated={isAuthenticated} userName={userName} />

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Icon Sidebar - Desktop Only */}
            <div className="hidden md:block">
              <IconSidebar />
            </div>

            {/* Center Content Panel */}
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>

          {/* Bottom Stats Row - Desktop */}
          <div className="hidden md:block border-t border-stone-200/50 bg-[#faf9f6]">
            <BottomStatsRow />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </PanelContext.Provider>
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
          {title && <h1 className="text-2xl font-bold">{title}</h1>}
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  )
}

// Re-export context hook for use in content panels
export { PanelContext }
