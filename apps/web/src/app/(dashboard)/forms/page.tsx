'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Plus,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useFormTemplates } from '@/hooks/use-form-templates'
import { useUserSubmissions, type SubmissionStatus } from '@/hooks/use-form-submission'
import type { FormTemplateSchema } from '@/lib/form-schemas'

// ============================================
// Status Badge Component
// ============================================

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const config: Record<
    SubmissionStatus,
    { label: string; className: string; icon: typeof CheckCircle }
  > = {
    draft: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      icon: FileText,
    },
    submitted: {
      label: 'Submitted',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      icon: Clock,
    },
    processing: {
      label: 'Processing',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      icon: Clock,
    },
    approved: {
      label: 'Approved',
      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      icon: CheckCircle,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      icon: AlertCircle,
    },
    archived: {
      label: 'Archived',
      className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
      icon: FileText,
    },
  }

  const { label, className, icon: Icon } = config[status]

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ============================================
// Template Card Component
// ============================================

interface TemplateCardProps {
  template: FormTemplateSchema
}

function TemplateCard({ template }: TemplateCardProps) {
  return (
    <Link href={`/forms/fill/${template.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            {template.name}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
          {template.description && (
            <CardDescription className="line-clamp-2">
              {template.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {template.metadata?.estimatedTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ~{template.metadata.estimatedTime} min
              </span>
            )}
            {template.metadata?.agency && (
              <span className="px-2 py-0.5 bg-muted rounded-full">
                {template.metadata.agency}
              </span>
            )}
            {template.metadata?.category && (
              <span className="px-2 py-0.5 bg-muted rounded-full capitalize">
                {template.metadata.category}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ============================================
// Submission Card Component
// ============================================

interface SubmissionCardProps {
  submission: {
    id: string
    templateId: string
    status: SubmissionStatus
    createdAt: string
    updatedAt: string
    submittedAt?: string
  }
  templateName?: string
}

function SubmissionCard({ submission, templateName }: SubmissionCardProps) {
  const formattedDate = new Date(submission.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link href={`/forms/submission/${submission.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">
                {templateName || submission.templateId}
              </h3>
              <p className="text-sm text-muted-foreground">
                Last updated {formattedDate}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={submission.status} />
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ============================================
// Main Forms Page
// ============================================

export default function FormsPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'submissions'>('templates')
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all')

  const { templates, loading: templatesLoading } = useFormTemplates()
  const { submissions, loading: submissionsLoading, refresh } = useUserSubmissions(
    statusFilter !== 'all' ? { status: statusFilter } : {}
  )

  // Refresh submissions when filter changes
  useEffect(() => {
    refresh()
  }, [statusFilter, refresh])

  // Get template name by ID
  const getTemplateName = (templateId: string): string | undefined => {
    return templates.find((t) => t.id === templateId)?.name
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Forms</h1>
        <p className="text-muted-foreground mt-2">
          Apply for benefits and manage your applications
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Available Forms
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'submissions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          My Applications
          {submissions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-muted rounded-full">
              {submissions.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'templates' ? (
        <div>
          {templatesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No Forms Available</h3>
                <p className="text-muted-foreground">
                  Check back later for available forms.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Status Filter */}
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as SubmissionStatus | 'all')
              }
              className="text-sm border rounded-md px-2 py-1 bg-background"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="processing">Processing</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {submissionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                        <div className="h-4 bg-muted rounded w-1/3" />
                      </div>
                      <div className="h-6 bg-muted rounded w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No Applications</h3>
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t started any applications yet.
                </p>
                <Button onClick={() => setActiveTab('templates')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start an Application
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  templateName={getTemplateName(submission.templateId)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
