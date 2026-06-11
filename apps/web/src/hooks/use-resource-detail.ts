'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useVault } from '@/contexts/vault-context'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

/**
 * Placeholder written into NOT NULL plaintext columns (title / file_name) once
 * the real value lives in the encrypted_* column. encrypted_* is the source of
 * truth; the plaintext placeholder satisfies the NOT NULL constraint without
 * leaking the user-authored value. notes is nullable so it is NULLed instead.
 */
const ENCRYPTED_PLACEHOLDER = '••••••'

type Decryptor = (ciphertext: string, iv: string) => Promise<string>

/**
 * Resolve the user-facing value for an encryptable field.
 * - prefer encrypted_* (decrypt) when present AND the vault is unlocked
 * - fall back to the plaintext column for un-migrated rows
 * - when encrypted data exists but the vault is locked, return null so the UI
 *   surfaces a locked state instead of garbage/placeholder text
 */
async function resolveField(
  encrypted: string | null | undefined,
  iv: string | null | undefined,
  plaintext: string | null | undefined,
  isUnlocked: boolean,
  decrypt: Decryptor,
): Promise<{ value: string; locked: boolean }> {
  if (encrypted && iv) {
    if (!isUnlocked) return { value: '', locked: true }
    try {
      return { value: await decrypt(encrypted, iv), locked: false }
    } catch {
      // Decryption failed (wrong key / corrupt) — treat as locked, never throw.
      return { value: '', locked: true }
    }
  }
  return { value: plaintext ?? '', locked: false }
}

export interface SavedResourceTask {
  id: string
  saved_resource_id: string
  title: string
  is_completed: boolean | null
  sort_order: number | null
  created_at: string | null
  encrypted_title?: string | null
  title_iv?: string | null
}

export interface SavedResourceEvent {
  id: string
  saved_resource_id: string
  title: string
  event_date: string
  event_time: string | null
  reminder: boolean | null
  created_at: string | null
  encrypted_title?: string | null
  title_iv?: string | null
}

export interface ResourceDocument {
  id: string
  saved_resource_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string | null
  encrypted_file_name?: string | null
  file_name_iv?: string | null
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
  encrypted_notes?: string | null
  notes_iv?: string | null
}

export function useResourceDetail(savedResourceId: string | null) {
  const supabase = createClient()
  const { user } = useAuth()
  const { isUnlocked, encrypt, decrypt } = useVault()

  const [resource, setResource] = useState<SavedResource | null>(null)
  const [tasks, setTasks] = useState<SavedResourceTask[]>([])
  const [events, setEvents] = useState<SavedResourceEvent[]>([])
  const [documents, setDocuments] = useState<ResourceDocument[]>([])
  const [notes, setNotes] = useState('')
  // True when at least one field holds ciphertext that cannot be decrypted
  // because the vault is locked. The consuming UI uses this to render a locked
  // state (unlock prompt) instead of empty/placeholder values.
  const [vaultLocked, setVaultLocked] = useState(false)
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

      let anyLocked = false

      // ── Notes (saved_resources) ──
      const r = resourceRes.data
      const notesResolved = await resolveField(r?.encrypted_notes, r?.notes_iv, r?.notes, isUnlocked, decrypt)
      anyLocked = anyLocked || notesResolved.locked
      setResource(r)
      setNotes(notesResolved.value)

      // ── Task titles ──
      const tasksDecrypted = await Promise.all((tasksRes.data ?? []).map(async (t) => {
        const resolved = await resolveField(t.encrypted_title, t.title_iv, t.title, isUnlocked, decrypt)
        anyLocked = anyLocked || resolved.locked
        return { ...t, title: resolved.value }
      }))
      setTasks(tasksDecrypted)

      // ── Event titles ──
      const eventsDecrypted = await Promise.all((eventsRes.data ?? []).map(async (e) => {
        const resolved = await resolveField(e.encrypted_title, e.title_iv, e.title, isUnlocked, decrypt)
        anyLocked = anyLocked || resolved.locked
        return { ...e, title: resolved.value }
      }))
      setEvents(eventsDecrypted)

      // ── Document file names ──
      const docsDecrypted = await Promise.all((docsRes.data ?? []).map(async (d) => {
        const resolved = await resolveField(d.encrypted_file_name, d.file_name_iv, d.file_name, isUnlocked, decrypt)
        anyLocked = anyLocked || resolved.locked
        return { ...d, file_name: resolved.value }
      }))
      setDocuments(docsDecrypted)

      setVaultLocked(anyLocked)
    } catch (err) {
      const msg = isQueryTimeout(err)
        ? 'Resource details timed out — please check your connection and retry.'
        : err instanceof Error ? err.message : 'Failed to load resource details'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, savedResourceId, user?.id, isUnlocked, decrypt])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Tasks ──
  const addTask = useCallback(async (title: string) => {
    if (!savedResourceId || !user?.id || !title.trim()) return
    const clean = title.trim()
    try {
      const { ciphertext, iv } = await encrypt(clean)
      const { data, error } = await supabase
        .from('saved_resource_tasks')
        .insert({
          saved_resource_id: savedResourceId,
          user_id: user.id,
          title: ENCRYPTED_PLACEHOLDER, // NOT NULL plaintext placeholder
          encrypted_title: ciphertext,
          title_iv: iv,
          sort_order: tasks.length,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      // Display the cleartext locally; the DB holds ciphertext + placeholder.
      setTasks(prev => [...prev, { ...data, title: clean }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task')
    }
  }, [supabase, savedResourceId, user?.id, tasks.length, encrypt])

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
    const clean = title.trim()
    try {
      const { ciphertext, iv } = await encrypt(clean)
      const { data, error } = await supabase
        .from('saved_resource_events')
        .insert({
          saved_resource_id: savedResourceId,
          user_id: user.id,
          title: ENCRYPTED_PLACEHOLDER, // NOT NULL plaintext placeholder
          encrypted_title: ciphertext,
          title_iv: iv,
          event_date: eventDate,
          event_time: eventTime || null,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      setEvents(prev => [...prev, { ...data, title: clean }].sort((a, b) => a.event_date.localeCompare(b.event_date)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event')
    }
  }, [supabase, savedResourceId, user?.id, encrypt])

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

      const { ciphertext, iv } = await encrypt(file.name)
      const { data, error: insertError } = await supabase
        .from('saved_resource_documents')
        .insert({
          saved_resource_id: savedResourceId,
          user_id: user.id,
          file_name: ENCRYPTED_PLACEHOLDER, // NOT NULL plaintext placeholder
          encrypted_file_name: ciphertext,
          file_name_iv: iv,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
        })
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)
      setDocuments(prev => [{ ...data, file_name: file.name }, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    }
  }, [supabase, savedResourceId, user?.id, encrypt])

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
      if (newNotes.trim() === '') {
        // Clearing notes — wipe both ciphertext and plaintext.
        const { error } = await supabase
          .from('saved_resources')
          .update({ notes: null, encrypted_notes: null, notes_iv: null })
          .eq('id', savedResourceId)
        if (error) throw new Error(error.message)
      } else {
        const { ciphertext, iv } = await encrypt(newNotes)
        const { error } = await supabase
          .from('saved_resources')
          .update({
            notes: null, // nullable plaintext NULLed — ciphertext is source of truth
            encrypted_notes: ciphertext,
            notes_iv: iv,
          })
          .eq('id', savedResourceId)
        if (error) throw new Error(error.message)
      }
      setNotes(newNotes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    }
  }, [supabase, savedResourceId, encrypt])

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
    isLoading, error, vaultLocked,
  }
}
