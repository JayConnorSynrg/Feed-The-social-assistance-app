'use client'

import { useState } from 'react'
import { ReportsQueue } from './reports-queue'
import { SafetyAlertsReview } from './safety-alerts-review'

type SubTab = 'reports' | 'safety'

const SUBTAB_LABELS: Record<SubTab, string> = {
  reports: 'Reports',
  safety: 'Safety Alerts',
}

export function ModerationTab({ selectedOrgId }: { selectedOrgId: string }) {
  const [activeSubtab, setActiveSubtab] = useState<SubTab>('reports')

  // selectedOrgId is available for future subtab filtering
  void selectedOrgId

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4 border-b border-stone-200 overflow-x-auto -mx-1 px-1 pb-0">
        {(Object.keys(SUBTAB_LABELS) as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubtab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap ${
              activeSubtab === tab
                ? 'border-lime-600 text-lime-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {SUBTAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable within the tab */}
      <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
        {activeSubtab === 'reports' && <ReportsQueue />}
        {activeSubtab === 'safety' && <SafetyAlertsReview />}
      </div>
    </div>
  )
}
