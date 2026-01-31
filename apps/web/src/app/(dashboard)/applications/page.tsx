'use client'

// apps/web/src/app/(dashboard)/applications/page.tsx
// Applications list page with filtering

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { DashboardHeader, MobileNav } from '@/components/dashboard/dashboard-layout'
import {
  ApplicationList,
  ApplicationFilter,
} from '@/components/dashboard/application-list'
import { useApplications, type ApplicationStatus } from '@/hooks/use-applications'
import { Button } from '@/components/ui/button'

function ApplicationsContent() {
  const searchParams = useSearchParams()
  const initialFilter = (searchParams.get('filter') as ApplicationStatus) || 'all'

  const [activeFilter, setActiveFilter] = useState<ApplicationStatus | 'all'>(initialFilter)
  const { applications, stats, isLoading } = useApplications()

  return (
    <div className="pb-20 md:pb-0">
      <DashboardHeader
        title="My Applications"
        description="Track and manage your benefit applications"
        actions={
          <Link href="/forms">
            <Button>New Application</Button>
          </Link>
        }
      />

      <ApplicationFilter
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        stats={stats}
      />

      <ApplicationList
        applications={applications}
        isLoading={isLoading}
        filter={activeFilter}
        emptyMessage={
          activeFilter === 'all'
            ? "You haven't started any applications yet."
            : `No ${activeFilter.replace('_', ' ')} applications.`
        }
      />

      <MobileNav />
    </div>
  )
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-8">Loading applications...</div>}>
      <ApplicationsContent />
    </Suspense>
  )
}
