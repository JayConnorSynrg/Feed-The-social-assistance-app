'use client'

import { useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Edit,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFormSubmission, type SubmissionStatus } from '@/hooks/use-form-submission'
import { useFormTemplate } from '@/hooks/use-form-templates'
import type { FormTemplateSchema } from '@/lib/form-schemas'

// ============================================
// Status Display
// ============================================

function StatusDisplay({ status }: { status: SubmissionStatus }) {
  const config: Record<
    SubmissionStatus,
    {
      label: string
      description: string
      icon: typeof CheckCircle
      colorClass: string
    }
  > = {
    draft: {
      label: 'Draft',
      description: 'This application has not been submitted yet.',
      icon: FileText,
      colorClass: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
    },
    submitted: {
      label: 'Submitted',
      description: 'Your application has been submitted and is awaiting review.',
      icon: Clock,
      colorClass: 'text-blue-600 bg-blue-100 dark:bg-blue-900',
    },
    processing: {
      label: 'Processing',
      description: 'Your application is currently being reviewed.',
      icon: Clock,
      colorClass: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900',
    },
    approved: {
      label: 'Approved',
      description: 'Congratulations! Your application has been approved.',
      icon: CheckCircle,
      colorClass: 'text-green-600 bg-green-100 dark:bg-green-900',
    },
    rejected: {
      label: 'Rejected',
      description:
        'Unfortunately, your application was not approved. You may be able to appeal or reapply.',
      icon: AlertCircle,
      colorClass: 'text-red-600 bg-red-100 dark:bg-red-900',
    },
    archived: {
      label: 'Archived',
      description: 'This application has been archived.',
      icon: FileText,
      colorClass: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
    },
  }

  const { label, description, icon: Icon, colorClass } = config[status]

  return (
    <div className={`rounded-lg p-4 ${colorClass}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6" />
        <div>
          <h3 className="font-semibold">{label}</h3>
          <p className="text-sm opacity-90">{description}</p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Timeline Component
// ============================================

interface TimelineEvent {
  label: string
  date: string | null
  completed: boolean
}

function SubmissionTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={index} className="flex items-start gap-3">
          <div
            className={`w-3 h-3 mt-1.5 rounded-full ${
              event.completed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                event.completed ? '' : 'text-muted-foreground'
              }`}
            >
              {event.label}
            </p>
            {event.date && (
              <p className="text-xs text-muted-foreground">
                {new Date(event.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Data Display Component
// ============================================

function FormDataDisplay({
  data,
  template,
}: {
  data: Record<string, unknown>
  template: FormTemplateSchema
}) {
  // Group data by section
  const sections = template.sections.map((section) => {
    const sectionFields = template.fields.filter((f) => f.section === section.id)
    const sectionData = sectionFields
      .map((field) => ({
        label: field.label,
        value: data[field.name],
        sensitive: field.sensitive,
      }))
      .filter((item) => item.value !== undefined && item.value !== '')

    return {
      ...section,
      data: sectionData,
    }
  })

  return (
    <div className="space-y-6">
      {sections.map(
        (section) =>
          section.data.length > 0 && (
            <div key={section.id}>
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
                {section.title}
              </h4>
              <div className="space-y-2">
                {section.data.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium">
                      {item.sensitive ? '••••••••' : String(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  )
}

// ============================================
// Main Submission Page
// ============================================

export default function SubmissionDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const submissionId = params.submissionId as string
  const showSuccess = searchParams.get('success') === 'true'

  const { submission, loading, error, loadSubmission } = useFormSubmission()
  const { template, loading: templateLoading } = useFormTemplate(
    submission?.templateId || null
  )

  // Load submission on mount
  useEffect(() => {
    loadSubmission(submissionId)
  }, [submissionId, loadSubmission])

  // Loading state
  if (loading || templateLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading submission...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error || !submission) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card className="border-destructive">
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-4" />
            <p className="text-destructive font-medium">
              {error || 'Submission not found'}
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/forms">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Forms
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Build timeline events
  const timelineEvents: TimelineEvent[] = [
    { label: 'Application Created', date: submission.createdAt, completed: true },
    {
      label: 'Application Submitted',
      date: submission.submittedAt || null,
      completed: !!submission.submittedAt,
    },
    {
      label: 'Under Review',
      date: submission.status === 'processing' ? submission.updatedAt : null,
      completed: ['processing', 'approved', 'rejected'].includes(submission.status),
    },
    {
      label: 'Decision Made',
      date: submission.processedAt || null,
      completed: ['approved', 'rejected'].includes(submission.status),
    },
  ]

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/forms"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Forms
        </Link>

        <h1 className="text-2xl font-bold">
          {template?.name || 'Application'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Submission ID: {submission.id.slice(0, 8)}...
        </p>
      </div>

      {/* Success Banner */}
      {showSuccess && submission.status === 'submitted' && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Application Submitted Successfully!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                You will be notified when there&apos;s an update on your application.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <StatusDisplay status={submission.status} />

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        {submission.status === 'draft' && (
          <Button asChild>
            <Link href={`/forms/fill/${submission.templateId}?submission=${submission.id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Continue Editing
            </Link>
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 mt-8 md:grid-cols-3">
        {/* Timeline */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionTimeline events={timelineEvents} />
          </CardContent>
        </Card>

        {/* Submitted Data */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Application Details</CardTitle>
          </CardHeader>
          <CardContent>
            {template ? (
              <FormDataDisplay data={submission.data} template={template} />
            ) : (
              <p className="text-muted-foreground">Loading form details...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes (if any) */}
      {submission.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{submission.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
