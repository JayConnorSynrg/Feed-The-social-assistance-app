'use client'

// apps/web/src/components/feed/safety-strip.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed's "Active Alerts" strip (live, unexpired safety alerts — at most 5, read by
// feed-panel.tsx). Each alert is a button that opens the map. Community moderators and up also get
// "Edit in admin" beside it (a sibling, never inside the button): it opens the alert pinned in the
// Safety Alerts review (/moderation?tab=moderation&focus=safety_alert:<id>). The id is
// safety_alerts.id, the same id the map marker uses.

import { AlertTriangle, Cloud, Construction, Gauge, ShieldAlert } from 'lucide-react'
import type { SafetyAlert } from '@/hooks/use-safety-alerts'
import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'

// Alert-type icons and labels — mirrors safety-alert-marker.tsx constants
const STRIP_ALERT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  weather: Cloud,
  road_closure: Construction,
  speeding: Gauge,
  general: AlertTriangle,
}

const STRIP_ALERT_LABELS: Record<string, string> = {
  weather: 'Weather Hazard',
  road_closure: 'Road Closure',
  speeding: 'Speeding Area',
  general: 'Safety Alert',
}

/**
 * The "Edit in admin" name of one strip alert: up to 5 alerts share 4 types, so the type alone
 * collides — add the age and the start of the description ("Road Closure, 5m ago: Bridge out on…").
 */
export function safetyStripItemName(label: string, description: string | null, age: string): string {
  const text = (description ?? '').replace(/\s+/g, ' ').trim()
  const start = text.length > 40 ? `${text.slice(0, 39)}…` : text
  return start ? `${label}, ${age}: ${start}` : `${label}, ${age}`
}

export interface SafetyStripProps {
  alerts: SafetyAlert[]
  onViewMap: () => void
  /** "5m ago" for an alert's created_at. */
  formatAge: (date: Date) => string
}

export function SafetyStrip({ alerts, onViewMap, formatAge }: SafetyStripProps) {
  return (
    <div
      data-testid="safety-strip"
      className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          Active Alerts
        </div>
        <button
          data-testid="safety-strip-view-map"
          onClick={onViewMap}
          className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
        >
          View on map
        </button>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((alert) => {
          const Icon = STRIP_ALERT_ICONS[alert.alert_type] ?? AlertTriangle
          const label = STRIP_ALERT_LABELS[alert.alert_type] ?? 'Safety Alert'
          // Severity-scaled color: 1-2 amber, 3-4 red (matches safety-alert-marker.tsx)
          const isHigh = alert.severity >= 3
          const age = formatAge(new Date(alert.created_at))
          return (
            <li key={alert.id} className="flex items-start gap-2">
              {/* A real button: its visible text (type, status, description, age) is its name. */}
              <button
                type="button"
                data-testid={`safety-strip-item-${alert.id}`}
                className="flex flex-1 min-w-0 items-start gap-2 text-left cursor-pointer group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
                onClick={onViewMap}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Icon className="w-3 h-3" aria-hidden="true" />
                </span>
                <span className="block flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-semibold ${isHigh ? 'text-red-800' : 'text-amber-800'}`}>
                      {label}
                    </span>
                    {alert.status === 'pending' && (
                      <span className="text-[10px] text-stone-500 font-normal">
                        Unverified — neighbor report
                      </span>
                    )}
                  </span>
                  {alert.description && (
                    <span className="block text-xs text-stone-700 line-clamp-1 mt-0.5">{alert.description}</span>
                  )}
                  <span className="block text-[10px] text-stone-500 mt-0.5">{age}</span>
                </span>
              </button>
              <ClientAdminEditLink
                target={{ kind: 'safety_alert', id: alert.id }}
                itemName={safetyStripItemName(label, alert.description, age)}
                source="feed_alert"
                data-testid={`admin-edit-alert-${alert.id}`}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
