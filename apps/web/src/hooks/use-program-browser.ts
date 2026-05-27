'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Database } from '@feed/database'
import { CATEGORY_FORM_MAP } from '@/lib/category-form-map'

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
  setFilters: (f: ProgramFilters) => void
  totalCount: number
}

export function useProgramBrowser(): ProgramBrowserResult {
  const { loading: authLoading } = useAuth()

  const [programs, setPrograms] = useState<Resource[]>([])
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ProgramFilters>({ category: null, search: '' })

  const fetchPrograms = useCallback(async () => {
    if (authLoading) return

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
        .in('category', filters.category ? [filters.category as Database['public']['Enums']['resource_category']] : FORM_CATEGORIES)
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

      console.log(JSON.stringify({
        action: 'programs_fetched',
        category: filters.category,
        search: filters.search,
        resultCount: results.length,
        durationMs: Date.now() - start,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load programs'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, filters])

  const fetchCategories = useCallback(async () => {
    if (authLoading) return

    try {
      const supabase = getSupabase()

      const { data, error: fetchError } = await supabase
        .from('resources')
        .select('category')
        .eq('status', 'approved')
        .eq('is_volunteer_resource', false)
        .in('category', FORM_CATEGORIES)

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
    } catch {
      // Non-fatal — categories bar degrades gracefully
    }
  }, [authLoading])

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
