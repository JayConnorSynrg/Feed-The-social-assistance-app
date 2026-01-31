'use client'

// apps/web/src/app/(dashboard)/dashboard/page.tsx
// Main dashboard overview page

import React from 'react'
import Link from 'next/link'
import {
  DashboardHeader,
  StatCard,
  MobileNav,
} from '@/components/dashboard/dashboard-layout'
import { ApplicationList } from '@/components/dashboard/application-list'
import { useApplications } from '@/hooks/use-applications'
import { useNotifications } from '@/hooks/use-notifications'
import { ReminderList } from '@/components/notifications/notification-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { applications, stats, isLoading: appsLoading } = useApplications()
  const {
    notifications,
    unreadCount,
    upcomingReminders,
    isLoading: notifsLoading,
    completeReminder,
    deleteReminder,
  } = useNotifications()

  // Get recent applications (last 3)
  const recentApplications = applications.slice(0, 3)

  // Get action-needed applications
  const actionNeeded = applications.filter(a => a.status === 'additional_info_needed')

  return (
    <div className="pb-20 md:pb-0">
      <DashboardHeader
        title="Dashboard"
        description="Track your benefit applications and reminders"
        actions={
          <Link href="/forms">
            <Button>Start New Application</Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Applications"
          value={stats.total}
          icon="📋"
          description="All time"
        />
        <StatCard
          title="Pending"
          value={stats.submitted + stats.under_review}
          icon="⏳"
          description="Awaiting response"
        />
        <StatCard
          title="Action Needed"
          value={stats.needs_action}
          icon="⚠️"
          description={stats.needs_action > 0 ? 'Requires your attention' : 'Nothing pending'}
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon="✅"
          description="Successfully completed"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Needed Banner */}
          {actionNeeded.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {actionNeeded.length} application{actionNeeded.length !== 1 ? 's' : ''} need your attention
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Additional information has been requested
                    </p>
                  </div>
                  <Link href="/applications?filter=additional_info_needed">
                    <Button size="sm">View All</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Applications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Applications</CardTitle>
              <Link href="/applications">
                <Button variant="ghost" size="sm">
                  View All →
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <ApplicationList
                applications={recentApplications}
                isLoading={appsLoading}
                emptyMessage="No applications yet. Start your first application!"
              />
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/forms">
                  <button className="w-full p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center">
                    <span className="text-2xl mb-2 block">📝</span>
                    <span className="text-sm font-medium">New Application</span>
                  </button>
                </Link>
                <Link href="/documents">
                  <button className="w-full p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center">
                    <span className="text-2xl mb-2 block">📁</span>
                    <span className="text-sm font-medium">Upload Document</span>
                  </button>
                </Link>
                <Link href="/resources">
                  <button className="w-full p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center">
                    <span className="text-2xl mb-2 block">📍</span>
                    <span className="text-sm font-medium">Find Resources</span>
                  </button>
                </Link>
                <Link href="/chat">
                  <button className="w-full p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-center">
                    <span className="text-2xl mb-2 block">💬</span>
                    <span className="text-sm font-medium">Get Help</span>
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                    {unreadCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="animate-pulse h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No new notifications
                </p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 3).map(n => (
                    <div
                      key={n.id}
                      className={`p-2 rounded text-sm ${
                        n.is_read ? '' : 'bg-primary/5'
                      }`}
                    >
                      <p className="font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Reminders */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Upcoming Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming reminders
                </p>
              ) : (
                <ReminderList
                  reminders={upcomingReminders}
                  onComplete={completeReminder}
                  onDelete={deleteReminder}
                />
              )}
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <h3 className="font-semibold flex items-center gap-2">
                <span>🤖</span> Need Help?
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Our AI assistant can help you find resources and complete applications.
              </p>
              <Link href="/chat">
                <Button size="sm" className="mt-3">
                  Chat with Assistant
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileNav />
    </div>
  )
}
