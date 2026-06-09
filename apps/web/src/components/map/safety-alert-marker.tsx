'use client'

import { useState, useCallback } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { AlertTriangle, Cloud, Construction, Gauge, Info, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SafetyAlert } from '@/hooks/use-safety-alerts'

// ─────────────────────────────────────────────────────────────────────────────
// Severity colors:  1-2 = amber (low-medium risk), 3-4 = red-orange (high risk)
// ─────────────────────────────────────────────────────────────────────────────

function markerBg(severity: number): string {
  if (severity <= 2) return '#f59e0b' // amber-400
  return '#dc2626' // red-600
}

function markerBgClass(severity: number): string {
  if (severity <= 2) return 'bg-amber-400 border-amber-600 text-white'
  return 'bg-red-600 border-red-800 text-white'
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert type icons
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  weather: Cloud,
  road_closure: Construction,
  speeding: Gauge,
  general: AlertTriangle,
}

const ALERT_LABELS: Record<string, string> = {
  weather: 'Weather Hazard',
  road_closure: 'Road Closure',
  speeding: 'Speeding Area',
  general: 'Safety Alert',
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Moderate',
  3: 'High',
  4: 'Critical',
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SafetyAlertMarkerProps {
  alert: SafetyAlert
  onVote: (alertId: string, vote: 'confirm' | 'clear') => Promise<unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

// SafetyAlertMarkerInner contains all hooks; called only when coords are valid.
function SafetyAlertMarkerInner({ alert, onVote }: SafetyAlertMarkerProps) {
  const [showPopup, setShowPopup] = useState(false)
  const [voting, setVoting] = useState<'confirm' | 'clear' | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  const IconComp = ALERT_ICONS[alert.alert_type] ?? AlertTriangle
  const color = markerBg(alert.severity)

  const handleVote = useCallback(
    async (vote: 'confirm' | 'clear') => {
      setVoting(vote)
      setVoteError(null)
      try {
        await onVote(alert.id, vote)
      } catch (err) {
        setVoteError(err instanceof Error ? err.message : 'Vote failed')
      } finally {
        setVoting(null)
      }
    },
    [alert.id, onVote]
  )

  return (
    <>
      <Marker
        longitude={alert.lng}
        latitude={alert.lat}
        anchor="bottom"
        onClick={(e) => {
          e.originalEvent.stopPropagation()
          setShowPopup(true)
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full border-2 cursor-pointer shadow-md transition-transform hover:scale-110',
            markerBgClass(alert.severity)
          )}
          style={{ background: color }}
          aria-label={`${ALERT_LABELS[alert.alert_type]} severity ${alert.severity}`}
          data-testid={`safety-alert-marker-${alert.id}`}
        >
          <IconComp className="w-4 h-4" />
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={alert.lng}
          latitude={alert.lat}
          anchor="bottom"
          offset={40}
          onClose={() => setShowPopup(false)}
          closeButton={true}
          closeOnClick={false}
          maxWidth="280px"
        >
          <div className="p-2 text-stone-900">
            {/* Trust label */}
            <div className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mb-2">
              <Info className="w-3 h-3" />
              Unverified — neighbor report
            </div>

            {/* Title + severity */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4 h-4 flex-shrink-0" style={{ color }}>
                <IconComp className="w-4 h-4" />
              </span>
              <span className="font-semibold text-sm">{ALERT_LABELS[alert.alert_type]}</span>
              <span
                className={cn(
                  'text-xs rounded px-1.5 py-0.5 font-medium',
                  alert.severity <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                )}
              >
                {SEVERITY_LABELS[alert.severity] ?? `Sev ${alert.severity}`}
              </span>
            </div>

            {/* Description */}
            {alert.description && (
              <p className="text-xs text-stone-700 mb-3 leading-relaxed">{alert.description}</p>
            )}

            {/* Counts */}
            <div className="flex items-center gap-3 text-xs text-stone-500 mb-3">
              <span>{alert.confirm_count} confirmed still here</span>
              <span>·</span>
              <span>{alert.clear_count} reported gone</span>
            </div>

            {/* Vote error */}
            {voteError && (
              <p className="text-xs text-red-600 mb-2">{voteError}</p>
            )}

            {/* Vote buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs h-7 border-amber-300 text-amber-800 hover:bg-amber-50"
                disabled={voting !== null}
                onClick={() => handleVote('confirm')}
                data-testid={`vote-confirm-${alert.id}`}
              >
                <ThumbsUp className="w-3 h-3 mr-1" />
                {voting === 'confirm' ? '...' : 'Still here'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs h-7 border-stone-300 text-stone-700 hover:bg-stone-50"
                disabled={voting !== null}
                onClick={() => handleVote('clear')}
                data-testid={`vote-clear-${alert.id}`}
              >
                <ThumbsDown className="w-3 h-3 mr-1" />
                {voting === 'clear' ? '...' : 'Gone now'}
              </Button>
            </div>

            {/* Expiry note */}
            <p className="text-xs text-stone-400 mt-2">
              Reported {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </Popup>
      )}
    </>
  )
}

/**
 * SafetyAlertMarker — guards against NaN coordinates before rendering.
 * Mapbox GL throws synchronously on (NaN, NaN) which triggers PanelErrorBoundary.
 * Realtime EWKB parse failures can produce undefined lng/lat before the next
 * in-view RPC fetch corrects them; this guard prevents the cascade.
 */
export function SafetyAlertMarker(props: SafetyAlertMarkerProps) {
  if (!isFinite(props.alert.lng) || !isFinite(props.alert.lat)) return null
  return <SafetyAlertMarkerInner {...props} />
}
