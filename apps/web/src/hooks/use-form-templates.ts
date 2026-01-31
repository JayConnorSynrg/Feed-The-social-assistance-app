'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FormTemplateSchema } from '@/lib/form-schemas'

interface FormTemplateRow {
  id: string
  name: string
  description: string | null
  version: number
  schema: FormTemplateSchema
  is_active: boolean
  category: string | null
  agency: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

interface UseFormTemplatesState {
  templates: FormTemplateSchema[]
  loading: boolean
  error: string | null
}

interface UseFormTemplatesReturn extends UseFormTemplatesState {
  getTemplate: (id: string) => Promise<FormTemplateSchema | null>
  createTemplate: (template: FormTemplateSchema) => Promise<string | null>
  updateTemplate: (id: string, template: Partial<FormTemplateSchema>) => Promise<boolean>
  deleteTemplate: (id: string) => Promise<boolean>
  duplicateTemplate: (id: string, newName: string) => Promise<string | null>
  refresh: () => Promise<void>
}

/**
 * Hook for managing form templates
 * Provides CRUD operations for form template schemas
 */
export function useFormTemplates(
  options: {
    category?: string
    activeOnly?: boolean
  } = {}
): UseFormTemplatesReturn {
  const { category, activeOnly = true } = options

  const [state, setState] = useState<UseFormTemplatesState>({
    templates: [],
    loading: true,
    error: null,
  })

  const supabase = createClient()

  /**
   * Fetch all templates
   */
  const fetchTemplates = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('form_templates')
        .select('*')
        .order('name', { ascending: true })

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (error) throw error

      const templates = ((data || []) as FormTemplateRow[]).map((row) => row.schema)

      setState({
        templates,
        loading: false,
        error: null,
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      }))
    }
  }, [supabase, category, activeOnly])

  // Initial fetch
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  /**
   * Get a single template by ID
   */
  const getTemplate = useCallback(
    async (id: string): Promise<FormTemplateSchema | null> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('form_templates')
          .select('schema')
          .eq('id', id)
          .single()

        if (error) throw error

        return (data as { schema: FormTemplateSchema })?.schema || null
      } catch (error) {
        console.error('Failed to get template:', error)
        return null
      }
    },
    [supabase]
  )

  /**
   * Create a new template
   * Returns the created template ID
   */
  const createTemplate = useCallback(
    async (template: FormTemplateSchema): Promise<string | null> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const row = {
          id: template.id,
          name: template.name,
          description: template.description || null,
          version: template.version,
          schema: template,
          is_active: true,
          category: template.metadata?.category || null,
          agency: template.metadata?.agency || null,
          created_by: user?.id || null,
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('form_templates').insert(row)

        if (error) throw error

        // Refresh templates list
        await fetchTemplates()

        return template.id
      } catch (error) {
        console.error('Failed to create template:', error)
        return null
      }
    },
    [supabase, fetchTemplates]
  )

  /**
   * Update an existing template
   */
  const updateTemplate = useCallback(
    async (id: string, updates: Partial<FormTemplateSchema>): Promise<boolean> => {
      try {
        // Get current template
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: current, error: fetchError } = await (supabase as any)
          .from('form_templates')
          .select('schema, version')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError

        const currentSchema = (current as FormTemplateRow).schema
        const newVersion = (current as FormTemplateRow).version + 1

        // Merge updates into schema
        const updatedSchema: FormTemplateSchema = {
          ...currentSchema,
          ...updates,
          version: newVersion,
        }

        const row = {
          name: updatedSchema.name,
          description: updatedSchema.description || null,
          version: newVersion,
          schema: updatedSchema,
          category: updatedSchema.metadata?.category || null,
          agency: updatedSchema.metadata?.agency || null,
          updated_at: new Date().toISOString(),
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('form_templates')
          .update(row)
          .eq('id', id)

        if (error) throw error

        // Refresh templates list
        await fetchTemplates()

        return true
      } catch (error) {
        console.error('Failed to update template:', error)
        return false
      }
    },
    [supabase, fetchTemplates]
  )

  /**
   * Soft delete a template (mark as inactive)
   */
  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('form_templates')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id)

        if (error) throw error

        // Refresh templates list
        await fetchTemplates()

        return true
      } catch (error) {
        console.error('Failed to delete template:', error)
        return false
      }
    },
    [supabase, fetchTemplates]
  )

  /**
   * Duplicate a template with a new name
   */
  const duplicateTemplate = useCallback(
    async (id: string, newName: string): Promise<string | null> => {
      try {
        const original = await getTemplate(id)
        if (!original) {
          throw new Error('Template not found')
        }

        const newId = `${original.id}-copy-${Date.now()}`
        const duplicated: FormTemplateSchema = {
          ...original,
          id: newId,
          name: newName,
          version: 1,
        }

        return await createTemplate(duplicated)
      } catch (error) {
        console.error('Failed to duplicate template:', error)
        return null
      }
    },
    [getTemplate, createTemplate]
  )

  return {
    ...state,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    refresh: fetchTemplates,
  }
}

/**
 * Hook for a single form template
 */
export function useFormTemplate(id: string | null): {
  template: FormTemplateSchema | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
} {
  const [template, setTemplate] = useState<FormTemplateSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchTemplate = useCallback(async () => {
    if (!id) {
      setTemplate(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('form_templates')
        .select('schema')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      setTemplate((data as { schema: FormTemplateSchema })?.schema || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch template')
      setTemplate(null)
    } finally {
      setLoading(false)
    }
  }, [supabase, id])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  return {
    template,
    loading,
    error,
    refresh: fetchTemplate,
  }
}
