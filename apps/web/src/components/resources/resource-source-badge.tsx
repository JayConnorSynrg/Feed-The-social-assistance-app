'use client'

import { Shield, Star, Check, ThumbsUp, Clock, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ResourceSourceBadgeProps {
  source: 'local' | 'federated'
  instanceName?: string
  instanceUrl?: string
  trustLevel?: string // 'untrusted' | 'pending' | 'trusted' | 'verified' | 'core'
  trustScore?: number // 0-1
  lastSyncedAt?: string // ISO timestamp
  className?: string
  variant?: 'compact' | 'expanded'
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`

  const diffYears = Math.floor(diffDays / 365)
  return `${diffYears}y ago`
}

const trustLevelConfig = {
  core: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Star,
    label: 'Core Partner'
  },
  verified: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: Check,
    label: 'Verified Partner'
  },
  trusted: {
    className: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: ThumbsUp,
    label: 'Trusted Partner'
  },
  pending: {
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock,
    label: 'Pending Verification'
  },
  untrusted: {
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: HelpCircle,
    label: 'Untrusted Source'
  },
  local: {
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Shield,
    label: 'Local Resource'
  }
}

export function ResourceSourceBadge({
  source,
  instanceName,
  instanceUrl,
  trustLevel,
  trustScore,
  lastSyncedAt,
  className,
  variant = 'compact'
}: ResourceSourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const configKey = source === 'local' ? 'local' : (trustLevel as keyof typeof trustLevelConfig || 'untrusted')
  const config = trustLevelConfig[configKey] || trustLevelConfig.untrusted
  const Icon = config.icon

  const badgeText = source === 'local'
    ? 'Local Resource'
    : instanceName || 'Federation Partner'

  const ariaLabel = source === 'local'
    ? 'Local resource from this FEED instance'
    : `Federated resource from ${instanceName || 'external instance'}, trust level: ${config.label}${trustScore ? `, score: ${Math.round(trustScore * 100)}%` : ''}`

  return (
    <div
      className={cn('relative inline-block', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Badge
        variant="outline"
        className={cn(
          'border gap-1.5 font-medium transition-colors',
          config.className
        )}
        aria-label={ariaLabel}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{badgeText}</span>

        {variant === 'expanded' && source === 'federated' && (
          <>
            <span className="text-xs opacity-70">•</span>
            <span className="text-xs opacity-90">{config.label}</span>
            {lastSyncedAt && (
              <>
                <span className="text-xs opacity-70">•</span>
                <span className="text-xs opacity-75">{formatRelativeTime(lastSyncedAt)}</span>
              </>
            )}
          </>
        )}
      </Badge>

      {/* Hover Tooltip */}
      {showTooltip && source === 'federated' && (
        <div
          className="absolute z-50 bottom-full left-0 mb-2 w-64 rounded-lg border bg-popover px-3 py-2 text-sm shadow-md animate-in fade-in-0 zoom-in-95"
          role="tooltip"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{instanceName || 'Federation Partner'}</span>
              {trustScore !== undefined && (
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                  {Math.round(trustScore * 100)}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs">{config.label}</span>
            </div>

            {lastSyncedAt && (
              <div className="text-xs text-muted-foreground">
                Last synced: {formatRelativeTime(lastSyncedAt)}
              </div>
            )}

            {instanceUrl && (
              <div className="text-xs text-muted-foreground truncate border-t pt-1.5 mt-1.5">
                {instanceUrl}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
