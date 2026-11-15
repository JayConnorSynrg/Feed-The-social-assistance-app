'use client'

// apps/web/src/components/panels/forms-panel.tsx
//
// P6 W9: FEED's own words here — the heading, tabs, cards' chrome, statuses, buttons, empty and
// failure lines, the delete-draft dialog and the guest prompts — are in the member's language
// (lib/i18n-forms.ts), with lang/dir on the panel root and the portalled dialog. A form template's
// own text (its name, description, required documents) and a government form's official name and
// number mirror official English forms and stay as written, marked lang="en" (owner decision
// pending). What a member typed into a submission is their own text (lang="" dir="auto").
// Template ids, form types, storage paths and every payload are the same in every language.
// Focus never falls to <body>: leaving the wizard, the annotator or a submission returns it to
// the control that opened it, and deleting a draft moves it to the next draft or the tab.

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
  ExternalLink,
  Download,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useFormTemplates, type FormTemplateWithMeta } from '@/hooks/use-form-templates'
import { useUserSubmissions } from '@/hooks/use-vault-form-submission'
import type { FormSubmission as HookFormSubmission } from '@/hooks/use-vault-form-submission'
import { createClient } from '@/lib/supabase/client'
import { FormWizard } from '@/components/forms/form-wizard'
import { PdfAnnotator } from '@/components/forms/pdf-annotator-dynamic'
import { VaultGuard } from '@/components/vault'
import { usePanelContext } from '@/components/layout/feed-shell'
import { useEncryptedUpload } from '@/hooks/use-encrypted-upload'
import { useVaultSecureProfile } from '@/hooks/use-vault-secure-profile'
import { useAuth } from '@/hooks/use-auth'
import { mapProfileToAutofill, type AutofillValues } from '@/lib/form-field-mapper'
import { GOVERNMENT_FORMS, type GovernmentForm } from '@/lib/government-forms'
import { logger } from '@/lib/logger'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { formatCount, formatDate as formatLocaleDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { relativeAge } from '@/lib/relative-age'
import { failureCode } from '@/lib/failure-code'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { FRIENDLY_ERROR_SENTENCES, friendlyErrorT } from '@/lib/i18n-friendly-error'
import { estimatedTimeText, formsCategoryLabel, formsMoreDocuments, formsT, govCategoryLabel, type FormsKey } from '@/lib/i18n-forms'
import { nextTabIndex } from '@/components/feed/feed-chrome'
import { cn } from '@/lib/utils'
import { OFFICIAL_ENGLISH } from '@/lib/official-english'
import { afterLayout, announce, AnnouncementText, clearAnnouncement, focusAfterRowRemoval, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

// ============================================
// TYPES
// ============================================
type TabType = 'available' | 'in-progress' | 'submitted'

interface FormsPanelProps {
  userId?: string
  /** A filled PDF was saved to My Documents (the hub then switches there): the host announces it. */
  onPdfSaved?: () => void
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
  status: 'pending' | 'under-review' | 'approved' | 'denied' | 'needs-info' | 'expired'
  category: FormTemplate['category']
}

type WizardState =
  | { mode: 'list' }
  | { mode: 'wizard'; templateId: string; submissionId?: string }
  | { mode: 'view'; submissionId: string }
  | { mode: 'pdf'; file: File; fileName: string }
  // gov-pdf: open a government form from the storage bucket
  | { mode: 'gov-pdf'; file: File; fileName: string; govForm: GovernmentForm }

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

/** The live submission_status enum (draft, in_progress, submitted, under_review, approved, denied,
 *  pending_info, expired) plus the older values some rows still carry (processing, rejected,
 *  archived). */
export function mapSubmissionStatus(status: string): FormSubmission['status'] {
  switch (status) {
    case 'draft': return 'pending'
    case 'in_progress': return 'pending'
    case 'submitted': return 'pending'
    case 'under_review': return 'under-review'
    case 'processing': return 'under-review'
    case 'approved': return 'approved'
    case 'denied': return 'denied'
    case 'rejected': return 'denied'
    case 'pending_info': return 'needs-info'
    case 'expired': return 'expired'
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
    templateName: tmpl?.name ?? '',
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
    templateName: tmpl?.name ?? '',
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
  food: 'bg-green-100 text-green-800',
}

const STATUS_CONFIG: Record<FormSubmission['status'], { color: string; icon: React.ElementType; label: FormsKey }> = {
  'pending': { color: 'text-stone-700', icon: Clock, label: 'statusPending' },
  'under-review': { color: 'text-blue-800', icon: Loader2, label: 'statusUnderReview' },
  'approved': { color: 'text-green-800', icon: CheckCircle, label: 'statusApproved' },
  'denied': { color: 'text-red-700', icon: AlertCircle, label: 'statusDenied' },
  'needs-info': { color: 'text-orange-800', icon: AlertCircle, label: 'statusNeedsInfo' },
  'expired': { color: 'text-stone-700', icon: Clock, label: 'statusExpired' },
}

/** A busy or unavailable button keeps focus (aria-disabled) and reads as unavailable in solid colours. */
const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'

// ============================================
// ESTIMATED TIME DISPLAY
// ============================================
function EstimatedTime({ minutes, locale }: { minutes: number; locale: Locale }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-stone-700">
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{estimatedTimeText(minutes, locale)}</span>
    </div>
  )
}

// ============================================
// REQUIRED DOCS LIST
// ============================================
interface RequiredDocsProps {
  docs: string[]
  maxShow?: number
  locale: Locale
}

function RequiredDocs({ docs, maxShow = 3, locale }: RequiredDocsProps) {
  const visibleDocs = docs.slice(0, maxShow)
  const remaining = docs.length - maxShow

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-stone-700 mb-1.5">{formsT(locale, 'requiredDocs')}</p>
      <ul className="space-y-1">
        {visibleDocs.map((doc, index) => (
          <li key={index} className="flex items-center gap-1.5 text-xs text-stone-700">
            <FileCheck className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {/* The template's own words (mirroring the official form): English, marked so. */}
            <span {...OFFICIAL_ENGLISH}>{doc}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-xs text-stone-700">
            {formsMoreDocuments(remaining, locale)}
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
  locale: Locale
}

function FormTemplateCard({ template, onStart, locale }: FormTemplateCardProps) {
  const categoryColor = CATEGORY_COLORS[template.category]
  const nameId = `form-template-${template.id}`

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-300 hover:border-[#4a5d23]/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 id={nameId} className="font-medium text-sm truncate" {...OFFICIAL_ENGLISH}>{template.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {formsCategoryLabel(template.category, locale)}
            </span>
          </div>
          <EstimatedTime minutes={template.estimatedTime} locale={locale} />
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0 ms-3">
          <FileText className="w-5 h-5 text-[#4a5d23]" aria-hidden="true" />
        </div>
      </div>

      {/* Description — the template's own words */}
      <p className="text-xs text-stone-700 leading-relaxed mb-3 line-clamp-2" {...OFFICIAL_ENGLISH}>
        {template.description}
      </p>

      {/* Required Documents */}
      <RequiredDocs docs={template.requiredDocs} locale={locale} />

      {/* Action Button */}
      <Button
        onClick={() => onStart(template.id)}
        className="w-full mt-4"
        size="sm"
        aria-describedby={nameId}
        data-return-id={`start-${template.id}`}
      >
        <Play className="w-3.5 h-3.5 me-1.5 rtl:-scale-x-100" aria-hidden="true" />
        {formsT(locale, 'startApplication')}
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
  locale: Locale
}

function FormInProgressCard({ form, onContinue, onDelete, locale }: FormInProgressCardProps) {
  const categoryColor = CATEGORY_COLORS[form.category]
  const nameId = `form-draft-${form.id}`
  const progressId = `form-draft-progress-${form.id}`

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-300 hover:border-[#4a5d23]/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 id={nameId} className="font-medium text-sm truncate">{form.templateName ? <span {...OFFICIAL_ENGLISH}>{form.templateName}</span> : formsT(locale, 'submissionFallback')}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {formsCategoryLabel(form.category, locale)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-700">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{formatMessage(formsT(locale, 'lastSaved'), { when: relativeAge(form.lastSaved.toISOString(), locale) })}</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 ms-3">
          <ClipboardList className="w-5 h-5 text-orange-800" aria-hidden="true" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-stone-700" id={progressId}>{formsT(locale, 'progress')}</span>
          <span className="text-xs font-semibold text-[#4a5d23]">{formatCount(form.progress, locale)}%</span>
        </div>
        <div
          className="w-full h-2 bg-stone-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-labelledby={progressId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={form.progress}
        >
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
          aria-describedby={nameId}
          data-return-id={`continue-${form.id}`}
        >
          <ChevronRight className="w-3.5 h-3.5 me-1 rtl:-scale-x-100" aria-hidden="true" />
          {formsT(locale, 'continue')}
        </Button>
        <Button
          onClick={() => onDelete(form.id)}
          variant="outline"
          size="sm"
          aria-label={formsT(locale, 'deleteDraft')}
          aria-describedby={nameId}
          data-return-id={`delete-${form.id}`}
          className="text-red-700 hover:text-red-800 hover:bg-red-50 border-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
  locale: Locale
}

function SubmissionCard({ submission, onView, locale }: SubmissionCardProps) {
  const categoryColor = CATEGORY_COLORS[submission.category]
  const statusConfig = STATUS_CONFIG[submission.status]
  const StatusIcon = statusConfig.icon
  const nameId = `form-submission-${submission.id}`

  return (
    <div className="p-4 rounded-xl bg-[#faf9f6] border border-stone-300 hover:border-[#4a5d23]/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 id={nameId} className="font-medium text-sm truncate">{submission.templateName ? <span {...OFFICIAL_ENGLISH}>{submission.templateName}</span> : formsT(locale, 'submissionFallback')}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {formsCategoryLabel(submission.category, locale)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-700">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{formatMessage(formsT(locale, 'submittedOn'), { date: formatLocaleDate(submission.submittedAt.toISOString(), locale, browserTimeZone()) })}</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0 ms-3">
          <FileCheck className="w-5 h-5 text-[#4a5d23]" aria-hidden="true" />
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-1.5 ${statusConfig.color}`}>
          <StatusIcon className={`w-4 h-4 ${submission.status === 'under-review' ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          <span className="text-sm font-medium">{formsT(locale, statusConfig.label)}</span>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={() => onView(submission.id)}
        variant="outline"
        className="w-full border-stone-500"
        size="sm"
        aria-describedby={nameId}
        data-return-id={`view-${submission.id}`}
      >
        <Eye className="w-3.5 h-3.5 me-1.5" aria-hidden="true" />
        {formsT(locale, 'viewSubmission')}
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
  count: string
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
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
        isActive
          ? 'bg-[#4a5d23] text-white'
          : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-800'
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
        isActive
          ? 'bg-black/20 text-white'
          : 'bg-stone-300/50 text-stone-800'
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
  description: React.ReactNode
  icon: React.ElementType
}

function EmptyState({ title, description, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-stone-600" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-stone-800 mb-1">{title}</h3>
      <p className="text-sm text-stone-700 max-w-sm">{description}</p>
    </div>
  )
}


// ============================================
// GOVERNMENT FORM CARD
// ============================================
const GOV_CATEGORY_COLORS: Record<string, string> = {
  eitc_tax_filing: 'bg-emerald-100 text-emerald-700',
  housing: 'bg-orange-100 text-orange-700',
  veteran: 'bg-blue-100 text-blue-700',
  disability: 'bg-purple-100 text-purple-700',
  food: 'bg-green-100 text-green-800',
}

interface GovernmentFormCardProps {
  form: GovernmentForm
  /** True when the PDF is available in the storage bucket */
  inBucket: boolean
  onOpen: (form: GovernmentForm) => void
  isLoading: boolean
  locale: Locale
}

function GovernmentFormCard({ form, inBucket, onOpen, isLoading, locale }: GovernmentFormCardProps) {
  const categoryColor = GOV_CATEGORY_COLORS[form.category] ?? 'bg-stone-100 text-stone-700'
  const nameId = `gov-form-${form.storagePath.replace(/[^a-z0-9]/gi, '-')}`
  const [beforeNumber, afterNumber] = splitMessage(formsT(locale, 'formNumber'), 'number')

  return (
    <div
      data-testid="gov-form-card"
      data-gov-form-path={form.storagePath}
      className="p-4 rounded-xl bg-[#faf9f6] border border-stone-300 hover:border-[#4a5d23]/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* The program's official name: English, marked so. */}
            <h3 id={nameId} className="font-medium text-sm truncate" {...OFFICIAL_ENGLISH}>{form.programName}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {govCategoryLabel(form.category, locale)}
            </span>
          </div>
          <p className="text-xs text-stone-700">
            {beforeNumber}<bdi {...OFFICIAL_ENGLISH}>{form.formNumber}</bdi>{afterNumber}
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#4a5d23]/10 flex items-center justify-center flex-shrink-0 ms-3">
          <Globe className="w-5 h-5 text-[#4a5d23]" aria-hidden="true" />
        </div>
      </div>

      {inBucket ? (
        <Button
          onClick={() => { if (!isLoading) onOpen(form) }}
          aria-disabled={isLoading}
          aria-busy={isLoading || undefined}
          aria-describedby={nameId}
          data-return-id={`gov-${form.storagePath}`}
          className={cn('w-full mt-3', isLoading && UNAVAILABLE)}
          size="sm"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="w-3.5 h-3.5 me-1.5" aria-hidden="true" />
          )}
          {formsT(locale, 'fillAnnotate')}
        </Button>
      ) : (
        <a
          href={form.applicationUrl ?? form.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby={nameId}
          className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md border border-stone-500 text-sm font-medium text-stone-800 hover:bg-stone-50 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 rtl:-scale-x-100" aria-hidden="true" />
          {formsT(locale, 'openAgencySite')}
          <span className="sr-only"> {formsT(locale, 'opensNewTab')}</span>
        </a>
      )}
    </div>
  )
}

// ============================================
// MAIN FORMS PANEL
// ============================================
const FORMS_TABS: { key: TabType; label: FormsKey; panelId: string }[] = [
  { key: 'available', label: 'tabAvailable', panelId: 'forms-panel-available' },
  { key: 'in-progress', label: 'tabInProgress', panelId: 'forms-panel-in-progress' },
  { key: 'submitted', label: 'tabSubmitted', panelId: 'forms-panel-submitted' },
]

export function FormsPanel({ userId, onPdfSaved }: FormsPanelProps) {
  const locale = useProfileLocale()
  const t = (key: FormsKey) => formsT(locale, key)
  const [activeTab, setActiveTab] = useState<TabType>('available')
  const [wizardState, setWizardState] = useState<WizardState>({ mode: 'list' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteInFlight = useRef(false)
  // The delete-draft dialog's failure line (a keyed node: a repeated failure is spoken again).
  const [deleteAlert, setDeleteAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  // Each failure shown in a region takes a new number, so its node is replaced and spoken again.
  const [failSeq, setFailSeq] = useState(0)
  const failed = () => setFailSeq((n) => n + 1)
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  // The control a sub-view was opened from (data-return-id): focus returns there on the way back.
  const returnTo = useRef<string | null>(null)
  const { panelParams, setPanelParams, setActivePanel } = usePanelContext()
  const { uploadFile } = useEncryptedUpload()
  // A sub-view's heading takes focus once, when it mounts.
  const focusOnMount = useCallback((node: HTMLElement | null) => { node?.focus() }, [])

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const next = nextTabIndex(e.key, index, FORMS_TABS.length, locale)
    if (next === null) return
    e.preventDefault()
    tabRefs.current[next]?.focus()
    setActiveTab(FORMS_TABS[next].key)
  }, [locale])

  /** Back on the list: focus the control the sub-view was opened from, else the heading. */
  const backToList = useCallback((target?: string | null) => {
    const id = target === undefined ? returnTo.current : target
    returnTo.current = null
    setWizardState({ mode: 'list' })
    afterLayout(() => {
      const host = listRef.current
      const el = (id ? host?.querySelector<HTMLElement>(`[data-return-id="${CSS.escape(id)}"]`) : null) ?? host?.querySelector<HTMLElement>('h1')
      el?.focus()
    })
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
  // The spinner is for the first load only: a later refresh keeps the tabs, the list and the
  // status line mounted, so focus and announcements survive it.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(!isLoading)
  if (!isLoading && !hasLoadedOnce) setHasLoadedOnce(true)

  // The hooks write no row for a failed read: one code-only row per failed load (each load ends
  // with loading false, so an identical failure after a retry is written again).
  useEffect(() => {
    if (error && !isLoading) logger.warn('error_surface.shown', { surface: 'forms', kind: 'load_failed', locale })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isLoading])

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
    returnTo.current = `start-${templateId}`
    setWizardState({ mode: 'wizard', templateId })
  }

  const handleContinueForm = (formId: string) => {
    const draft = inProgress.find((f) => f.id === formId)
    if (draft) {
      returnTo.current = `continue-${formId}`
      setWizardState({ mode: 'wizard', templateId: draft.templateId, submissionId: formId })
    }
  }

  // The draft the dialog was opened for, kept after the dialog's state clears (focus returns to it).
  const confirmDeleteIdRef = useRef<string | null>(null)
  const handleDeleteDraft = (formId: string) => {
    clearAnnouncement(setDeleteAlert)
    confirmDeleteIdRef.current = formId
    setConfirmDeleteId(formId)
  }

  // Set when the draft left: the dialog's close then leaves focus to this handler.
  const draftDeletedRef = useRef(false)
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || deleteInFlight.current) return
    deleteInFlight.current = true
    setDeleting(true)
    const ids = inProgress.map((f) => f.id)
    const deletedId = confirmDeleteId
    try {
      const supabase = createClient()
      const { error: deleteFailure } = await supabase.from('form_submissions').delete().eq('id', deletedId)
      if (deleteFailure) {
        // No row is written for this path elsewhere: one code-only row.
        logger.warn('error_surface.shown', { surface: 'forms', kind: failureCode(deleteFailure), locale })
        announce(setDeleteAlert, t('draftDeleteFailed'))
        return
      }
      draftDeletedRef.current = true
      setConfirmDeleteId(null)
      await refreshSubmissions()
      announce(setStatus, t('draftDeleted'))
      const nextId = focusAfterRowRemoval(ids, deletedId)
      afterLayout(() => {
        const host = listRef.current
        const next = nextId ? host?.querySelector<HTMLElement>(`[data-return-id="continue-${CSS.escape(nextId)}"]`) : null
        ;(next ?? tabRefs.current[1])?.focus()
      })
    } finally {
      deleteInFlight.current = false
      setDeleting(false)
    }
  }

  const handleViewSubmission = (submissionId: string) => {
    returnTo.current = `view-${submissionId}`
    setWizardState({ mode: 'view', submissionId })
  }

  const handleWizardComplete = async () => {
    returnTo.current = null
    setWizardState({ mode: 'list' })
    setActiveTab('submitted')
    // The new submission is on the Submitted tab: focus goes to that tab, and the result is said
    // once in the status line (mounted with the list, empty, before the words arrive).
    afterLayout(() => {
      tabRefs.current[2]?.focus()
      announce(setStatus, t('applicationSubmitted'))
    })
    await refreshSubmissions()
  }

  const handleWizardCancel = () => {
    backToList()
  }

  const handleOpenPdfPicker = () => {
    returnTo.current = 'fill-pdf'
    fileInputRef.current?.click()
  }

  const handlePdfFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWizardState({ mode: 'pdf', file, fileName: file.name })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const [pdfSaveError, setPdfSaveError] = useState<FormsKey | null>(null)

  // ── Government Forms state ──────────────────────────────────────────
  // Track which storage paths exist in the bucket (keyed by storagePath)
  const [bucketPaths, setBucketPaths] = useState<Set<string>>(new Set())
  const [govFormsLoading, setGovFormsLoading] = useState(false)
  // The failing form's official number (the line is translated; the number stays as printed).
  const [govFormsError, setGovFormsError] = useState<string | null>(null)
  // Which gov form is currently being downloaded (storagePath → loading)
  const [govFormDownloading, setGovFormDownloading] = useState<string | null>(null)

  // Vault profile for autofill — mirrors documents-panel pattern
  const { profile: vaultProfile } = useVaultSecureProfile()
  const { user, isAnonymous } = useAuth()
  const autofillValues: AutofillValues = useMemo(
    () => mapProfileToAutofill({ vaultProfile: vaultProfile ?? null, publicProfile: null, email: user?.email }),
    [vaultProfile, user?.email]
  )

  // Probe which gov forms are available in the bucket on mount
  useEffect(() => {
    const supabase = createClient()
    setGovFormsLoading(true)
    setGovFormsError(null)
    const controller = new AbortController()

    supabase.storage
      .from('government-forms')
      .list('federal', { limit: 100 })
      .then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) {
          // Bucket might not exist yet (migration pending); show fallback links, not error
          setGovFormsLoading(false)
          return
        }
        const present = new Set<string>()
        for (const obj of data ?? []) {
          present.add(`federal/${obj.name}`)
        }
        setBucketPaths(present)
        setGovFormsLoading(false)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setGovFormsLoading(false)
      })

    return () => controller.abort()
  }, [])

  // Download a gov form from the bucket and open it in the PdfAnnotator
  const handleOpenGovForm = useCallback(async (form: GovernmentForm) => {
    returnTo.current = `gov-${form.storagePath}`
    setGovFormDownloading(form.storagePath)
    setGovFormsError(null)
    const supabase = createClient()

    try {
      const { data, error } = await supabase.storage
        .from('government-forms')
        .download(form.storagePath)

      if (error || !data) {
        // This branch wrote no row: one code-only row (the catch below writes gov_forms.download.error).
        logger.warn('error_surface.shown', { surface: 'government-forms', kind: error ? failureCode(error) : 'no_data', locale })
        setGovFormsError(form.formNumber)
        failed()
        return
      }

      const fileBlob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' })
      const fileName = form.storagePath.split('/').pop() ?? `${form.formNumber}.pdf`
      const file = new File([fileBlob], fileName, { type: 'application/pdf' })
      setWizardState({ mode: 'gov-pdf', file, fileName, govForm: form })
    } catch (err) {
      setGovFormsError(form.formNumber)
      failed()
      logger.error('gov_forms.download.error', err, { storagePath: form.storagePath })
    } finally {
      setGovFormDownloading(null)
    }
  }, [locale])

  const handlePdfSave = async (data: { sourceBytes: Uint8Array; annotations: import('@/hooks/use-pdf-annotation').TextAnnotation[] }) => {
    setPdfSaveError(null)
    const fileName = wizardState.mode === 'pdf' ? wizardState.fileName : 'annotated.pdf'

    try {
      // Build the source File from unflattened bytes
      const sourceFile = new File(
        [data.sourceBytes as Uint8Array<ArrayBuffer>],
        fileName,
        { type: 'application/pdf' }
      )
      // Store source + encrypted annotations sidecar — document is re-editable
      await uploadFile(sourceFile, 'other', data.annotations)
      setWizardState({ mode: 'list' })
      // Clear the 'applications' subtab so DocumentsPanel mounts in 'documents' (My Documents)
      // view, not back in the applications subtab. Without this, the stale subtab='applications'
      // from the current navigation causes the Documents panel to re-enter FormsPanel,
      // preventing the P3 assertion (Documents heading visible) from passing.
      setPanelParams((prev) => ({ ...prev, subtab: 'documents' }))
      setActivePanel('documents')
      onPdfSaved?.()
    } catch (err) {
      setPdfSaveError('pdfSaveFailed')
      failed()
      logger.error('pdf.save.error', err, { fileName })
      // Do NOT navigate — stay on annotator so user can retry
    }
  }

  const handlePdfCancel = () => {
    setPdfSaveError(null)
    backToList()
  }

  // Pre-lock flush persist for the PDF annotator: store the current source +
  // encrypted annotations sidecar to Documents WITHOUT navigating away. Invoked
  // by the annotator just before the vault auto-locks (15-min idle) so unsaved
  // annotations survive the VaultGuard unmount. Reuses the same uploadFile path
  // as handlePdfSave; the saved document is recoverable/re-editable in Documents.
  // Errors propagate to runPreLockFlush, which logs and proceeds to lock anyway.
  const persistPdfDraft = useCallback(
    async (data: { sourceBytes: Uint8Array; annotations: import('@/hooks/use-pdf-annotation').TextAnnotation[] }) => {
      const fileName = wizardState.mode === 'pdf' ? wizardState.fileName
        : wizardState.mode === 'gov-pdf' ? wizardState.fileName
        : 'annotated.pdf'
      const sourceFile = new File(
        [data.sourceBytes as Uint8Array<ArrayBuffer>],
        fileName,
        { type: 'application/pdf' }
      )
      await uploadFile(sourceFile, 'other', data.annotations)
      logger.info('pdf.prelock_flush.saved', { fileName, annotation_count: data.annotations.length })
    },
    [wizardState, uploadFile]
  )

  if (wizardState.mode === 'gov-pdf') {
    // Anonymous guests may open gov PDFs but cannot fill/save them (vault requires account).
    if (isAnonymous) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 gap-4" lang={locale} dir={dir(locale)}>
          <CreateAccountPrompt message={t('guestGovForms')} linkLabel={feedChromeT(locale, 'createAccount')} />
          <button
            type="button"
            onClick={() => backToList()}
            className="text-sm text-stone-700 underline hover:text-stone-900"
          >
            {t('backToForms')}
          </button>
        </div>
      )
    }
    return (
      <div className="h-full" lang={locale} dir={dir(locale)}>
        <VaultGuard onDismiss={handlePdfCancel}>
          <div role="alert" data-testid="pdf-save-alert">
            {pdfSaveError && (
              <div key={failSeq} className="px-4 py-2 bg-red-50 border-b border-red-300">
                <p className="text-xs text-red-800">{t(pdfSaveError)}</p>
              </div>
            )}
          </div>
          <PdfAnnotator
            file={wizardState.file}
            autofillValues={autofillValues}
            onSave={handlePdfSave}
            onFlushDraft={persistPdfDraft}
            onCancel={handlePdfCancel}
          />
        </VaultGuard>
      </div>
    )
  }

  if (wizardState.mode === 'pdf') {
    if (isAnonymous) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 gap-4" lang={locale} dir={dir(locale)}>
          <CreateAccountPrompt message={t('guestGovForms')} linkLabel={feedChromeT(locale, 'createAccount')} />
          <button type="button" onClick={handlePdfCancel} className="text-sm text-stone-700 underline hover:text-stone-900">{t('backToForms')}</button>
        </div>
      )
    }
    return (
      <div className="h-full" lang={locale} dir={dir(locale)}>
        <VaultGuard onDismiss={handlePdfCancel}>
          <div role="alert" data-testid="pdf-save-alert">
            {pdfSaveError && (
              <div key={failSeq} className="px-4 py-2 bg-red-50 border-b border-red-300">
                <p className="text-xs text-red-800">{t(pdfSaveError)}</p>
              </div>
            )}
          </div>
          <PdfAnnotator
            file={wizardState.file}
            onSave={handlePdfSave}
            onFlushDraft={persistPdfDraft}
            onCancel={handlePdfCancel}
          />
        </VaultGuard>
      </div>
    )
  }

  if (wizardState.mode === 'wizard') {
    if (isAnonymous) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 gap-4" lang={locale} dir={dir(locale)}>
          <CreateAccountPrompt message={t('guestWizard')} linkLabel={feedChromeT(locale, 'createAccount')} />
          <button type="button" onClick={handleWizardCancel} className="text-sm text-stone-700 underline hover:text-stone-900">{t('backToForms')}</button>
        </div>
      )
    }
    return (
      <div className="h-full" lang={locale} dir={dir(locale)}>
        <VaultGuard onDismiss={handleWizardCancel}>
          <FormWizard
            templateId={wizardState.templateId}
            existingSubmissionId={wizardState.submissionId}
            onComplete={handleWizardComplete}
            onCancel={handleWizardCancel}
          />
        </VaultGuard>
      </div>
    )
  }

  if (wizardState.mode === 'view') {
    const sub = rawSubmissions.find((s) => s.id === wizardState.submissionId)
    const tmpl = sub ? templateMap.get(sub.templateId) : null
    const fieldLabel = (key: string) => tmpl?.schema.fields.find((f) => f.name === key)?.label ?? key.replace(/_/g, ' ')
    return (
      <div className="h-full flex flex-col overflow-y-auto" lang={locale} dir={dir(locale)} data-testid="submission-view">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-stone-900" tabIndex={-1} ref={focusOnMount}>
              {tmpl?.name ? <span {...OFFICIAL_ENGLISH}>{tmpl.name}</span> : t('submissionFallback')}
            </h1>
            <Button variant="outline" size="sm" onClick={() => backToList()} className="border-stone-500">
              <ChevronRight className="w-3.5 h-3.5 rotate-180 rtl:rotate-0" aria-hidden="true" />
              {t('back')}
            </Button>
          </div>
          {sub ? (
            <div className="p-5 bg-[#faf9f6] border border-stone-300 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-700">{t('statusLabel')}</span>
                <span className="text-sm font-medium">{t(STATUS_CONFIG[mapSubmissionStatus(sub.status)].label)}</span>
              </div>
              {sub.submittedAt && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-700">{t('submittedLabel')}</span>
                  <span className="text-sm">{formatLocaleDate(new Date(sub.submittedAt).toISOString(), locale, browserTimeZone())}</span>
                </div>
              )}
              <dl className="space-y-3 pt-2">
                {Object.entries(sub.formData || {}).map(([key, value]) => (
                  <div key={key}>
                    {/* The form's own field label (official English) and the member's answer. */}
                    <dt className="text-xs text-stone-700" {...OFFICIAL_ENGLISH}>{fieldLabel(key)}</dt>
                    <dd className="text-sm text-stone-900" lang="" dir="auto">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-stone-700">{t('submissionNotFound')}</p>
          )}
        </div>
      </div>
    )
  }

  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3" lang={locale} dir={dir(locale)} role="status">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" aria-hidden="true" />
        <p className="text-sm text-stone-700">{t('checking')}</p>
      </div>
    )
  }

  const friendlyLoad = error ? getFriendlyErrorMessage(error, '') : ''
  const loadFailedBody = Object.prototype.hasOwnProperty.call(FRIENDLY_ERROR_SENTENCES, friendlyLoad)
    ? friendlyErrorT(locale, FRIENDLY_ERROR_SENTENCES[friendlyLoad])
    : t('loadFailedBody')

  const [noInProgressBefore, noInProgressAfter] = splitMessage(t('noInProgressBody'), 'tab')

  return (
    <div data-testid="forms-panel" className="h-full flex flex-col overflow-y-auto" lang={locale} dir={dir(locale)} ref={listRef}>
      <p role="status" className="sr-only" data-testid="forms-status">
        <AnnouncementText announcement={status} />
      </p>
      <div className="max-w-4xl mx-auto w-full px-4 py-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handlePdfFileSelected}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-stone-900 mb-1" tabIndex={-1}>
              {t('title')}
            </h1>
            <p className="text-sm text-stone-700">
              {t('subtitle')}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenPdfPicker}
            data-return-id="fill-pdf"
            className="flex-shrink-0 mt-1 border-stone-500"
          >
            <FilePlus className="w-3.5 h-3.5 me-1.5" aria-hidden="true" />
            {t('fillPdf')}
          </Button>
        </div>

        {/* A failed read of the submissions: always mounted, so each failed load is spoken; the
            tabs and the forms stay in place. */}
        <div role="alert" data-testid="forms-load-alert">
          {error && (
            <div key={failSeq} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3">
              <div>
                <p className="text-sm text-stone-800 font-medium">{t('loadFailed')}</p>
                <p className="text-xs text-stone-700">{loadFailedBody}</p>
              </div>
              <button
                type="button"
                onClick={() => void refreshSubmissions()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#4a5d23] text-white rounded-lg text-sm hover:bg-[#3d4d1c] transition-colors"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label={t('sectionsLabel')}
          className="flex flex-wrap gap-2 mb-6 pb-1"
        >
          {FORMS_TABS.map((tab, index) => {
            const count = tab.key === 'available' ? templates.length : tab.key === 'in-progress' ? inProgress.length : submissions.length
            return (
              <TabButton
                key={tab.key}
                tabId={`forms-tab-${tab.key}`}
                panelId={tab.panelId}
                label={t(tab.label)}
                count={formatCount(count, locale)}
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
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-stone-600" aria-hidden="true" />
                  </div>
                  <h3 className="font-medium text-stone-800 mb-1">{t('noForms')}</h3>
                  <p className="text-sm text-stone-700 max-w-sm mb-4">
                    {t('noFormsBody')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivePanel('chat')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#4a5d23] text-white rounded-lg text-sm hover:bg-[#3d4d1c] transition-colors"
                  >
                    {t('askAssistant')}
                  </button>
                </div>
              ) : (
                <div data-testid="form-template-list" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <FormTemplateCard
                      key={template.id}
                      template={template}
                      onStart={handleStartForm}
                      locale={locale}
                    />
                  ))}
                </div>
              )}

              {/* Government Forms section */}
              <div 
                data-testid="government-forms-section"
                data-gov-forms-loaded={!govFormsLoading ? "true" : "false"}
                className="mt-8"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-[#4a5d23]" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-stone-900">{t('govTitle')}</h2>
                  {govFormsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" aria-hidden="true" />}
                </div>
                <p className="text-xs text-stone-700 mb-4">
                  {t('govBody')}
                </p>
                <div role="alert" data-testid="gov-forms-alert">
                  {govFormsError && (() => {
                    const [before, after] = splitMessage(t('govLoadFailed'), 'form')
                    return (
                      <div key={failSeq} className="mb-3 px-3 py-2 bg-orange-50 border border-orange-300 rounded-lg">
                        <p className="text-xs text-orange-900">{before}<bdi {...OFFICIAL_ENGLISH}>{govFormsError}</bdi>{after}</p>
                      </div>
                    )
                  })()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {GOVERNMENT_FORMS.map((govForm) => (
                    <GovernmentFormCard
                      key={govForm.storagePath}
                      form={govForm}
                      inBucket={bucketPaths.has(govForm.storagePath)}
                      onOpen={handleOpenGovForm}
                      isLoading={govFormDownloading === govForm.storagePath}
                      locale={locale}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* In Progress Tab */}
          {activeTab === 'in-progress' && (
            <>
              {inProgress.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={t('noInProgress')}
                  description={<>{noInProgressBefore}{t('tabAvailable')}{noInProgressAfter}</>}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inProgress.map((form) => (
                    <FormInProgressCard
                      key={form.id}
                      form={form}
                      onContinue={handleContinueForm}
                      onDelete={handleDeleteDraft}
                      locale={locale}
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
                  title={t('noSubmissions')}
                  description={t('noSubmissionsBody')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submissions.map((submission) => (
                    <SubmissionCard
                      key={submission.id}
                      submission={submission}
                      onView={handleViewSubmission}
                      locale={locale}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete draft confirm dialog */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open && !deleteInFlight.current) setConfirmDeleteId(null) }}>
        <DialogContent
          className="sm:max-w-sm"
          lang={locale}
          dir={dir(locale)}
          closeLabel={formsT(locale, 'close')}
          data-testid="delete-draft-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (draftDeletedRef.current) { draftDeletedRef.current = false; return }
            // Cancelled: back to the draft's delete button.
            const id = confirmDeleteIdRef.current
            ;(id ? listRef.current?.querySelector<HTMLElement>(`[data-return-id="delete-${CSS.escape(id)}"]`) : null)?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('deleteDraftTitle')}</DialogTitle>
            <DialogDescription className="text-stone-700">{t('deleteDraftBody')}</DialogDescription>
          </DialogHeader>
          <p role="alert" className="text-sm text-red-700" data-testid="delete-draft-alert">
            <AnnouncementText announcement={deleteAlert} />
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { if (!deleteInFlight.current) setConfirmDeleteId(null) }} className="border-stone-500">
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleConfirmDelete()}
              aria-disabled={deleting}
              aria-busy={deleting || undefined}
              className={cn(deleting && UNAVAILABLE)}
              data-testid="delete-draft-confirm"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {t('deleteDraftConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
