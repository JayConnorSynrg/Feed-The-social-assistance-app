'use client'

// apps/web/src/components/dashboard/application-list.tsx
// List view for user's benefit applications

import React from 'react'
import Link from 'next/link'
import { type Application, type ApplicationStatus, getStatusDisplay } from '@/hooks/use-applications'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ApplicationCardProps {
  application: Application
  onStatusChange?: (id: string, status: ApplicationStatus) => void
}

export function ApplicationCard({ application, onStatusChange }: ApplicationCardProps) {
  const statusInfo = getStatusDisplay(application.status)
  const lastUpdated = new Date(application.last_updated).toLocaleDateString()
  const isActionNeeded = application.status === 'additional_info_needed'

  return (
    <Card className={`transition-shadow hover:shadow-md ${isActionNeeded ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/20' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{statusInfo.icon}</span>
              <h3 className="font-semibold">{application.template_name}</h3>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  statusInfo.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  statusInfo.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  statusInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  statusInfo.color === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                  statusInfo.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  statusInfo.color === 'purple' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {statusInfo.label}
              </span>

              {application.case_number && (
                <span className="text-xs text-muted-foreground">
                  Case #{application.case_number}
                </span>
              )}
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              <span>Updated {lastUpdated}</span>
              {application.documents_count > 0 && (
                <span className="ml-3">📎 {application.documents_count} documents</span>
              )}
            </div>

            {application.deadline && (
              <div className="mt-2 text-sm">
                <span className="text-orange-600 dark:text-orange-400">
                  ⏰ Deadline: {new Date(application.deadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Link href={`/applications/${application.id}`}>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </Link>
            {application.status === 'draft' && (
              <Link href={`/forms/fill/${application.template_id}?draft=${application.id}`}>
                <Button size="sm">Continue</Button>
              </Link>
            )}
          </div>
        </div>

        {isActionNeeded && (
          <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-sm">
            <strong>Action Required:</strong> The agency needs additional information.
            <Link href={`/applications/${application.id}`} className="ml-2 text-primary hover:underline">
              View details →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ApplicationListProps {
  applications: Application[]
  isLoading?: boolean
  emptyMessage?: string
  filter?: ApplicationStatus | 'all'
}

export function ApplicationList({
  applications,
  isLoading,
  emptyMessage = 'No applications found',
  filter = 'all',
}: ApplicationListProps) {
  const filteredApps = filter === 'all'
    ? applications
    : applications.filter(a => a.status === filter)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (filteredApps.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-muted-foreground">{emptyMessage}</p>
          <Link href="/forms">
            <Button className="mt-4">Browse Available Forms</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {filteredApps.map(application => (
        <ApplicationCard key={application.id} application={application} />
      ))}
    </div>
  )
}

// Filter tabs
interface ApplicationFilterProps {
  activeFilter: ApplicationStatus | 'all'
  onFilterChange: (filter: ApplicationStatus | 'all') => void
  stats: {
    total: number
    drafts: number
    submitted: number
    under_review: number
    needs_action: number
    approved: number
    denied: number
  }
}

export function ApplicationFilter({ activeFilter, onFilterChange, stats }: ApplicationFilterProps) {
  const filters: { value: ApplicationStatus | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'draft', label: 'Drafts', count: stats.drafts },
    { value: 'submitted', label: 'Submitted', count: stats.submitted },
    { value: 'under_review', label: 'In Review', count: stats.under_review },
    { value: 'additional_info_needed', label: 'Action Needed', count: stats.needs_action },
    { value: 'approved', label: 'Approved', count: stats.approved },
    { value: 'denied', label: 'Denied', count: stats.denied },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {filters.map(filter => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeFilter === filter.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          {filter.label}
          {filter.count > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
              {filter.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
