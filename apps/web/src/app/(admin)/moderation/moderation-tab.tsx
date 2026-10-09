'use client'

import { useEffect, useState } from 'react'
import { ReportsQueue } from './reports-queue'
import { SafetyAlertsReview } from './safety-alerts-review'
import { FocusedPost } from './focused-post'
import { readAdminFocus } from './admin-focus-url'

type SubTab = 'reports' | 'safety'

const SUBTAB_LABELS: Record<SubTab, string> = {
  reports: 'Reports',
  safety: 'Safety Alerts',
}

/** The sub-tab the tab opens on: Safety Alerts for an "Edit in admin" safety-alert link, else Reports. */
export function initialModerationSubtab(search: string): SubTab {
  return readAdminFocus(search)?.kind === 'safety_alert' ? 'safety' : 'reports'
}

export function ModerationTab({ selectedOrgId }: { selectedOrgId: string }) {
  // null until mounted: the sub-tab depends on the URL (window.location exists only after mount),
  // and neither list is read before it is decided.
  const [activeSubtab, setActiveSubtab] = useState<SubTab | null>(null)
  // A moderation action on the linked post reloads the queue below it.
  const [queueKey, setQueueKey] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSubtab(initialModerationSubtab(window.location.search))
  }, [])

  // selectedOrgId is available for future subtab filtering
  void selectedOrgId

  return (
    <div>
      {/* "Edit in admin" on a post: that post, with its actions (nothing without a post link). */}
      <FocusedPost onChanged={() => setQueueKey((k) => k + 1)} />

      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4 border-b border-stone-200 overflow-x-auto -mx-1 px-1 pb-0">
        {(Object.keys(SUBTAB_LABELS) as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubtab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap ${
              (activeSubtab ?? 'reports') === tab
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
        {activeSubtab === 'reports' && <ReportsQueue key={queueKey} />}
        {activeSubtab === 'safety' && <SafetyAlertsReview />}
      </div>
    </div>
  )
}
