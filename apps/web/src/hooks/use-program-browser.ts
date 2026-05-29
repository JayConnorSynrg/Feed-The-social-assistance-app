'use client'

import type React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Database } from '@feed/database'
import { CATEGORY_FORM_MAP } from '@/lib/category-form-map'
import { normalizeState } from '@/lib/us-states'
import { logger } from '@/lib/logger'

const FORM_CATEGORIES = Object.keys(CATEGORY_FORM_MAP) as Database['public']['Enums']['resource_category'][]

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

export type Resource = Database['public']['Tables']['resources']['Row']

export interface ProgramFilters {
  category: string | null
  search: string
  state: string | null
}

export interface CategoryCount {
  name: string
  count: number
}

export interface ProgramBrowserResult {
  programs: Resource[]
  categories: CategoryCount[]
  isLoading: boolean
  error: string | null
  filters: ProgramFilters
  setFilters: React.Dispatch<React.SetStateAction<ProgramFilters>>
  totalCount: number
}

export function useProgramBrowser(): ProgramBrowserResult {
  const { loading: authLoading, profile } = useAuth()

  const [programs, setPrograms] = useState<Resource[]>([])
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ProgramFilters>({ category: null, search: '', state: null })

  useEffect(() => {
    if (!authLoading && profile?.location_state) {
      setFilters((prev) => prev.state === null ? { ...prev, state: normalizeState(profile.location_state) } : prev)
    }
  }, [authLoading, profile?.location_state])

  const fetchPrograms = useCallback(async () => {
    if (authLoading) return

    if (!filters.state) {
      setPrograms([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const start = Date.now()

    try {
      const supabase = getSupabase()

      let query = supabase
        .from('resources')
        .select('*')
        .eq('status', 'approved')
        .eq('is_volunteer_resource', false)
        .eq('source', 'admin_added')
        .in('category', filters.category ? [filters.category as Database['public']['Enums']['resource_category']] : FORM_CATEGORIES)
        .eq('state', normalizeState(filters.state) ?? filters.state)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .limit(200)

      if (filters.search.trim()) {
        query = query.ilike('name', `%${filters.search.trim()}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const results = (data ?? []) as Resource[]
      setPrograms(results)

      logger.info('programs.fetched', {
        category: filters.category,
        search: filters.search,
        state: filters.state,
        resultCount: results.length,
        duration_ms: Date.now() - start,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load programs'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, filters])

  const fetchCategories = useCallback(async () => {
    if (authLoading) return

    if (!filters.state) {
      setCategories([])
      return
    }

    try {
      const supabase = getSupabase()

      const catQuery = supabase
        .from('resources')
        .select('category')
        .eq('status', 'approved')
        .eq('is_volunteer_resource', false)
        .eq('source', 'admin_added')
        .in('category', FORM_CATEGORIES)
        .eq('state', normalizeState(filters.state) ?? filters.state)

      const { data, error: fetchError } = await catQuery

      if (fetchError) throw fetchError

      const countMap: Record<string, number> = {}
      for (const row of data ?? []) {
        const cat = row.category as string
        countMap[cat] = (countMap[cat] ?? 0) + 1
      }

      const sorted = Object.entries(countMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      setCategories(sorted)
    } catch (err) {
      // Non-fatal — categories bar degrades gracefully, but surface the cause.
      logger.warn('programs.categories.error', {
        error_message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [authLoading, filters.state])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const totalCount = programs.length

  return {
    programs,
    categories,
    isLoading,
    error,
    filters,
    setFilters,
    totalCount,
  }
}
