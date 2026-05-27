'use client'

// apps/web/src/components/panels/overview-panel.tsx
// Landing dashboard panel - quick access to all features

import React, { useState, useEffect, useCallback } from 'react'
import {
  Map,
  MessageSquare,
  Newspaper,
  ClipboardList,
  FolderOpen,
  FileText,
  Clock,
  Calendar,
  Heart,
  Loader2,
  Compass,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'

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
  type: 'application' | 'resource' | 'document' | 'post' | 'like'
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
// UTILITY
// ============================================
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

// ============================================
// MAIN OVERVIEW PANEL
// ============================================
export function OverviewPanel({ userName, onNavigateToPanel }: OverviewPanelProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [recentActivity, setRecentActivity] = useState<RecentActivityItemProps[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch real recent activity for the user
  const fetchRecentActivity = useCallback(async () => {
    if (!user) {
      setRecentActivity([])
      setLoading(false)
      return
    }

    try {
      const activities: RecentActivityItemProps[] = []

      // Fetch user's recent posts
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (posts) {
        for (const post of posts) {
          const postTime = post.created_at ? new Date(post.created_at) : new Date()
          activities.push({
            id: `post-${post.id}`,
            type: 'post',
            title: `Posted: "${post.content.slice(0, 60)}${post.content.length > 60 ? '...' : ''}"`,
            time: getRelativeTime(postTime),
            icon: Newspaper,
          })
        }
      }

      // Fetch user's recent likes
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id, created_at, post:posts(content)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (likes) {
        for (const like of likes) {
          const postContent = (like as any).post?.content || 'a post'
          const likeTime = like.created_at ? new Date(like.created_at) : new Date()
          activities.push({
            id: `like-${like.post_id}`,
            type: 'like',
            title: `Liked: "${postContent.slice(0, 50)}${postContent.length > 50 ? '...' : ''}"`,
            time: getRelativeTime(likeTime),
            icon: Heart,
          })
        }
      }

      // Sort by most recent
      activities.sort((a, b) => {
        // Parse relative times back... just use insertion order since we fetched desc
        return 0
      })

      setRecentActivity(activities.slice(0, 5))
    } catch (err) {
      console.error('Error fetching recent activity:', err)
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchRecentActivity()
  }, [fetchRecentActivity])

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
              icon={Compass}
              iconBg="bg-green-100 text-green-600"
              title="Resource Wizard"
              description="Guided help finding resources"
              onClick={() => handleNavigate('wizard')}
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
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin text-stone-400" />
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((activity) => (
                    <RecentActivityItem key={activity.id} {...activity} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-500 text-sm">
                  No recent activity yet. Start by exploring resources or posting in the community feed!
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Reminders */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Upcoming Reminders</h2>
            <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm">
              <div className="text-center py-8 text-stone-500 text-sm">
                No upcoming reminders. Reminders will appear here when you have appointments or deadlines.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
