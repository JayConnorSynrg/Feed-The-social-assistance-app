'use client'

// apps/web/src/components/dashboard/dashboard-layout.tsx
// Main dashboard layout with sidebar navigation and stats overview

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Navigation items
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/applications', label: 'My Applications', icon: '📋' },
  { href: '/documents', label: 'Documents', icon: '📁' },
  { href: '/forms', label: 'Forms', icon: '📝' },
  { href: '/resources', label: 'Resources', icon: '📍' },
  { href: '/chat', label: 'AI Assistant', icon: '💬' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

interface NavItemProps {
  href: string
  label: string
  icon: string
  isActive: boolean
}

function NavItem({ href, label, icon, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: string
  trend?: { value: number; positive: boolean }
}

export function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span className="text-2xl">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={`text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface DashboardSidebarProps {
  className?: string
}

export function DashboardSidebar({ className = '' }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={`w-64 border-r bg-card p-4 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold px-4">FEED</h2>
        <p className="text-sm text-muted-foreground px-4">Your Benefits Dashboard</p>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
          />
        ))}
      </nav>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium text-sm">Need Help?</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Our AI assistant can help you navigate benefits and resources.
        </p>
        <Link
          href="/chat"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Start a conversation →
        </Link>
      </div>
    </aside>
  )
}

interface DashboardHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function DashboardHeader({ title, description, actions }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen">
      <DashboardSidebar className="hidden md:block" />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}

// Mobile navigation
export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t md:hidden z-50">
      <div className="flex justify-around py-2">
        {NAV_ITEMS.slice(0, 5).map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center p-2 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
