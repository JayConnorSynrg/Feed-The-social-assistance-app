// apps/web/src/hooks/use-applications.ts
// Hook for managing benefit applications and their statuses

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Database } from '@feed/database'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

// Module-level singleton — same pattern as auth-provider.tsx.
// Prevents a new client reference on every render, which would
// invalidate all useCallback dep arrays and cause an infinite loop.
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

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

// Type for the list query result row (form_submissions + joined form_templates)
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

// Type for the single-record query result (includes data + schema)
type SingleSubmissionRow = FormSubmissionRow & {
  data: unknown
  form_templates: { name: string; schema: unknown } | null
}

export function useApplications(): UseApplicationsReturn {
  const { user, loading: authLoading } = useAuth()

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
    // Auth hasn't resolved yet or the user is logged out — clear loading and
    // bail. The useEffect below re-runs when user changes, so this will
    // automatically retry once auth resolves.
    if (authLoading || !user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()

      // Fetch applications with joined template name
      const { data: apps, error: fetchError } = await supabase
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
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError

      // Transform data
      const transformedApps: Application[] = ((apps || []) as unknown as FormSubmissionRow[]).map(app => ({
        id: app.id,
        user_id: app.user_id,
        template_id: app.template_id,
        template_name: app.form_templates?.name || 'Unknown Form',
        status: (app.status as ApplicationStatus) || 'draft',
        submitted_at: app.submitted_at,
        last_updated: app.updated_at,
        created_at: app.created_at,
        notes: app.notes,
        deadline: null,
        case_number: null,
        agency_name: null,
        documents_count: 0,
        timeline: [],
      }))

      setApplications(transformedApps)
      setStats(calculateStats(transformedApps))
    } catch (err) {
      setError(
        isQueryTimeout(err)
          ? new Error('Applications timed out. Please try again.')
          : err as Error
      )
    } finally {
      setIsLoading(false)
    }
  }, [user, authLoading, calculateStats])

  const getApplication = useCallback(async (id: string): Promise<Application | null> => {
    try {
      const { data, error: fetchError } = await getSupabase()
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

      const typedData = data as unknown as SingleSubmissionRow

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
  }, [])

  const updateStatus = useCallback(async (id: string, status: ApplicationStatus, note?: string) => {
    // Cast status to the DB enum type — ApplicationStatus is a superset of
    // submission_status (the DB enum). Values outside the DB enum will be
    // rejected at the DB level, not silently swallowed here.
    type DBStatus = Database['public']['Enums']['submission_status']
    const { error: updateError } = await getSupabase()
      .from('form_submissions')
      .update({
        status: status as DBStatus,
        ...(note !== undefined && { notes: note }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    await refreshApplications()
  }, [refreshApplications])

  const addNote = useCallback(async (id: string, note: string) => {
    const app = applications.find(a => a.id === id)
    const existingNotes = app?.notes || ''
    const timestamp = new Date().toLocaleString()
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}]\n${note}`
      : `[${timestamp}]\n${note}`

    const { error: updateError } = await getSupabase()
      .from('form_submissions')
      .update({
        notes: newNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) throw updateError

    await refreshApplications()
  }, [applications, refreshApplications])

  const setDeadline = useCallback(async (id: string, deadline: Date) => {
    // Would update a deadline field - for now, add to notes
    await addNote(id, `Deadline set: ${deadline.toLocaleDateString()}`)
  }, [addNote])

  const setCaseNumber = useCallback(async (id: string, caseNumber: string) => {
    // Would update a case_number field - for now, add to notes
    await addNote(id, `Case number: ${caseNumber}`)
  }, [addNote])

  const deleteApplication = useCallback(async (id: string) => {
    const { error: deleteError } = await getSupabase()
      .from('form_submissions')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    await refreshApplications()
  }, [refreshApplications])

  // Load applications once auth resolves, and re-run whenever the authenticated
  // user changes (e.g., sign-in, sign-out, account switch).
  // refreshApplications already guards on authLoading/user internally, so this
  // dependency array is the authoritative trigger for re-fetching.
  useEffect(() => {
    refreshApplications()
  }, [refreshApplications, user?.id, authLoading])

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
