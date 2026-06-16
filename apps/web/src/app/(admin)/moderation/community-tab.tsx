'use client'

import { useEffect } from 'react'
import { CommunitySummarySection } from './community-summary-section'
import { logger } from '@/lib/logger'

export function CommunityTab({ selectedOrgId }: { selectedOrgId: string }) {
  useEffect(() => {
    logger.info('admin.community.tab.viewed', { org_id: selectedOrgId })
  }, [selectedOrgId])

  return (
    <div className="space-y-4">
      <CommunitySummarySection />
      {/* PetitionSignaturesExport — coming soon */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6">
        <p className="text-sm text-stone-500">Petition signatures export — coming soon</p>
      </div>
    </div>
  )
}
