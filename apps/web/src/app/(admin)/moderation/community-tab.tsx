'use client'

import { useEffect } from 'react'
import { CommunitySummarySection } from './community-summary-section'
import { PetitionExportSection } from './petition-export-section'
import { logger } from '@/lib/logger'
import type { Locale } from '@/lib/i18n'

export function CommunityTab({ selectedOrgId, locale }: { selectedOrgId: string; locale: Locale }) {
  useEffect(() => {
    logger.info('admin.community.tab.viewed', { org_id: selectedOrgId })
  }, [selectedOrgId])

  return (
    <div className="space-y-4">
      <CommunitySummarySection locale={locale} />
      <PetitionExportSection locale={locale} />
    </div>
  )
}
