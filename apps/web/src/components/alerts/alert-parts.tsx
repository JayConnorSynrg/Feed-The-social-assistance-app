'use client'

// apps/web/src/components/alerts/alert-parts.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pieces every alert surface shares: the icon of each alert type (one map for the strip, the marker,
// the staging pin, the hazard menu and the admin list) and the type / severity / description summary
// the dialogs show. The description is member-written text: it carries dir="auto" and an empty lang.

import { AlertTriangle, Cloud, Construction, Gauge, type LucideIcon } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { alertSeverityLabel, alertTypeLabel, alertsT } from '@/lib/i18n-feed-alerts'
import type { AlertType } from '@/lib/safety-alert-rpc'

export const ALERT_ICONS: Record<AlertType, LucideIcon> = {
  weather: Cloud,
  road_closure: Construction,
  speeding: Gauge,
  general: AlertTriangle,
}

/** The icon of an alert type (an unknown type gets the general one). Decorative: the type is always
 *  written beside it. */
export function AlertTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ALERT_ICONS[type as AlertType] ?? AlertTriangle
  return <Icon className={className} aria-hidden="true" />
}

/** Severity 1–2 reads amber, 3–4 red. Colour only repeats the level: its text label is always shown. */
export function isHighSeverity(severity: number): boolean {
  return severity >= 3
}

/** Type, severity and description of one version of an alert. */
export function AlertSummary({
  alert,
  locale,
  heading,
}: {
  alert: { alert_type: string; severity: number; description: string | null }
  locale: Locale
  heading?: string
}) {
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      {heading && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-700">{heading}</p>}
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
        <AlertTypeIcon type={alert.alert_type} className="h-4 w-4 shrink-0" />
        <span>{alertTypeLabel(alert.alert_type, locale)}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${isHighSeverity(alert.severity) ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>
          {alertSeverityLabel(alert.severity, locale)}
        </span>
      </p>
      {alert.description ? (
        <p lang="" dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-800">
          {alert.description}
        </p>
      ) : (
        <p className="mt-1 text-sm text-stone-600">{alertsT(locale, 'noDescription')}</p>
      )}
    </div>
  )
}
