/**
 * Form Templates Index
 *
 * Export all form templates for easy access.
 */

export { snapApplicationTemplate } from './snap-application'
export { medicaidApplicationTemplate } from './medicaid-application'

import { snapApplicationTemplate } from './snap-application'
import { medicaidApplicationTemplate } from './medicaid-application'
import type { FormTemplateSchema } from '../form-schemas'

/**
 * All available form templates
 */
export const allTemplates: FormTemplateSchema[] = [
  snapApplicationTemplate,
  medicaidApplicationTemplate,
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): FormTemplateSchema | undefined {
  return allTemplates.find((t) => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): FormTemplateSchema[] {
  return allTemplates.filter((t) => t.metadata?.category === category)
}

/**
 * Get templates by agency
 */
export function getTemplatesByAgency(agency: string): FormTemplateSchema[] {
  return allTemplates.filter((t) => t.metadata?.agency === agency)
}
