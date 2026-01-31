'use client'

// apps/web/src/components/panels/overview-panel.tsx
// Landing dashboard panel - quick access to all features

import React from 'react'
import {
  Map,
  MessageSquare,
  Newspaper,
  ClipboardList,
  FolderOpen,
  FileText,
  Clock,
  Calendar
} from 'lucide-react'

// ============================================
// INTERFACES
// ============================================
interface OverviewPanelProps {
  userName?: string
  onNavigateToPanel?: (panel: string) => void
}

interface QuickActionCardProps {
  icon: React.ElementType
  iconBg: string
  title: string
  description: string
  onClick?: () => void
}

interface RecentActivityItemProps {
  id: string
  type: 'application' | 'resource' | 'document'
  title: string
  time: string
  icon: React.ElementType
}

interface UpcomingReminderItemProps {
  id: string
  title: string
  date: string
  type: 'appointment' | 'deadline'
}

// ============================================
// MOCK DATA
// ============================================
const MOCK_RECENT_ACTIVITY: RecentActivityItemProps[] = [
  { id: '1', type: 'application', title: 'SNAP Application submitted', time: '2 hours ago', icon: ClipboardList },
  { id: '2', type: 'resource', title: 'Visited Downtown Food Bank', time: 'Yesterday', icon: Map },
  { id: '3', type: 'document', title: 'Uploaded proof of residence', time: '3 days ago', icon: FileText },
]

const MOCK_REMINDERS: UpcomingReminderItemProps[] = [
  { id: '1', title: 'Phone interview scheduled', date: 'Tomorrow, 10:00 AM', type: 'appointment' },
  { id: '2', title: 'Document deadline', date: 'Jan 15, 2026', type: 'deadline' },
]

// ============================================
// WELCOME SECTION
// ============================================
function WelcomeSection({ userName }: { userName?: string }) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-stone-900 mb-1">
        Welcome back, {userName || 'Friend'}!
      </h1>
      <p className="text-sm text-stone-600">
        {currentDate}
      </p>
    </div>
  )
}

// ============================================
// QUICK ACTION CARD
// ============================================
function QuickActionCard({ icon: Icon, iconBg, title, description, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-xl border border-stone-200/50 bg-[#faf9f6] hover:border-[#4a5d23]/50 hover:bg-[#f5f3ee] transition-all text-left group shadow-sm"
    >
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-medium text-sm mb-1 group-hover:text-[#4a5d23] transition-colors">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </button>
  )
}

// ============================================
// RECENT ACTIVITY ITEM
// ============================================
function RecentActivityItem({ title, time, icon: Icon }: RecentActivityItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#f8f6f1] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#4a5d23]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-900 truncate">
          {title}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">
          {time}
        </p>
      </div>
    </div>
  )
}

// ============================================
// UPCOMING REMINDER ITEM
// ============================================
function UpcomingReminderItem({ title, date, type }: UpcomingReminderItemProps) {
  const icon = type === 'appointment' ? Calendar : Clock
  const Icon = icon

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#f8f6f1] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-yellow-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-900 truncate">
          {title}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">
          {date}
        </p>
      </div>
    </div>
  )
}

// ============================================
// MAIN OVERVIEW PANEL
// ============================================
export function OverviewPanel({ userName, onNavigateToPanel }: OverviewPanelProps) {
  const handleNavigate = (panel: string) => {
    if (onNavigateToPanel) {
      onNavigateToPanel(panel)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 py-6">
        {/* Welcome Section */}
        <WelcomeSection userName={userName} />

        {/* Quick Actions Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionCard
              icon={Map}
              iconBg="bg-blue-100 text-blue-600"
              title="Find Resources"
              description="Discover local food banks, housing assistance, healthcare, and more near you."
              onClick={() => handleNavigate('map')}
            />
            <QuickActionCard
              icon={MessageSquare}
              iconBg="bg-purple-100 text-purple-600"
              title="AI Assistant"
              description="Get personalized help finding resources and applying for benefits."
              onClick={() => handleNavigate('chat')}
            />
            <QuickActionCard
              icon={Newspaper}
              iconBg="bg-green-100 text-green-600"
              title="Community Feed"
              description="Stay connected, share ideas, and get support from your community."
              onClick={() => handleNavigate('feed')}
            />
            <QuickActionCard
              icon={ClipboardList}
              iconBg="bg-orange-100 text-orange-600"
              title="My Applications"
              description="Track your benefit applications and see their current status."
              onClick={() => handleNavigate('applications')}
            />
            <QuickActionCard
              icon={FolderOpen}
              iconBg="bg-indigo-100 text-indigo-600"
              title="My Documents"
              description="Securely store and manage your important documents."
              onClick={() => handleNavigate('documents')}
            />
            <QuickActionCard
              icon={FileText}
              iconBg="bg-teal-100 text-teal-600"
              title="Forms & Applications"
              description="Fill out and submit forms for SNAP, Medicaid, and other programs."
              onClick={() => handleNavigate('forms')}
            />
          </div>
        </div>

        {/* Recent Activity & Upcoming Reminders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Recent Activity</h2>
            <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm">
              {MOCK_RECENT_ACTIVITY.length > 0 ? (
                <div className="space-y-2">
                  {MOCK_RECENT_ACTIVITY.map((activity) => (
                    <RecentActivityItem key={activity.id} {...activity} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-500 text-sm">
                  No recent activity yet
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Reminders */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Upcoming Reminders</h2>
            <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm">
              {MOCK_REMINDERS.length > 0 ? (
                <div className="space-y-2">
                  {MOCK_REMINDERS.map((reminder) => (
                    <UpcomingReminderItem key={reminder.id} {...reminder} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-500 text-sm">
                  No upcoming reminders
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
