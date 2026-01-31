'use client'

// apps/web/src/app/(dashboard)/applications/[id]/page.tsx
// Single application detail page

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardHeader, MobileNav } from '@/components/dashboard/dashboard-layout'
import { ApplicationDetailView } from '@/components/dashboard/application-detail'
import { DocumentList, DocumentViewerModal } from '@/components/documents/document-viewer'
import { DocumentUpload } from '@/components/documents/document-upload'
import { CreateReminderForm, ReminderList } from '@/components/notifications/notification-list'
import {
  useApplications,
  type Application,
  type ApplicationStatus,
} from '@/hooks/use-applications'
import { useDocuments, type Document } from '@/hooks/use-documents'
import { useNotifications } from '@/hooks/use-notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const applicationId = params.id as string

  const {
    getApplication,
    updateStatus,
    addNote,
    setDeadline,
    setCaseNumber,
    deleteApplication,
  } = useApplications()

  const {
    documents,
    isLoading: docsLoading,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
  } = useDocuments()

  const {
    reminders,
    createReminder,
    completeReminder,
    deleteReminder,
  } = useNotifications()

  const [application, setApplication] = useState<Application | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)

  // Fetch application
  useEffect(() => {
    async function loadApplication() {
      setIsLoading(true)
      const app = await getApplication(applicationId)
      setApplication(app)
      setIsLoading(false)
    }
    loadApplication()
  }, [applicationId, getApplication])

  // Get documents for this application
  const applicationDocuments = documents.filter(d => d.application_id === applicationId)

  // Get reminders for this application
  const applicationReminders = reminders.filter(r => r.application_id === applicationId)

  // Handle document view
  const handleViewDocument = async (doc: Document) => {
    setViewingDocument(doc)
    const url = await getDocumentUrl(doc.file_path)
    setDocumentUrl(url)
  }

  // Handle status update
  const handleUpdateStatus = async (status: ApplicationStatus, note: string) => {
    await updateStatus(applicationId, status, note)
    const updated = await getApplication(applicationId)
    setApplication(updated)
  }

  // Handle add note
  const handleAddNote = async (note: string) => {
    await addNote(applicationId, note)
    const updated = await getApplication(applicationId)
    setApplication(updated)
  }

  // Handle deadline
  const handleSetDeadline = async (deadline: Date) => {
    await setDeadline(applicationId, deadline)
    const updated = await getApplication(applicationId)
    setApplication(updated)
  }

  // Handle case number
  const handleSetCaseNumber = async (caseNumber: string) => {
    await setCaseNumber(applicationId, caseNumber)
    const updated = await getApplication(applicationId)
    setApplication(updated)
  }

  // Handle delete
  const handleDelete = async () => {
    await deleteApplication(applicationId)
    router.push('/applications')
  }

  // Handle document upload
  const handleUploadDocument = async (file: File, category: string, description?: string) => {
    await uploadDocument(file, category as any, applicationId, description)
  }

  if (isLoading) {
    return (
      <div className="pb-20 md:pb-0">
        <DashboardHeader
          title="Loading..."
          actions={
            <Link href="/applications">
              <Button variant="outline">← Back</Button>
            </Link>
          }
        />
        <div className="animate-pulse space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="h-8 bg-muted rounded w-1/3 mb-4" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </CardContent>
          </Card>
        </div>
        <MobileNav />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="pb-20 md:pb-0">
        <DashboardHeader
          title="Application Not Found"
          actions={
            <Link href="/applications">
              <Button variant="outline">← Back to Applications</Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-muted-foreground">
              This application doesn't exist or you don't have permission to view it.
            </p>
          </CardContent>
        </Card>
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="pb-20 md:pb-0">
      <DashboardHeader
        title=""
        actions={
          <Link href="/applications">
            <Button variant="outline">← Back to Applications</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <ApplicationDetailView
            application={application}
            onUpdateStatus={handleUpdateStatus}
            onAddNote={handleAddNote}
            onSetDeadline={handleSetDeadline}
            onSetCaseNumber={handleSetCaseNumber}
            onDelete={handleDelete}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentList
                documents={applicationDocuments}
                onView={handleViewDocument}
                onDelete={deleteDocument}
                getUrl={getDocumentUrl}
                isLoading={docsLoading}
              />

              <div className="mt-4 pt-4 border-t">
                <DocumentUpload
                  onUpload={handleUploadDocument}
                  applicationId={applicationId}
                />
              </div>
            </CardContent>
          </Card>

          {/* Reminders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <ReminderList
                reminders={applicationReminders}
                onComplete={completeReminder}
                onDelete={deleteReminder}
              />
            </CardContent>
          </Card>

          <CreateReminderForm
            onCreateReminder={createReminder}
            applicationId={applicationId}
          />
        </div>
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        document={viewingDocument}
        url={documentUrl}
        onClose={() => {
          setViewingDocument(null)
          setDocumentUrl(null)
        }}
      />

      <MobileNav />
    </div>
  )
}
