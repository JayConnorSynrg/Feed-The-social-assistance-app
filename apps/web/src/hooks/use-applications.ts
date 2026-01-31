// apps/web/src/hooks/use-applications.ts
// Hook for managing benefit applications and their statuses

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'additional_info_needed'
  | 'approved'
  | 'denied'
  | 'appealed'
  | 'closed'

export interface Application {
  id: string
  user_id: string
  template_id: string
  template_name: string
  status: ApplicationStatus
  submitted_at: string | null
  last_updated: string
  created_at: string
  notes: string | null
  deadline: string | null
  case_number: string | null
  agency_name: string | null
  documents_count: number
  timeline: ApplicationTimelineEvent[]
}

export interface ApplicationTimelineEvent {
  id: string
  application_id: string
  event_type: 'status_change' | 'document_added' | 'note_added' | 'reminder_set' | 'deadline_set'
  description: string
  old_value?: string
  new_value?: string
  created_at: string
  created_by: 'user' | 'system' | 'agency'
}

export interface ApplicationStats {
  total: number
  drafts: number
  submitted: number
  under_review: number
  needs_action: number
  approved: number
  denied: number
}

export interface UseApplicationsReturn {
  applications: Application[]
  stats: ApplicationStats
  isLoading: boolean
  error: Error | null
  refreshApplications: () => Promise<void>
  getApplication: (id: string) => Promise<Application | null>
  updateStatus: (id: string, status: ApplicationStatus, note?: string) => Promise<void>
  addNote: (id: string, note: string) => Promise<void>
  setDeadline: (id: string, deadline: Date) => Promise<void>
  setCaseNumber: (id: string, caseNumber: string) => Promise<void>
  deleteApplication: (id: string) => Promise<void>
}

const STATUS_DISPLAY: Record<ApplicationStatus, { label: string; color: string; icon: string }> = {
  draft: { label: 'Draft', color: 'gray', icon: '📝' },
  submitted: { label: 'Submitted', color: 'blue', icon: '📤' },
  under_review: { label: 'Under Review', color: 'yellow', icon: '🔍' },
  additional_info_needed: { label: 'Action Needed', color: 'orange', icon: '⚠️' },
  approved: { label: 'Approved', color: 'green', icon: '✅' },
  denied: { label: 'Denied', color: 'red', icon: '❌' },
  appealed: { label: 'Appealed', color: 'purple', icon: '📨' },
  closed: { label: 'Closed', color: 'gray', icon: '📁' },
}

export function getStatusDisplay(status: ApplicationStatus) {
  return STATUS_DISPLAY[status] || STATUS_DISPLAY.draft
}

export function useApplications(): UseApplicationsReturn {
  const [applications, setApplications] = useState<Application[]>([])
  const [stats, setStats] = useState<ApplicationStats>({
    total: 0,
    drafts: 0,
    submitted: 0,
    under_review: 0,
    needs_action: 0,
    approved: 0,
    denied: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()

  const calculateStats = useCallback((apps: Application[]): ApplicationStats => {
    return {
      total: apps.length,
      drafts: apps.filter(a => a.status === 'draft').length,
      submitted: apps.filter(a => a.status === 'submitted').length,
      under_review: apps.filter(a => a.status === 'under_review').length,
      needs_action: apps.filter(a => a.status === 'additional_info_needed').length,
      approved: apps.filter(a => a.status === 'approved').length,
      denied: apps.filter(a => a.status === 'denied').length,
    }
  }, [])

  const refreshApplications = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch applications with document count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: apps, error: fetchError } = await (supabase as any)
        .from('form_submissions')
        .select(`
          id,
          user_id,
          template_id,
          status,
          submitted_at,
          updated_at,
          created_at,
          notes,
          form_templates (
            name
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (fetchError) throw fetchError

      // Define the type for the Supabase query result
      type FormSubmissionRow = {
        id: string
        user_id: string
        template_id: string
        status: string
        submitted_at: string | null
        updated_at: string
        created_at: string
        notes: string | null
        form_templates: { name: string } | null
      }

      // Transform data
      const transformedApps: Application[] = ((apps || []) as FormSubmissionRow[]).map(app => ({
        id: app.id,
        user_id: app.user_id,
        template_id: app.template_id,
        template_name: app.form_templates?.name || 'Unknown Form',
        status: (app.status as ApplicationStatus) || 'draft',
        submitted_at: app.submitted_at,
        last_updated: app.updated_at,
        created_at: app.created_at,
        notes: app.notes,
        deadline: null, // Would come from a separate field
        case_number: null, // Would come from a separate field
        agency_name: null, // Would come from template
        documents_count: 0, // Would be a subquery
        timeline: [], // Loaded separately
      }))

      setApplications(transformedApps)
      setStats(calculateStats(transformedApps))
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, calculateStats])

  const getApplication = useCallback(async (id: string): Promise<Application | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('form_submissions')
        .select(`
          id,
          user_id,
          template_id,
          status,
          submitted_at,
          updated_at,
          created_at,
          notes,
          data,
          form_templates (
            name,
            schema
          )
        `)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      if (!data) return null

      // Type the data explicitly
      type SingleSubmissionRow = {
        id: string
        user_id: string
        template_id: string
        status: string
        submitted_at: string | null
        updated_at: string
        created_at: string
        notes: string | null
        data: unknown
        form_templates: { name: string; schema: unknown } | null
      }

      const typedData = data as SingleSubmissionRow

      return {
        id: typedData.id,
        user_id: typedData.user_id,
        template_id: typedData.template_id,
        template_name: typedData.form_templates?.name || 'Unknown Form',
        status: (typedData.status as ApplicationStatus) || 'draft',
        submitted_at: typedData.submitted_at,
        last_updated: typedData.updated_at,
        created_at: typedData.created_at,
        notes: typedData.notes,
        deadline: null,
        case_number: null,
        agency_name: null,
        documents_count: 0,
        timeline: [],
      }
    } catch (err) {
      console.error('Error fetching application:', err)
      return null
    }
  }, [supabase])

  const updateStatus = useCallback(async (id: string, status: ApplicationStatus, note?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('form_submissions')
      .update({
        status,
        notes: note || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    await refreshApplications()
  }, [supabase, refreshApplications])

  const addNote = useCallback(async (id: string, note: string) => {
    const app = applications.find(a => a.id === id)
    const existingNotes = app?.notes || ''
    const timestamp = new Date().toLocaleString()
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}]\n${note}`
      : `[${timestamp}]\n${note}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('form_submissions')
      .update({
        notes: newNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    await refreshApplications()
  }, [supabase, applications, refreshApplications])

  const setDeadline = useCallback(async (id: string, deadline: Date) => {
    // Would update a deadline field - for now, add to notes
    await addNote(id, `Deadline set: ${deadline.toLocaleDateString()}`)
  }, [addNote])

  const setCaseNumber = useCallback(async (id: string, caseNumber: string) => {
    // Would update a case_number field - for now, add to notes
    await addNote(id, `Case number: ${caseNumber}`)
  }, [addNote])

  const deleteApplication = useCallback(async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('form_submissions')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    await refreshApplications()
  }, [supabase, refreshApplications])

  // Initial load
  useEffect(() => {
    refreshApplications()
  }, [refreshApplications])

  return {
    applications,
    stats,
    isLoading,
    error,
    refreshApplications,
    getApplication,
    updateStatus,
    addNote,
    setDeadline,
    setCaseNumber,
    deleteApplication,
  }
}
