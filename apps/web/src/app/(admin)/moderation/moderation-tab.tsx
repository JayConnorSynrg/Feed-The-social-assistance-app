'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportsQueue } from './reports-queue'
import { SafetyAlertsReview } from './safety-alerts-review'
import { FocusedPost } from './focused-post'
import { readAdminFocus } from './admin-focus-url'

type SubTab = 'reports' | 'safety'

const SUBTABS: SubTab[] = ['reports', 'safety']

const SUBTAB_LABELS: Record<SubTab, string> = {
  reports: 'Reports',
  safety: 'Safety Alerts',
}

/**
 * The sub-tab list: as tall as its 44px triggers (the primitive's own group-…:h-9 is overridden at
 * the same specificity) and NOT a scroll container (overflow-x-auto would force overflow-y:auto and
 * clip the selected tab's underline, drawn 5px below the trigger).
 */
export const MODERATION_TABLIST_CLASS =
  'mb-4 w-full justify-start rounded-none border-b border-stone-200 p-0 group-data-[orientation=horizontal]/tabs:h-auto'

/** The sub-tab the tab opens on: Safety Alerts for an "Edit in admin" safety-alert link, else Reports. */
export function initialModerationSubtab(search: string): SubTab {
  return readAdminFocus(search)?.kind === 'safety_alert' ? 'safety' : 'reports'
}

/**
 * Moderation: the linked post (when an "Edit in admin" post link opened the tab), then the Reports /
 * Safety Alerts sub-tabs — a real tablist (role=tab, aria-selected, arrow keys) with an underline on
 * the selected tab, not colour alone.
 */
/** viewerId: the signed-in moderator — the post actions leave out lifting their own moderation. */
export function ModerationTab({ selectedOrgId, viewerId = null }: { selectedOrgId: string; viewerId?: string | null }) {
  // null until mounted: the sub-tab depends on the URL (window.location exists only after mount),
  // and neither list is read before it is decided.
  const [activeSubtab, setActiveSubtab] = useState<SubTab | null>(null)
  // An action on the linked post reloads the queue below it; an action in the queue makes the linked
  // post re-read, so neither ever shows (or acts on) a stale state of the same post.
  const [queueKey, setQueueKey] = useState(0)
  const [postReloadKey, setPostReloadKey] = useState(0)
  const triggers = useRef<Record<SubTab, HTMLButtonElement | null>>({ reports: null, safety: null })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSubtab(initialModerationSubtab(window.location.search))
  }, [])

  const reloadQueue = useCallback(() => setQueueKey((k) => k + 1), [])
  const rereadLinkedPost = useCallback(() => setPostReloadKey((k) => k + 1), [])
  const shown = activeSubtab ?? 'reports'
  // Closing the linked post removes the focused control: focus the selected sub-tab instead.
  const focusSelectedTab = () => requestAnimationFrame(() => triggers.current[shown]?.focus())

  // selectedOrgId is available for future subtab filtering
  void selectedOrgId

  return (
    <div>
      {/* "Edit in admin" on a post: that post, with its actions (nothing without a post link). */}
      <FocusedPost onChanged={reloadQueue} reloadKey={postReloadKey} onDismissed={focusSelectedTab} viewerId={viewerId} />

      <Tabs value={shown} onValueChange={(v) => setActiveSubtab(v as SubTab)} className="gap-0">
        <TabsList
          variant="line"
          aria-label="Moderation"
          className={MODERATION_TABLIST_CLASS}
        >
          {SUBTABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              ref={(el: HTMLButtonElement | null) => {
                triggers.current[tab] = el
              }}
              className="min-h-[44px] flex-none px-4 py-2 text-stone-600 data-[state=active]:font-semibold data-[state=active]:text-lime-800 after:bg-lime-700"
            >
              {SUBTAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab content — scrollable within the tab; nothing is read until the sub-tab is decided. */}
        {activeSubtab !== null && (
          <>
            <TabsContent value="reports" className="overflow-y-auto max-h-[calc(100vh-220px)]">
              <ReportsQueue key={queueKey} onPostChanged={rereadLinkedPost} viewerId={viewerId} />
            </TabsContent>
            <TabsContent value="safety" className="overflow-y-auto max-h-[calc(100vh-220px)]">
              <SafetyAlertsReview />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
