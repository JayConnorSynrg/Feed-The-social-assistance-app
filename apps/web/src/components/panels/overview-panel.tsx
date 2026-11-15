'use client'

// apps/web/src/components/panels/overview-panel.tsx
// Landing dashboard panel - quick access to all features.
// Every word FEED writes here is in the viewer's language (lib/i18n-overview.ts) and the panel is
// marked with it; the member's name and post excerpts keep their own direction. The date and the
// ages come from lib/i18n-intl.ts and lib/relative-age.ts.

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
  Search,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { overviewT, type OverviewMessages } from '@/lib/i18n-overview'
import { splitMessage } from '@/lib/format-message'
import { dateTimeFormatter } from '@/lib/i18n-intl'
import { relativeAge } from '@/lib/relative-age'
import { browserTimeZone } from '@/lib/event-time'

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
  /** The start of the member's post (posted) or of the post they liked; null when unreadable. */
  excerpt: string | null
  /** When it happened (ISO); shown as an age in the viewer's language. */
  at: string
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
function WelcomeSection({ userName, locale }: { userName?: string; locale: Locale }) {
  const currentDate = dateTimeFormatter(locale, browserTimeZone(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const [before, after] = splitMessage(overviewT(locale, 'welcomeBack'), 'name')

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-stone-900 mb-1">
        {before}
        {/* The member's own name keeps its own direction and takes no page language. */}
        {userName ? <bdi lang="" dir="auto">{userName}</bdi> : overviewT(locale, 'friend')}
        {after}
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
      className="flex flex-col items-start p-4 rounded-xl border border-stone-200/50 bg-[#faf9f6] hover:border-[#4a5d23]/50 hover:bg-[#f5f3ee] transition-all text-start group shadow-sm"
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
function RecentActivityItem({ type, excerpt, at, icon: Icon, locale }: RecentActivityItemProps & { locale: Locale }) {
  const key: keyof OverviewMessages = type === 'post' ? 'activityPosted' : 'activityLiked'
  const [before, after] = splitMessage(overviewT(locale, key), 'excerpt')
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#f8f6f1] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#4a5d23]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-900 truncate">
          {excerpt === null ? (
            overviewT(locale, 'activityLikedPost')
          ) : (
            <>
              {before}
              <bdi lang="" dir="auto">{excerpt}</bdi>
              {after}
            </>
          )}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">
          {relativeAge(at, locale)}
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

/** The start of a post, cut for one line of the activity list. */
function excerptOf(content: string, max: number): string {
  return `${content.slice(0, max)}${content.length > max ? '...' : ''}`
}

// ============================================
// MAIN OVERVIEW PANEL
// ============================================
export function OverviewPanel({ userName, onNavigateToPanel }: OverviewPanelProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [recentActivity, setRecentActivity] = useState<RecentActivityItemProps[]>([])
  const [loading, setLoading] = useState(true)
  const [activityError, setActivityError] = useState<'timeout' | 'failed' | null>(null)
  const locale = useProfileLocale()

  // Fetch real recent activity for the user
  const fetchRecentActivity = useCallback(async () => {
    if (!user) {
      setRecentActivity([])
      setLoading(false)
      return
    }

    setActivityError(null)
    try {
      const activities: RecentActivityItemProps[] = []

      // Fetch user's recent posts
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (posts) {
        for (const post of posts) {
          activities.push({
            id: `post-${post.id}`,
            type: 'post',
            excerpt: excerptOf(post.content, 60),
            at: post.created_at ?? new Date().toISOString(),
            icon: Newspaper,
          })
        }
      }

      // Fetch user's recent likes.
      // The FK post_likes→posts is now in the generated Database types
      // (regen 2026-06-01). The query builder infers the embedded join shape
      // directly — no local interface or cast needed.
      const { data: likesRaw } = await supabase
        .from('post_likes')
        .select('post_id, created_at, post:posts(content)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      const likes = likesRaw ?? []

      if (likes) {
        for (const like of likes) {
          const postContent = like.post?.content
          activities.push({
            id: `like-${like.post_id}`,
            type: 'like',
            excerpt: postContent ? excerptOf(postContent, 50) : null,
            at: like.created_at ?? new Date().toISOString(),
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
      const kind = isQueryTimeout(err) ? 'timeout' : 'failed'
      console.error('Error fetching recent activity:', kind, err)
      setActivityError(kind)
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
    <div lang={locale} dir={dir(locale)} className="h-full flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 py-6">
        {/* Welcome Section */}
        <WelcomeSection userName={userName} locale={locale} />

        {/* Quick Actions Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">{overviewT(locale, 'quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionCard
              icon={Map}
              iconBg="bg-blue-100 text-blue-600"
              title={overviewT(locale, 'findResourcesTitle')}
              description={overviewT(locale, 'findResourcesBody')}
              onClick={() => handleNavigate('map')}
            />
            <QuickActionCard
              icon={MessageSquare}
              iconBg="bg-purple-100 text-purple-600"
              title={overviewT(locale, 'assistantTitle')}
              description={overviewT(locale, 'assistantBody')}
              onClick={() => handleNavigate('chat')}
            />
            <QuickActionCard
              icon={Search}
              iconBg="bg-amber-100 text-amber-700"
              title={overviewT(locale, 'programsTitle')}
              description={overviewT(locale, 'programsBody')}
              onClick={() => handleNavigate('programs')}
            />
            <QuickActionCard
              icon={Compass}
              iconBg="bg-green-100 text-green-600"
              title={overviewT(locale, 'wizardTitle')}
              description={overviewT(locale, 'wizardBody')}
              onClick={() => handleNavigate('wizard')}
            />
            <QuickActionCard
              icon={ClipboardList}
              iconBg="bg-orange-100 text-orange-600"
              title={overviewT(locale, 'applicationsTitle')}
              description={overviewT(locale, 'applicationsBody')}
              onClick={() => handleNavigate('applications')}
            />
            <QuickActionCard
              icon={FolderOpen}
              iconBg="bg-indigo-100 text-indigo-600"
              title={overviewT(locale, 'documentsTitle')}
              description={overviewT(locale, 'documentsBody')}
              onClick={() => handleNavigate('documents')}
            />
            <QuickActionCard
              icon={FileText}
              iconBg="bg-teal-100 text-teal-600"
              title={overviewT(locale, 'applyTitle')}
              description={overviewT(locale, 'applyBody')}
              onClick={() => handleNavigate('forms')}
            />
          </div>
        </div>

        {/* Recent Activity & Upcoming Reminders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">{overviewT(locale, 'recentActivity')}</h2>
            <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm">
              {loading ? (
                <div role="status" className="text-center py-8">
                  <Loader2 aria-hidden="true" className="w-5 h-5 mx-auto animate-spin text-stone-400" />
                  <span className="sr-only">{overviewT(locale, 'loadingActivity')}</span>
                </div>
              ) : activityError ? (
                <div role="alert" className="text-center py-8 text-red-600 text-sm">
                  {overviewT(locale, activityError === 'timeout' ? 'activityTimedOut' : 'activityFailed')}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((activity) => (
                    <RecentActivityItem key={activity.id} {...activity} locale={locale} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-500 text-sm">
                  {overviewT(locale, 'noActivity')}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Reminders */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">{overviewT(locale, 'upcomingReminders')}</h2>
            <div className="bg-white rounded-2xl border border-stone-200/50 p-4 shadow-sm">
              <div className="text-center py-8 text-stone-500 text-sm">
                {overviewT(locale, 'noReminders')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
