'use client'

import { useMemo } from 'react'
import type { FormTemplateSchema } from '@/lib/form-schemas'
import { allTemplates, getTemplateById } from '@/lib/form-templates'

export interface FormTemplateWithMeta {
  id: string
  name: string
  description: string | null
  form_type: string
  schema: FormTemplateSchema
}

interface UseFormTemplatesReturn {
  templates: FormTemplateWithMeta[]
  loading: boolean
  error: string | null
}

/**
 * Resolve the discrete program form_type for a template.
 *
 * Canonical source is the TS module's `metadata.formType` (e.g. 'snap',
 * 'medicaid'), which aligns with CATEGORY_FORM_MAP in lib/category-form-map.ts
 * and the DB form_templates.form_type column. Falls back to the generic
 * `metadata.category`, then to 'general'.
 */
function resolveFormType(t: FormTemplateSchema): string {
  return t.metadata?.formType ?? t.metadata?.category ?? 'general'
}

/**
 * Hook for listing form templates.
 *
 * Forms-as-Code: templates are the TS modules in lib/form-templates/*.ts, not
 * DB rows. The DB form_templates table exists only for FK referential integrity
 * (form_submissions.template_id) and the applications-panel name join. Rendering
 * reads these modules directly, so this hook resolves synchronously from memory
 * (loading is always false, error always null).
 */
export function useFormTemplates(
  options: {
    category?: string
    activeOnly?: boolean
  } = {}
): UseFormTemplatesReturn {
  const { category } = options

  const templates = useMemo<FormTemplateWithMeta[]>(() => {
    return allTemplates
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? null,
        form_type: resolveFormType(t),
        schema: t,
      }))
      .filter((t) => (category ? t.form_type === category : true))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [category])

  return {
    templates,
    loading: false,
    error: null,
  }
}

/**
 * Hook for a single form template, resolved synchronously from the TS modules.
 */
export function useFormTemplate(id: string | null): {
  template: FormTemplateSchema | null
  loading: boolean
  error: string | null
} {
  const template = useMemo<FormTemplateSchema | null>(
    () => (id ? getTemplateById(id) ?? null : null),
    [id]
  )

  return {
    template,
    loading: false,
    error: null,
  }
}
