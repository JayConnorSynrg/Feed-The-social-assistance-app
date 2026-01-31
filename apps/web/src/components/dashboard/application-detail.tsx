'use client'

// apps/web/src/components/dashboard/application-detail.tsx
// Detailed view of a single application with status updates and timeline

import React, { useState } from 'react'
import { type Application, type ApplicationStatus, type ApplicationTimelineEvent, getStatusDisplay } from '@/hooks/use-applications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Status Update Modal
interface StatusUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  currentStatus: ApplicationStatus
  onUpdateStatus: (status: ApplicationStatus, note: string) => Promise<void>
}

const AVAILABLE_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'additional_info_needed'],
  under_review: ['approved', 'denied', 'additional_info_needed'],
  additional_info_needed: ['under_review', 'submitted'],
  approved: ['closed'],
  denied: ['appealed', 'closed'],
  appealed: ['under_review', 'approved', 'denied'],
  closed: [],
}

export function StatusUpdateModal({
  isOpen,
  onClose,
  currentStatus,
  onUpdateStatus,
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | null>(null)
  const [note, setNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const availableStatuses = AVAILABLE_STATUS_TRANSITIONS[currentStatus] || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStatus) return

    setIsUpdating(true)
    try {
      await onUpdateStatus(selectedStatus, note)
      onClose()
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Update Application Status</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Status</label>
              <div className="space-y-2">
                {availableStatuses.map(status => {
                  const info = getStatusDisplay(status)
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedStatus === status
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className="mr-2">{info.icon}</span>
                      {info.label}
                    </button>
                  )
                })}
              </div>
              {availableStatuses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No status changes available for this application.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Note (optional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note about this status change..."
                className="w-full p-3 border rounded-lg resize-none h-24"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedStatus || isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Add Note Form
interface AddNoteFormProps {
  onAddNote: (note: string) => Promise<void>
}

export function AddNoteForm({ onAddNote }: AddNoteFormProps) {
  const [note, setNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return

    setIsAdding(true)
    try {
      await onAddNote(note.trim())
      setNote('')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note..."
        className="w-full p-3 border rounded-lg resize-none h-20"
      />
      <Button
        type="submit"
        size="sm"
        disabled={!note.trim() || isAdding}
        className="mt-2"
      >
        {isAdding ? 'Adding...' : 'Add Note'}
      </Button>
    </form>
  )
}

// Set Deadline Form
interface SetDeadlineFormProps {
  currentDeadline?: string | null
  onSetDeadline: (deadline: Date) => Promise<void>
}

export function SetDeadlineForm({ currentDeadline, onSetDeadline }: SetDeadlineFormProps) {
  const [deadline, setDeadline] = useState(currentDeadline || '')
  const [isSetting, setIsSetting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deadline) return

    setIsSetting(true)
    try {
      await onSetDeadline(new Date(deadline))
    } finally {
      setIsSetting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-1">Deadline</label>
        <Input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>
      <Button type="submit" size="sm" disabled={!deadline || isSetting}>
        {isSetting ? 'Setting...' : 'Set'}
      </Button>
    </form>
  )
}

// Case Number Form
interface SetCaseNumberFormProps {
  currentCaseNumber?: string | null
  onSetCaseNumber: (caseNumber: string) => Promise<void>
}

export function SetCaseNumberForm({ currentCaseNumber, onSetCaseNumber }: SetCaseNumberFormProps) {
  const [caseNumber, setCaseNumber] = useState(currentCaseNumber || '')
  const [isSetting, setIsSetting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseNumber.trim()) return

    setIsSetting(true)
    try {
      await onSetCaseNumber(caseNumber.trim())
    } finally {
      setIsSetting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-1">Case Number</label>
        <Input
          type="text"
          value={caseNumber}
          onChange={e => setCaseNumber(e.target.value)}
          placeholder="Enter case number from agency"
        />
      </div>
      <Button type="submit" size="sm" disabled={!caseNumber.trim() || isSetting}>
        {isSetting ? 'Setting...' : 'Set'}
      </Button>
    </form>
  )
}

// Timeline component
interface TimelineProps {
  events: ApplicationTimelineEvent[]
}

export function ApplicationTimeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {index < events.length - 1 && (
              <div className="w-0.5 h-full bg-border" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <p className="text-sm">{event.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(event.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Main detail view
interface ApplicationDetailViewProps {
  application: Application
  onUpdateStatus: (status: ApplicationStatus, note: string) => Promise<void>
  onAddNote: (note: string) => Promise<void>
  onSetDeadline: (deadline: Date) => Promise<void>
  onSetCaseNumber: (caseNumber: string) => Promise<void>
  onDelete: () => Promise<void>
}

export function ApplicationDetailView({
  application,
  onUpdateStatus,
  onAddNote,
  onSetDeadline,
  onSetCaseNumber,
  onDelete,
}: ApplicationDetailViewProps) {
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const statusInfo = getStatusDisplay(application.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>{statusInfo.icon}</span>
                {application.template_name}
              </h1>

              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    statusInfo.color === 'green' ? 'bg-green-100 text-green-800' :
                    statusInfo.color === 'red' ? 'bg-red-100 text-red-800' :
                    statusInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    statusInfo.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                    statusInfo.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {statusInfo.label}
                </span>

                {application.case_number && (
                  <span className="text-muted-foreground">
                    Case #{application.case_number}
                  </span>
                )}
              </div>

              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                <p>Created: {new Date(application.created_at).toLocaleDateString()}</p>
                <p>Last Updated: {new Date(application.last_updated).toLocaleDateString()}</p>
                {application.submitted_at && (
                  <p>Submitted: {new Date(application.submitted_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={() => setShowStatusModal(true)}>
                Update Status
              </Button>
              {application.status === 'draft' && (
                <Button variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                  Delete Draft
                </Button>
              )}
            </div>
          </div>

          {application.deadline && (
            <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                ⏰ Deadline: {new Date(application.deadline).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Set Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <SetDeadlineForm
              currentDeadline={application.deadline}
              onSetDeadline={onSetDeadline}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Case Number</CardTitle>
          </CardHeader>
          <CardContent>
            <SetCaseNumberForm
              currentCaseNumber={application.case_number}
              onSetCaseNumber={onSetCaseNumber}
            />
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {application.notes ? (
            <div className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-lg">
              {application.notes}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
          <AddNoteForm onAddNote={onAddNote} />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationTimeline events={application.timeline} />
        </CardContent>
      </Card>

      {/* Status Update Modal */}
      <StatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        currentStatus={application.status}
        onUpdateStatus={onUpdateStatus}
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="font-bold text-lg mb-2">Delete Draft?</h3>
              <p className="text-muted-foreground mb-4">
                This will permanently delete your draft application. This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={onDelete}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
