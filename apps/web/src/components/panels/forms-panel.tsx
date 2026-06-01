'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
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
  FilePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFormTemplates, type FormTemplateWithMeta } from '@/hooks/use-form-templates'
import { useUserSubmissions } from '@/hooks/use-vault-form-submission'
import type { FormSubmission as HookFormSubmission } from '@/hooks/use-vault-form-submission'
import { createClient } from '@/lib/supabase/client'
import { FormWizard } from '@/components/forms/form-wizard'
import { PdfAnnotator } from '@/components/forms/pdf-annotator-dynamic'
import { VaultGuard } from '@/components/vault'
import { usePanelContext } from '@/components/layout/feed-shell'
import { useEncryptedUpload } from '@/hooks/use-encrypted-upload'
import { logger } from '@/lib/logger'

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

type WizardState =
  | { mode: 'list' }
  | { mode: 'wizard'; templateId: string; submissionId?: string }
  | { mode: 'view'; submissionId: string }
  | { mode: 'pdf'; file: File; fileName: string }

interface FormsTarget {
  programId: string
  programName: string
  formType?: string
  applicationUrl: string | null
}

// ============================================
// ADAPTERS: Hook data → Panel types
// ============================================
function deriveCategoryFromFormType(formType: string): FormTemplate['category'] {
  switch (formType) {
    case 'snap': case 'wic': case 'tanf': return 'food'
    case 'medicaid': return 'healthcare'
    case 'housing': return 'housing'
    case 'utility': return 'utilities'
    default: return 'benefits'
  }
}

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
    category: deriveCategoryFromFormType(row.form_type) ?? deriveCategoryFromName(row.name),
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
    category: tmpl ? (deriveCategoryFromFormType(tmpl.form_type) ?? deriveCategoryFromName(tmpl.name)) : 'benefits',
  }
}

function adaptDraft(
  sub: HookFormSubmission,
  templateMap: Map<string, FormTemplateWithMeta>
): FormInProgressData {
  const tmpl = templateMap.get(sub.templateId)
  // Estimate progress from filled data fields
  const dataKeys = Object.keys(sub.formData || {}).length
  const progress = Math.min(Math.round((dataKeys / Math.max(dataKeys + 3, 5)) * 100), 95)

  return {
    id: sub.id,
    templateId: sub.templateId,
    templateName: tmpl?.name ?? 'Unknown Form',
    progress,
    lastSaved: new Date(sub.updatedAt),
    category: tmpl ? (deriveCategoryFromFormType(tmpl.form_type) ?? deriveCategoryFromName(tmpl.name)) : 'benefits',
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
  tabId: string
  panelId: string
  count: number
  isActive: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  buttonRef: (el: HTMLButtonElement | null) => void
}

function TabButton({ label, tabId, panelId, count, isActive, onClick, onKeyDown, buttonRef }: TabButtonProps) {
  return (
    <button
      ref={buttonRef}
      id={tabId}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
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
const FORMS_TABS: { key: TabType; label: string; panelId: string }[] = [
  { key: 'available', label: 'Available Forms', panelId: 'forms-panel-available' },
  { key: 'in-progress', label: 'In Progress', panelId: 'forms-panel-in-progress' },
  { key: 'submitted', label: 'Submitted', panelId: 'forms-panel-submitted' },
]

export function FormsPanel({ userId }: FormsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('available')
  const [wizardState, setWizardState] = useState<WizardState>({ mode: 'list' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { panelParams, setPanelParams, setActivePanel } = usePanelContext()
  const { uploadFile } = useEncryptedUpload()

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % FORMS_TABS.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + FORMS_TABS.length) % FORMS_TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = FORMS_TABS.length - 1
    else return
    e.preventDefault()
    tabRefs.current[next]?.focus()
    setActiveTab(FORMS_TABS[next].key)
  }, [])

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

  // Deep-link from programs panel: open the correct template directly
  useEffect(() => {
    const ft = panelParams.formsTarget as FormsTarget | undefined
    if (!ft) return
    // Consume the param immediately so back-nav / re-render doesn't re-trigger
    setPanelParams((prev) => {
      const { formsTarget: _, ...rest } = prev
      return rest
    })
    // Both branches land on the available tab; synchronising tab with an external
    // trigger (panelParams deep-link) is the intended use of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('available')
    if (!ft.formType) {
      // No TS wizard module for this category — fail-open to template list
      return
    }
    const matched = templates.find((t) => {
      const raw = rawTemplates.find((r) => r.id === t.id)
      return raw?.form_type === ft.formType
    })
    if (matched) {
      setWizardState({ mode: 'wizard', templateId: matched.id })
    }
    // If no template matches, fail-open: stay on list view (wizardState already 'list')
  }, [panelParams.formsTarget, templates, rawTemplates, setPanelParams])

  // Handlers
  const handleStartForm = (templateId: string) => {
    setWizardState({ mode: 'wizard', templateId })
  }

  const handleContinueForm = (formId: string) => {
    const draft = inProgress.find((f) => f.id === formId)
    if (draft) {
      setWizardState({ mode: 'wizard', templateId: draft.templateId, submissionId: formId })
    }
  }

  const handleDeleteDraft = async (formId: string) => {
    const supabase = createClient()
    await supabase.from('form_submissions').delete().eq('id', formId)
    await refreshSubmissions()
  }

  const handleViewSubmission = (submissionId: string) => {
    setWizardState({ mode: 'view', submissionId })
  }

  const handleWizardComplete = async () => {
    setWizardState({ mode: 'list' })
    setActiveTab('submitted')
    await refreshSubmissions()
  }

  const handleWizardCancel = () => {
    setWizardState({ mode: 'list' })
  }

  const handleOpenPdfPicker = () => {
    fileInputRef.current?.click()
  }

  const handlePdfFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWizardState({ mode: 'pdf', file, fileName: file.name })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const [pdfSaveError, setPdfSaveError] = useState<string | null>(null)

  const handlePdfSave = async (pdfBytes: Uint8Array) => {
    setPdfSaveError(null)
    const fileName = wizardState.mode === 'pdf' ? wizardState.fileName : 'annotated.pdf'

    try {
      const filledFile = new File([pdfBytes as Uint8Array<ArrayBuffer>], fileName, { type: 'application/pdf' })
      await uploadFile(filledFile, 'other')
      setWizardState({ mode: 'list' })
      // Clear the 'forms' subtab so DocumentsPanel mounts in 'documents' (My Documents)
      // view, not back in the forms subtab. Without this, the stale subtab='forms' from
      // the current navigation causes the Documents panel to re-enter FormsPanel,
      // preventing the P3 assertion (Documents heading visible) from passing.
      setPanelParams((prev) => ({ ...prev, subtab: 'documents' }))
      setActivePanel('documents')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save PDF'
      setPdfSaveError(message)
      logger.error('pdf.save.error', err, { fileName })
      // Do NOT navigate — stay on annotator so user can retry
    }
  }

  const handlePdfCancel = () => {
    setWizardState({ mode: 'list' })
  }

  if (wizardState.mode === 'pdf') {
    return (
      <VaultGuard>
        {pdfSaveError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200">
            <p className="text-xs text-red-600">{pdfSaveError}</p>
          </div>
        )}
        <PdfAnnotator
          file={wizardState.file}
          onSave={handlePdfSave}
          onCancel={handlePdfCancel}
        />
      </VaultGuard>
    )
  }

  if (wizardState.mode === 'wizard') {
    return (
      <VaultGuard>
        <FormWizard
          templateId={wizardState.templateId}
          existingSubmissionId={wizardState.submissionId}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      </VaultGuard>
    )
  }

  if (wizardState.mode === 'view') {
    const sub = rawSubmissions.find((s) => s.id === wizardState.submissionId)
    const tmpl = sub ? templateMap.get(sub.templateId) : null
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-stone-900">{tmpl?.name ?? 'Submission'}</h1>
            <Button variant="outline" size="sm" onClick={() => setWizardState({ mode: 'list' })}>
              Back
            </Button>
          </div>
          {sub ? (
            <div className="p-5 bg-[#faf9f6] border border-stone-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Status:</span>
                <span className="text-sm font-medium capitalize">{sub.status}</span>
              </div>
              {sub.submittedAt && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Submitted:</span>
                  <span className="text-sm">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="space-y-3 pt-2">
                {Object.entries(sub.formData || {}).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-stone-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                    <dd className="text-sm text-stone-900">{String(value)}</dd>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Submission not found.</p>
          )}
        </div>
      </div>
    )
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
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handlePdfFileSelected}
          aria-hidden="true"
        />

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 mb-1">
              Forms & Applications
            </h1>
            <p className="text-sm text-stone-600">
              Apply for benefits, assistance programs, and community resources.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenPdfPicker}
            className="flex-shrink-0 mt-1"
          >
            <FilePlus className="w-3.5 h-3.5 mr-1.5" />
            Fill PDF Form
          </Button>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Forms sections"
          className="flex gap-2 overflow-x-auto mb-6 pb-1"
        >
          {FORMS_TABS.map((tab, index) => {
            const count = tab.key === 'available' ? templates.length : tab.key === 'in-progress' ? inProgress.length : submissions.length
            return (
              <TabButton
                key={tab.key}
                tabId={`forms-tab-${tab.key}`}
                panelId={tab.panelId}
                label={tab.label}
                count={count}
                isActive={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                buttonRef={(el) => { tabRefs.current[index] = el }}
              />
            )
          })}
        </div>

        {/* Tab Content */}
        <div
          id={FORMS_TABS.find(t => t.key === activeTab)?.panelId}
          role="tabpanel"
          aria-labelledby={`forms-tab-${activeTab}`}
          className="space-y-4"
        >
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
