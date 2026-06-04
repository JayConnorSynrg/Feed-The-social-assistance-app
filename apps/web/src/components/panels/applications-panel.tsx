'use client'

// apps/web/src/components/panels/applications-panel.tsx
// Applications Panel - Track benefit applications, view status, and manage required actions

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'

// Module-level cached formatter — avoids per-call Intl object allocation inside buildTimeline
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
import {
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  Phone,
  Eye,
  ChevronRight,
  Calendar,
  Building2,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApplications, type Application as HookApplication, type ApplicationStatus as HookApplicationStatus } from '@/hooks/use-applications'
import { usePanelContext } from '@/components/layout/feed-shell'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'

// ============================================
// TYPES
// ============================================
type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'denied' | 'action_required'
type FilterType = 'all' | 'in_progress' | 'approved' | 'denied'

interface TimelineStep {
  id: string
  label: string
  status: 'completed' | 'current' | 'pending'
  date?: string
}

interface RequiredAction {
  id: string
  title: string
  description: string
  deadline?: string
  type: 'document' | 'interview' | 'verification'
}

interface Application {
  id: string
  programName: string
  programType: 'food' | 'healthcare' | 'housing' | 'utilities' | 'cash'
  status: ApplicationStatus
  submissionDate: Date
  lastUpdated: Date
  stepsCompleted: number
  totalSteps: number
  caseNumber?: string
  assignedWorker?: string
  requiredActions: RequiredAction[]
  timeline: TimelineStep[]
}

interface ApplicationsPanelProps {
  userId?: string
}

// ============================================
// ADAPTER: Hook Application → Panel Application
// ============================================
const TIMELINE_STEPS: readonly string[] = [
  'Application Submitted',
  'Documents Reviewed',
  'Eligibility Check',
  'Final Review',
  'Decision',
]

function deriveProgramType(templateName: string): Application['programType'] {
  const lower = templateName.toLowerCase()
  if (lower.includes('snap') || lower.includes('food') || lower.includes('wic')) return 'food'
  if (lower.includes('medicaid') || lower.includes('health')) return 'healthcare'
  if (lower.includes('section 8') || lower.includes('housing')) return 'housing'
  if (lower.includes('liheap') || lower.includes('energy') || lower.includes('utilit')) return 'utilities'
  if (lower.includes('tanf') || lower.includes('cash') || lower.includes('ssi')) return 'cash'
  return 'food'
}

function deriveSteps(status: HookApplicationStatus): { completed: number; total: number } {
  switch (status) {
    case 'draft': return { completed: 0, total: 5 }
    case 'submitted': return { completed: 1, total: 5 }
    case 'under_review': return { completed: 2, total: 5 }
    case 'additional_info_needed': return { completed: 2, total: 5 }
    case 'approved': return { completed: 5, total: 5 }
    case 'denied': return { completed: 3, total: 5 }
    case 'appealed': return { completed: 3, total: 5 }
    case 'closed': return { completed: 5, total: 5 }
    default: return { completed: 0, total: 5 }
  }
}

function mapHookStatus(status: HookApplicationStatus): ApplicationStatus {
  switch (status) {
    case 'additional_info_needed': return 'action_required'
    case 'draft': return 'submitted'
    case 'appealed': return 'under_review'
    case 'closed': return 'approved'
    default: return status as ApplicationStatus
  }
}

function buildTimeline(status: HookApplicationStatus, submittedDate: Date): TimelineStep[] {
  const steps = deriveSteps(status)
  return TIMELINE_STEPS.map((label, index) => {
    let stepStatus: TimelineStep['status'] = 'pending'
    let date: string | undefined

    if (index < steps.completed) {
      stepStatus = 'completed'
      const stepDate = new Date(submittedDate.getTime() + index * 2 * 24 * 60 * 60 * 1000)
      date = DATE_FORMATTER.format(stepDate)
    } else if (index === steps.completed) {
      stepStatus = 'current'
    }

    return { id: `t${index + 1}`, label, status: stepStatus, date }
  })
}

function adaptApplication(hookApp: HookApplication): Application {
  const submissionDate = new Date(hookApp.submitted_at ?? hookApp.created_at)
  const mappedStatus = mapHookStatus(hookApp.status)
  const steps = deriveSteps(hookApp.status)

  const requiredActions: RequiredAction[] = hookApp.status === 'additional_info_needed'
    ? [{
        id: `action-${hookApp.id}`,
        title: 'Additional Information Required',
        description: hookApp.notes ?? 'Please provide the requested documentation to continue processing your application.',
        type: 'document' as const,
      }]
    : []

  return {
    id: hookApp.id,
    programName: hookApp.template_name,
    programType: deriveProgramType(hookApp.template_name),
    status: mappedStatus,
    submissionDate,
    lastUpdated: new Date(hookApp.last_updated),
    stepsCompleted: steps.completed,
    totalSteps: steps.total,
    caseNumber: hookApp.case_number ?? undefined,
    assignedWorker: undefined,
    requiredActions,
    timeline: buildTimeline(hookApp.status, submissionDate),
  }
}

// ============================================
// STATUS CONFIGURATION
// ============================================
const STATUS_CONFIG: Record<ApplicationStatus, { label: string; bgColor: string; textColor: string; icon: React.ElementType }> = {
  submitted: {
    label: 'Submitted',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: FileText,
  },
  under_review: {
    label: 'Under Review',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: CheckCircle,
  },
  denied: {
    label: 'Denied',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    icon: XCircle,
  },
  action_required: {
    label: 'Action Required',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: AlertTriangle,
  },
}

const PROGRAM_TYPE_ICONS: Record<Application['programType'], { bgColor: string; textColor: string }> = {
  food: { bgColor: 'bg-green-100', textColor: 'text-green-600' },
  healthcare: { bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
  housing: { bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  utilities: { bgColor: 'bg-yellow-100', textColor: 'text-yellow-600' },
  cash: { bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return formatDate(date)
}

// ============================================
// STATUS BADGE COMPONENT
// ============================================
interface StatusBadgeProps {
  status: ApplicationStatus
  size?: 'sm' | 'md'
}

function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.textColor} ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  )
}

// ============================================
// PROGRESS INDICATOR COMPONENT
// ============================================
interface ProgressIndicatorProps {
  completed: number
  total: number
}

function ProgressIndicator({ completed, total }: ProgressIndicatorProps) {
  const percentage = Math.round((completed / total) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#4a5d23] rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {completed}/{total} steps
      </span>
    </div>
  )
}

// ============================================
// STATUS TIMELINE COMPONENT
// ============================================
interface StatusTimelineProps {
  timeline: TimelineStep[]
}

function StatusTimeline({ timeline }: StatusTimelineProps) {
  return (
    <div className="space-y-0">
      {timeline.map((step, index) => {
        const isLast = index === timeline.length - 1

        return (
          <div key={step.id} className="flex gap-3">
            {/* Timeline Line and Dot */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                step.status === 'completed'
                  ? 'bg-[#4a5d23]'
                  : step.status === 'current'
                    ? 'bg-amber-500 ring-2 ring-amber-200'
                    : 'bg-stone-300'
              }`} />
              {!isLast && (
                <div className={`w-0.5 h-8 ${
                  step.status === 'completed' ? 'bg-[#4a5d23]' : 'bg-stone-200'
                }`} />
              )}
            </div>

            {/* Step Content */}
            <div className="pb-2 flex-1">
              <p className={`text-sm font-medium ${
                step.status === 'pending' ? 'text-stone-400' : 'text-stone-900'
              }`}>
                {step.label}
              </p>
              {step.date && (
                <p className="text-xs text-muted-foreground">{step.date}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// REQUIRED ACTION ITEM COMPONENT
// ============================================
interface RequiredActionItemProps {
  action: RequiredAction
  onUpload: () => void
}

function RequiredActionItem({ action, onUpload }: RequiredActionItemProps) {
  const iconMap: Record<RequiredAction['type'], React.ElementType> = {
    document: Upload,
    interview: Phone,
    verification: FileText,
  }
  const Icon = iconMap[action.type]

  return (
    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-orange-900">{action.title}</p>
          <p className="text-xs text-orange-700 mt-0.5">{action.description}</p>
          {action.deadline && (
            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Due by {action.deadline}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onUpload}
          className="flex-shrink-0 text-orange-700 border-orange-300 hover:bg-orange-100"
        >
          <Upload className="w-3 h-3 mr-1" />
          Upload
        </Button>
      </div>
    </div>
  )
}

// ============================================
// APPLICATION CARD COMPONENT
// ============================================
interface ApplicationCardProps {
  application: Application
  onViewDetails: (id: string) => void
  onUploadDocument: (applicationId: string, actionId: string) => void
  onContactSupport: (id: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

function ApplicationCard({
  application,
  onViewDetails,
  onUploadDocument,
  onContactSupport,
  isExpanded,
  onToggleExpand,
}: ApplicationCardProps) {
  const programColors = PROGRAM_TYPE_ICONS[application.programType]

  return (
    <div className="bg-[#faf9f6] border border-stone-200 rounded-xl overflow-hidden hover:border-[#4a5d23]/30 transition-all">
      {/* Card Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-start gap-3">
          {/* Program Icon */}
          <div className={`w-10 h-10 rounded-lg ${programColors.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Building2 className={`w-5 h-5 ${programColors.textColor}`} />
          </div>

          {/* Program Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-sm text-stone-900 truncate">
                {application.programName}
              </h3>
              <StatusBadge status={application.status} />
            </div>

            {application.caseNumber && (
              <p className="text-xs text-muted-foreground mb-2">
                Case #: {application.caseNumber}
              </p>
            )}

            {/* Progress */}
            <ProgressIndicator
              completed={application.stepsCompleted}
              total={application.totalSteps}
            />
          </div>

          {/* Expand Arrow */}
          <ChevronRight
            className={`w-5 h-5 text-stone-400 flex-shrink-0 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </div>

        {/* Date Info */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-200/50 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Submitted {formatDate(application.submissionDate)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Updated {getRelativeTime(application.lastUpdated)}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-stone-200/50">
          {/* Required Actions */}
          {application.requiredActions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">
                Required Actions ({application.requiredActions.length})
              </h4>
              <div className="space-y-2">
                {application.requiredActions.map((action) => (
                  <RequiredActionItem
                    key={action.id}
                    action={action}
                    onUpload={() => onUploadDocument(application.id, action.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-3">
              Application Timeline
            </h4>
            <StatusTimeline timeline={application.timeline} />
          </div>

          {/* Assigned Worker */}
          {application.assignedWorker && (
            <div className="mt-4 p-3 bg-stone-100 rounded-lg">
              <p className="text-xs text-muted-foreground mb-0.5">Assigned Case Worker</p>
              <p className="text-sm font-medium">{application.assignedWorker}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="default"
              size="sm"
              onClick={() => onViewDetails(application.id)}
              className="flex-1"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onContactSupport(application.id)}
              className="flex-1"
            >
              <Phone className="w-3 h-3 mr-1" />
              Contact Support
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// FILTER TABS COMPONENT
// ============================================
interface FilterTabsProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  counts: Record<FilterType, number>
}

const FILTER_LIST: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
]

function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % FILTER_LIST.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + FILTER_LIST.length) % FILTER_LIST.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = FILTER_LIST.length - 1
    else return
    e.preventDefault()
    tabRefs.current[next]?.focus()
    onFilterChange(FILTER_LIST[next].key)
  }

  return (
    <div
      role="tablist"
      aria-label="Filter applications"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {FILTER_LIST.map((filter, index) => {
        const isActive = activeFilter === filter.key
        return (
          <button
            key={filter.key}
            ref={(el) => { tabRefs.current[index] = el }}
            role="tab"
            id={`app-tab-${filter.key}`}
            aria-selected={isActive}
            aria-controls="app-tabpanel"
            tabIndex={isActive ? 0 : -1}
            onClick={() => onFilterChange(filter.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              isActive
                ? 'bg-[#4a5d23] text-white'
                : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
            }`}
          >
            {filter.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isActive
                ? 'bg-white/20'
                : 'bg-stone-300/50'
            }`}>
              {counts[filter.key]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================
function EmptyState({ onBrowsePrograms }: { onBrowsePrograms: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#4a5d23]/10 flex items-center justify-center mb-4">
        <ClipboardList className="w-8 h-8 text-[#4a5d23]" />
      </div>
      <h3 className="font-semibold text-lg text-stone-900 mb-1">
        No Applications Yet
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Start your journey by applying for benefits. We'll help you track every step of the process.
      </p>
      <Button
        className="bg-[#4a5d23] hover:bg-[#3d4d1c]"
        onClick={onBrowsePrograms}
      >
        Browse Available Programs
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  )
}

// ============================================
// MAIN APPLICATIONS PANEL
// ============================================
export function ApplicationsPanel({ userId }: ApplicationsPanelProps) {
  const { applications: hookApps, isLoading, error, deleteApplication } = useApplications()
  const { setActivePanel } = usePanelContext()
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleBrowsePrograms = useCallback(() => {
    setActivePanel('programs')
  }, [setActivePanel])

  // Adapt hook data to panel types
  const applications = useMemo(() => hookApps.map(adaptApplication), [hookApps])

  // Calculate filter counts — memoized so it only recomputes when applications change
  const counts = useMemo<Record<FilterType, number>>(() => ({
    all: applications.length,
    in_progress: applications.filter(a =>
      a.status === 'submitted' || a.status === 'under_review' || a.status === 'action_required'
    ).length,
    approved: applications.filter(a => a.status === 'approved').length,
    denied: applications.filter(a => a.status === 'denied').length,
  }), [applications])

  // Filter applications — memoized so it only recomputes when applications or activeFilter change
  const filteredApplications = useMemo(() => applications.filter(app => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'in_progress') {
      return app.status === 'submitted' || app.status === 'under_review' || app.status === 'action_required'
    }
    if (activeFilter === 'approved') return app.status === 'approved'
    if (activeFilter === 'denied') return app.status === 'denied'
    return true
  }), [applications, activeFilter])

  const handleViewDetails = (id: string) => {
    const app = filteredApplications.find(a => a.id === id)
    if (app) {
      setExpandedId(expandedId === id ? null : id)
    }
  }

  const handleUploadDocument = (_applicationId: string, _actionId: string) => {
    setActivePanel('documents')
  }

  const handleContactSupport = (_id: string) => {
    setActivePanel('chat')
  }

  const handleToggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" />
        <p className="text-sm text-muted-foreground">Loading applications...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertTriangle className="w-8 h-8 text-orange-500" />
        <p className="text-sm text-stone-700 font-medium">Failed to load applications</p>
        <p className="text-xs text-muted-foreground">{getFriendlyErrorMessage(error, "We couldn't load your applications. Please try again.")}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-semibold text-xl text-stone-900 mb-1">My Applications</h2>
        <p className="text-sm text-muted-foreground">
          Track your benefit applications and manage required actions
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4">
        <FilterTabs
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={counts}
        />
      </div>

      {/* Applications List */}
      <div
        id="app-tabpanel"
        role="tabpanel"
        aria-labelledby={`app-tab-${activeFilter}`}
        className="flex-1 overflow-y-auto"
      >
        {applications.length === 0 ? (
          <EmptyState onBrowsePrograms={handleBrowsePrograms} />
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No applications match this filter</p>
            <button
              onClick={() => setActiveFilter('all')}
              className="text-sm text-[#4a5d23] hover:underline mt-2"
            >
              View all applications
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onViewDetails={handleViewDetails}
                onUploadDocument={handleUploadDocument}
                onContactSupport={handleContactSupport}
                isExpanded={expandedId === application.id}
                onToggleExpand={() => handleToggleExpand(application.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
