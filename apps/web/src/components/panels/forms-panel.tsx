'use client'

// apps/web/src/components/panels/forms-panel.tsx
// Forms Panel - Browse, fill out, and submit benefit application forms
// Tabs: Available Forms, In Progress, Submitted

import React, { useState, useMemo } from 'react'
import {
  FileText,
  Clock,
  ChevronRight,
  Play,
  Trash2,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileCheck,
  Calendar,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFormTemplates, type FormTemplateWithMeta } from '@/hooks/use-form-templates'
import { useUserSubmissions } from '@/hooks/use-form-submission'
import type { FormSubmission as HookFormSubmission } from '@/hooks/use-form-submission'

// ============================================
// TYPES
// ============================================
type TabType = 'available' | 'in-progress' | 'submitted'

interface FormsPanelProps {
  userId?: string
}

interface FormTemplate {
  id: string
  name: string
  description: string
  estimatedTime: number // in minutes
  requiredDocs: string[]
  category: 'benefits' | 'healthcare' | 'housing' | 'utilities' | 'food'
}

interface FormInProgressData {
  id: string
  templateId: string
  templateName: string
  progress: number
  lastSaved: Date
  category: FormTemplate['category']
}

interface FormSubmission {
  id: string
  templateId: string
  templateName: string
  submittedAt: Date
  status: 'pending' | 'under-review' | 'approved' | 'denied' | 'needs-info'
  category: FormTemplate['category']
}

// ============================================
// ADAPTERS: Hook data → Panel types
// ============================================
function deriveCategoryFromName(name: string | null): FormTemplate['category'] {
  if (!name) return 'benefits'
  const lower = name.toLowerCase()
  if (lower.includes('snap') || lower.includes('food') || lower.includes('wic')) return 'food'
  if (lower.includes('medicaid') || lower.includes('health')) return 'healthcare'
  if (lower.includes('section 8') || lower.includes('housing')) return 'housing'
  if (lower.includes('liheap') || lower.includes('energy') || lower.includes('utilit')) return 'utilities'
  return 'benefits'
}

function adaptTemplate(row: FormTemplateWithMeta): FormTemplate {
  const schema = row.schema
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? schema.description ?? '',
    estimatedTime: schema.metadata?.estimatedTime ?? 30,
    requiredDocs: schema.metadata?.requiredDocuments ?? [],
    category: (row.category as FormTemplate['category']) ?? deriveCategoryFromName(row.name),
  }
}

function mapSubmissionStatus(status: string): FormSubmission['status'] {
  switch (status) {
    case 'draft': return 'pending'
    case 'submitted': return 'pending'
    case 'processing': return 'under-review'
    case 'approved': return 'approved'
    case 'rejected': return 'denied'
    case 'archived': return 'approved'
    default: return 'pending'
  }
}

function adaptSubmission(
  sub: HookFormSubmission,
  templateMap: Map<string, FormTemplateWithMeta>
): FormSubmission {
  const tmpl = templateMap.get(sub.templateId)
  return {
    id: sub.id,
    templateId: sub.templateId,
    templateName: tmpl?.name ?? 'Unknown Form',
    submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : new Date(sub.createdAt),
    status: mapSubmissionStatus(sub.status),
    category: tmpl ? ((tmpl.category as FormTemplate['category']) ?? deriveCategoryFromName(tmpl.name)) : 'benefits',
  }
}

function adaptDraft(
  sub: HookFormSubmission,
  templateMap: Map<string, FormTemplateWithMeta>
): FormInProgressData {
  const tmpl = templateMap.get(sub.templateId)
  // Estimate progress from filled data fields
  const dataKeys = Object.keys(sub.data || {}).length
  const progress = Math.min(Math.round((dataKeys / Math.max(dataKeys + 3, 5)) * 100), 95)

  return {
    id: sub.id,
    templateId: sub.templateId,
    templateName: tmpl?.name ?? 'Unknown Form',
    progress,
    lastSaved: new Date(sub.updatedAt),
    category: tmpl ? ((tmpl.category as FormTemplate['category']) ?? deriveCategoryFromName(tmpl.name)) : 'benefits',
  }
}

// ============================================
// CATEGORY COLORS
// ============================================
const CATEGORY_COLORS: Record<FormTemplate['category'], string> = {
  benefits: 'bg-purple-100 text-purple-700',
  healthcare: 'bg-blue-100 text-blue-700',
  housing: 'bg-orange-100 text-orange-700',
  utilities: 'bg-yellow-100 text-yellow-700',
  food: 'bg-green-100 text-green-700',
}

const STATUS_CONFIG: Record<FormSubmission['status'], { color: string; icon: React.ElementType; label: string }> = {
  'pending': { color: 'text-stone-500', icon: Clock, label: 'Pending' },
  'under-review': { color: 'text-blue-600', icon: Loader2, label: 'Under Review' },
  'approved': { color: 'text-green-600', icon: CheckCircle, label: 'Approved' },
  'denied': { color: 'text-red-600', icon: AlertCircle, label: 'Denied' },
  'needs-info': { color: 'text-orange-600', icon: AlertCircle, label: 'Needs Info' },
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return formatDate(date)
}

// ============================================
// ESTIMATED TIME DISPLAY
// ============================================
interface EstimatedTimeProps {
  minutes: number
}

function EstimatedTime({ minutes }: EstimatedTimeProps) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  let display = ''
  if (hours > 0) {
    display = `${hours}h ${mins > 0 ? `${mins}m` : ''}`
  } else {
    display = `${mins} min`
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-stone-500">
      <Clock className="w-3.5 h-3.5" />
      <span>Est. {display}</span>
    </div>
  )
}

// ============================================
// REQUIRED DOCS LIST
// ============================================
interface RequiredDocsProps {
  docs: string[]
  maxShow?: number
}

function RequiredDocs({ docs, maxShow = 3 }: RequiredDocsProps) {
  const visibleDocs = docs.slice(0, maxShow)
  const remaining = docs.length - maxShow

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-stone-600 mb-1.5">Required Documents:</p>
      <ul className="space-y-1">
        {visibleDocs.map((doc, index) => (
          <li key={index} className="flex items-center gap-1.5 text-xs text-stone-500">
            <FileCheck className="w-3 h-3 flex-shrink-0" />
            <span>{doc}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-xs text-stone-400">
            +{remaining} more document{remaining > 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  )
}

// ============================================
// FORM TEMPLATE CARD
// ============================================
interface FormTemplateCardProps {
  template: FormTemplate
  onStart: (templateId: string) => void
}

function FormTemplateCard({ template, onStart }: FormTemplateCardProps) {
  const categoryColor = CATEGORY_COLORS[template.category]

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-200 hover:border-[#4a5d23]/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{template.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${categoryColor}`}>
              {template.category}
            </span>
          </div>
          <EstimatedTime minutes={template.estimatedTime} />
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0 ml-3">
          <FileText className="w-5 h-5 text-[#4a5d23]" />
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-stone-600 leading-relaxed mb-3 line-clamp-2">
        {template.description}
      </p>

      {/* Required Documents */}
      <RequiredDocs docs={template.requiredDocs} />

      {/* Action Button */}
      <Button
        onClick={() => onStart(template.id)}
        className="w-full mt-4"
        size="sm"
      >
        <Play className="w-3.5 h-3.5 mr-1.5" />
        Start Application
      </Button>
    </div>
  )
}

// ============================================
// FORM IN PROGRESS COMPONENT
// ============================================
interface FormInProgressCardProps {
  form: FormInProgressData
  onContinue: (formId: string) => void
  onDelete: (formId: string) => void
}

function FormInProgressCard({ form, onContinue, onDelete }: FormInProgressCardProps) {
  const categoryColor = CATEGORY_COLORS[form.category]

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-200 hover:border-[#4a5d23]/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{form.templateName}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${categoryColor}`}>
              {form.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Last saved {formatRelativeDate(form.lastSaved)}</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 ml-3">
          <ClipboardList className="w-5 h-5 text-orange-600" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-stone-600">Progress</span>
          <span className="text-xs font-semibold text-[#4a5d23]">{form.progress}%</span>
        </div>
        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4a5d23] rounded-full transition-all duration-300"
            style={{ width: `${form.progress}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => onContinue(form.id)}
          className="flex-1"
          size="sm"
        >
          <ChevronRight className="w-3.5 h-3.5 mr-1" />
          Continue
        </Button>
        <Button
          onClick={() => onDelete(form.id)}
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ============================================
// SUBMISSION CARD
// ============================================
interface SubmissionCardProps {
  submission: FormSubmission
  onView: (submissionId: string) => void
}

function SubmissionCard({ submission, onView }: SubmissionCardProps) {
  const categoryColor = CATEGORY_COLORS[submission.category]
  const statusConfig = STATUS_CONFIG[submission.status]
  const StatusIcon = statusConfig.icon

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-200 hover:border-[#4a5d23]/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{submission.templateName}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${categoryColor}`}>
              {submission.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Submitted {formatDate(submission.submittedAt)}</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0 ml-3">
          <FileCheck className="w-5 h-5 text-[#4a5d23]" />
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-1.5 ${statusConfig.color}`}>
          <StatusIcon className={`w-4 h-4 ${submission.status === 'under-review' ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">{statusConfig.label}</span>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={() => onView(submission.id)}
        variant="outline"
        className="w-full"
        size="sm"
      >
        <Eye className="w-3.5 h-3.5 mr-1.5" />
        View Submission
      </Button>
    </div>
  )
}

// ============================================
// TAB BUTTON
// ============================================
interface TabButtonProps {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}

function TabButton({ label, count, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
        isActive
          ? 'bg-[#4a5d23] text-white'
          : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
        isActive
          ? 'bg-white/20 text-white'
          : 'bg-stone-300/50 text-stone-600'
      }`}>
        {count}
      </span>
    </button>
  )
}

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  title: string
  description: string
  icon: React.ElementType
}

function EmptyState({ title, description, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-stone-400" />
      </div>
      <h3 className="font-medium text-stone-700 mb-1">{title}</h3>
      <p className="text-sm text-stone-500 max-w-sm">{description}</p>
    </div>
  )
}

// ============================================
// MAIN FORMS PANEL
// ============================================
export function FormsPanel({ userId }: FormsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('available')

  // Live data hooks
  const { templates: rawTemplates, loading: templatesLoading, error: templatesError } = useFormTemplates()
  const { submissions: rawSubmissions, loading: submissionsLoading, error: submissionsError, refresh: refreshSubmissions } = useUserSubmissions()

  // Build a template lookup map
  const templateMap = useMemo(() => {
    const map = new Map<string, FormTemplateWithMeta>()
    for (const t of rawTemplates) map.set(t.id, t)
    return map
  }, [rawTemplates])

  // Adapt hook data to panel types
  const templates = useMemo(() => rawTemplates.map(adaptTemplate), [rawTemplates])

  const { inProgress, submissions } = useMemo(() => {
    const drafts: FormInProgressData[] = []
    const submitted: FormSubmission[] = []

    for (const sub of rawSubmissions) {
      if (sub.status === 'draft') {
        drafts.push(adaptDraft(sub, templateMap))
      } else {
        submitted.push(adaptSubmission(sub, templateMap))
      }
    }
    return { inProgress: drafts, submissions: submitted }
  }, [rawSubmissions, templateMap])

  const isLoading = templatesLoading || submissionsLoading
  const error = templatesError || submissionsError

  // Handlers
  const handleStartForm = (_templateId: string) => {
    // TODO: Navigate to form builder with selected template
  }

  const handleContinueForm = (_formId: string) => {
    // TODO: Navigate to form builder with draft loaded
  }

  const handleDeleteDraft = async (formId: string) => {
    // TODO: Wire to delete submission via hook; for now refresh list
    await refreshSubmissions()
  }

  const handleViewSubmission = (_submissionId: string) => {
    // TODO: Navigate to submission detail view
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" />
        <p className="text-sm text-muted-foreground">Loading forms...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="w-8 h-8 text-orange-500" />
        <p className="text-sm text-stone-700 font-medium">Failed to load forms</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900 mb-1">
            Forms & Applications
          </h1>
          <p className="text-sm text-stone-600">
            Apply for benefits, assistance programs, and community resources.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          <TabButton
            label="Available Forms"
            count={templates.length}
            isActive={activeTab === 'available'}
            onClick={() => setActiveTab('available')}
          />
          <TabButton
            label="In Progress"
            count={inProgress.length}
            isActive={activeTab === 'in-progress'}
            onClick={() => setActiveTab('in-progress')}
          />
          <TabButton
            label="Submitted"
            count={submissions.length}
            isActive={activeTab === 'submitted'}
            onClick={() => setActiveTab('submitted')}
          />
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {/* Available Forms Tab */}
          {activeTab === 'available' && (
            <>
              {templates.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No Forms Available"
                  description="Check back later for available application forms."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <FormTemplateCard
                      key={template.id}
                      template={template}
                      onStart={handleStartForm}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* In Progress Tab */}
          {activeTab === 'in-progress' && (
            <>
              {inProgress.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No Forms In Progress"
                  description="Start a new application from the Available Forms tab."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inProgress.map((form) => (
                    <FormInProgressCard
                      key={form.id}
                      form={form}
                      onContinue={handleContinueForm}
                      onDelete={handleDeleteDraft}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Submitted Tab */}
          {activeTab === 'submitted' && (
            <>
              {submissions.length === 0 ? (
                <EmptyState
                  icon={FileCheck}
                  title="No Submissions Yet"
                  description="Complete and submit an application to see it here."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submissions.map((submission) => (
                    <SubmissionCard
                      key={submission.id}
                      submission={submission}
                      onView={handleViewSubmission}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
