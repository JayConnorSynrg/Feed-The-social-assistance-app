'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

export interface SavedResourceTask {
  id: string
  saved_resource_id: string
  title: string
  is_completed: boolean | null
  sort_order: number | null
  created_at: string | null
}

export interface SavedResourceEvent {
  id: string
  saved_resource_id: string
  title: string
  event_date: string
  event_time: string | null
  reminder: boolean | null
  created_at: string | null
}

export interface ResourceDocument {
  id: string
  saved_resource_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string | null
}

interface SavedResource {
  id: string
  resource_id: string | null
  resource_name: string
  resource_category: string | null
  resource_address: string | null
  resource_phone: string | null
  resource_website: string | null
  notes: string | null
}

export function useResourceDetail(savedResourceId: string | null) {
  const supabase = createClient()
  const { user } = useAuth()

  const [resource, setResource] = useState<SavedResource | null>(null)
  const [tasks, setTasks] = useState<SavedResourceTask[]>([])
  const [events, setEvents] = useState<SavedResourceEvent[]>([])
  const [documents, setDocuments] = useState<ResourceDocument[]>([])
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all data for the resource
  const fetchAll = useCallback(async () => {
    if (!savedResourceId || !user?.id) return
    setIsLoading(true)
    setError(null)

    try {
      const [resourceRes, tasksRes, eventsRes, docsRes] = await Promise.all([
        supabase.from('saved_resources').select('*').eq('id', savedResourceId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)).retry(false).single(),
        supabase.from('saved_resource_tasks').select('*').eq('saved_resource_id', savedResourceId).order('sort_order').order('created_at')
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
        supabase.from('saved_resource_events').select('*').eq('saved_resource_id', savedResourceId).order('event_date').order('event_time')
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
        supabase.from('saved_resource_documents').select('*').eq('saved_resource_id', savedResourceId).order('created_at', { ascending: false })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
      ])

      if (resourceRes.error) throw new Error(isQueryTimeout(resourceRes.error)
        ? 'Resource details timed out — please check your connection and retry.'
        : resourceRes.error.message)
      setResource(resourceRes.data)
      setNotes(resourceRes.data?.notes || '')
      setTasks(tasksRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setDocuments(docsRes.data ?? [])
    } catch (err) {
      const msg = isQueryTimeout(err)
        ? 'Resource details timed out — please check your connection and retry.'
        : err instanceof Error ? err.message : 'Failed to load resource details'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, savedResourceId, user?.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Tasks ──
  const addTask = useCallback(async (title: string) => {
    if (!savedResourceId || !user?.id || !title.trim()) return
    try {
      const { data, error } = await supabase
        .from('saved_resource_tasks')
        .insert({ saved_resource_id: savedResourceId, user_id: user.id, title: title.trim(), sort_order: tasks.length })
        .select()
        .single()
      if (error) throw new Error(error.message)
      setTasks(prev => [...prev, data])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task')
    }
  }, [supabase, savedResourceId, user?.id, tasks.length])

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const toggled = !task.is_completed
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: toggled } : t))
    try {
      const { error } = await supabase
        .from('saved_resource_tasks')
        .update({ is_completed: toggled })
        .eq('id', taskId)
      if (error) throw new Error(error.message)
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: task.is_completed } : t))
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }, [supabase, tasks])

  const deleteTask = useCallback(async (taskId: string) => {
    const prev = tasks
    setTasks(p => p.filter(t => t.id !== taskId))
    try {
      const { error } = await supabase.from('saved_resource_tasks').delete().eq('id', taskId)
      if (error) throw new Error(error.message)
    } catch (err) {
      setTasks(prev)
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }, [supabase, tasks])

  // ── Events ──
  const addEvent = useCallback(async (title: string, eventDate: string, eventTime?: string) => {
    if (!savedResourceId || !user?.id || !title.trim() || !eventDate) return
    try {
      const { data, error } = await supabase
        .from('saved_resource_events')
        .insert({ saved_resource_id: savedResourceId, user_id: user.id, title: title.trim(), event_date: eventDate, event_time: eventTime || null })
        .select()
        .single()
      if (error) throw new Error(error.message)
      setEvents(prev => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event')
    }
  }, [supabase, savedResourceId, user?.id])

  const deleteEvent = useCallback(async (eventId: string) => {
    const prev = events
    setEvents(p => p.filter(e => e.id !== eventId))
    try {
      const { error } = await supabase.from('saved_resource_events').delete().eq('id', eventId)
      if (error) throw new Error(error.message)
    } catch (err) {
      setEvents(prev)
      setError(err instanceof Error ? err.message : 'Failed to delete event')
    }
  }, [supabase, events])

  // ── Documents ──
  const uploadDocument = useCallback(async (file: File) => {
    if (!savedResourceId || !user?.id) return
    const filePath = `resource-docs/${user.id}/${savedResourceId}/${crypto.randomUUID()}_${file.name}`
    try {
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
      if (uploadError) throw new Error(uploadError.message)

      const { data, error: insertError } = await supabase
        .from('saved_resource_documents')
        .insert({
          saved_resource_id: savedResourceId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
        })
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)
      setDocuments(prev => [data, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    }
  }, [supabase, savedResourceId, user?.id])

  const deleteDocument = useCallback(async (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    if (!doc) return
    const prev = documents
    setDocuments(p => p.filter(d => d.id !== docId))
    try {
      await supabase.storage.from('documents').remove([doc.file_path])
      const { error } = await supabase.from('saved_resource_documents').delete().eq('id', docId)
      if (error) throw new Error(error.message)
    } catch (err) {
      setDocuments(prev)
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }, [supabase, documents])

  const getDocumentUrl = useCallback(async (filePath: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600)
    return data?.signedUrl ?? null
  }, [supabase])

  // ── Notes ──
  const updateNotes = useCallback(async (newNotes: string) => {
    if (!savedResourceId) return
    try {
      const { error } = await supabase
        .from('saved_resources')
        .update({ notes: newNotes })
        .eq('id', savedResourceId)
      if (error) throw new Error(error.message)
      setNotes(newNotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    }
  }, [supabase, savedResourceId])

  const completedTasks = tasks.filter(t => t.is_completed === true).length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return {
    resource, tasks, events, documents, notes,
    addTask, toggleTask, deleteTask,
    addEvent, deleteEvent,
    uploadDocument, deleteDocument, getDocumentUrl,
    updateNotes,
    completedTasks, totalTasks, progress,
    isLoading, error,
  }
}
