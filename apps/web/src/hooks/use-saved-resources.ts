'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getSupabase()
}

export interface SavedResourceDocument {
  id: string
  saved_resource_id: string
  user_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  encrypted: boolean
  created_at: string
}

export interface SavedResource {
  id: string
  user_id: string
  resource_id: string | null
  resource_name: string
  resource_category: string | null
  resource_address: string | null
  resource_phone: string | null
  resource_website: string | null
  notes: string | null
  created_at: string
  documents?: SavedResourceDocument[]
}

export interface SaveResourceInput {
  resource_id?: string | null
  resource_name: string
  resource_category?: string | null
  resource_address?: string | null
  resource_phone?: string | null
  resource_website?: string | null
  notes?: string | null
}

export interface UseSavedResourcesReturn {
  savedResources: SavedResource[]
  isLoading: boolean
  error: string | null
  saveResource: (input: SaveResourceInput) => Promise<boolean>
  removeResource: (id: string) => Promise<boolean>
  isResourceSaved: (resourceId: string) => boolean
  isResourceSavedByName: (name: string) => boolean
  refreshResources: () => Promise<void>
}

export function useSavedResources(): UseSavedResourcesReturn {
  const { user, loading: authLoading } = useAuth()
  const [savedResources, setSavedResources] = useState<SavedResource[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await db()
        .from('saved_resources')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) {
        throw fetchError
      }

      setSavedResources((data ?? []) as SavedResource[])
    } catch (err: unknown) {
      const message = isQueryTimeout(err)
        ? 'Saved resources timed out. Please try again.'
        : err instanceof Error ? err.message : 'Failed to load saved resources'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading || !user) return
    fetchResources()
  }, [authLoading, user, fetchResources])

  const saveResource = useCallback(
    async (input: SaveResourceInput): Promise<boolean> => {
      if (!user) {
        setError('Must be authenticated to save resources')
        return false
      }

      setError(null)

      try {
        const { data, error: insertError } = await db()
          .from('saved_resources')
          .insert({
            user_id: user.id,
            resource_id: input.resource_id ?? null,
            resource_name: input.resource_name,
            resource_category: input.resource_category ?? null,
            resource_address: input.resource_address ?? null,
            resource_phone: input.resource_phone ?? null,
            resource_website: input.resource_website ?? null,
            notes: input.notes ?? null,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setSavedResources((prev) => [data as SavedResource, ...prev])
        return true
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save resource'
        setError(message)
        return false
      }
    },
    [user]
  )

  const removeResource = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) {
        setError('Must be authenticated to remove resources')
        return false
      }

      setError(null)

      try {
        const { error: deleteError } = await db()
          .from('saved_resources')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)

        if (deleteError) {
          throw deleteError
        }

        setSavedResources((prev) => prev.filter((r) => r.id !== id))
        return true
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove resource'
        setError(message)
        return false
      }
    },
    [user]
  )

  const isResourceSaved = useCallback(
    (resourceId: string): boolean => {
      return savedResources.some((r) => r.resource_id === resourceId)
    },
    [savedResources]
  )

  const isResourceSavedByName = useCallback(
    (name: string): boolean => {
      return savedResources.some(
        (r) => r.resource_name.toLowerCase() === name.toLowerCase()
      )
    },
    [savedResources]
  )

  const refreshResources = useCallback(async (): Promise<void> => {
    await fetchResources()
  }, [fetchResources])

  return {
    savedResources,
    isLoading,
    error,
    saveResource,
    removeResource,
    isResourceSaved,
    isResourceSavedByName,
    refreshResources,
  }
}
