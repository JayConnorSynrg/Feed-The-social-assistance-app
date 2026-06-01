/**
 * Form Schema Definitions
 *
 * Dynamic form schemas using Zod for validation.
 * Zero external dependencies beyond Zod (already in use).
 *
 * These schemas define:
 * 1. Field types and validation rules
 * 2. Field metadata for rendering
 * 3. Conditional logic for dynamic forms
 */

import { z } from 'zod'

// ============================================
// Field Type Definitions
// ============================================

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'currency'
  | 'date'
  | 'ssn'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'address'
  | 'signature'
  | 'file'

export interface FieldOption {
  value: string
  label: string
  disabled?: boolean
}

export interface FieldCondition {
  field: string
  operator: 'equals' | 'notEquals' | 'contains' | 'notEmpty' | 'empty'
  value?: string | number | boolean
}

export interface FormFieldSchema {
  id: string
  name: string
  type: FieldType
  label: string
  placeholder?: string
  helpText?: string
  required?: boolean
  sensitive?: boolean // Should be encrypted
  autofillKey?: string // Key to map from secure profile
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    patternMessage?: string
  }
  options?: FieldOption[]
  conditions?: FieldCondition[] // Show only when conditions met
  defaultValue?: string | number | boolean
  section?: string
}

export interface FormSection {
  id: string
  title: string
  description?: string
  fields: string[] // Field IDs
}

export interface FormTemplateSchema {
  id: string
  name: string
  description?: string
  version: number
  sections: FormSection[]
  fields: FormFieldSchema[]
  metadata?: {
    category: string
    /**
     * Discrete program form type used for program→form matching
     * (aligns with CATEGORY_FORM_MAP in lib/category-form-map.ts and the
     * DB form_templates.form_type column). Falls back to `category` when absent.
     */
    formType?: string
    agency?: string
    estimatedTime?: number // minutes
    requiredDocuments?: string[]
  }
}

// ============================================
// Zod Schema Generators
// ============================================

/**
 * Generate a Zod schema from a field definition
 */
export function generateFieldSchema(field: FormFieldSchema): z.ZodTypeAny {
  let schema: z.ZodTypeAny

  switch (field.type) {
    case 'email':
      schema = z.string().email('Please enter a valid email address')
      break

    case 'phone':
      schema = z.string().regex(
        /^[\d\s\-().+]+$/,
        'Please enter a valid phone number'
      )
      break

    case 'ssn':
      schema = z.string().regex(
        /^\d{3}-?\d{2}-?\d{4}$/,
        'SSN must be in format XXX-XX-XXXX'
      )
      break

    case 'number':
    case 'currency':
      schema = z.coerce.number()
      if (field.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(field.validation.min)
      }
      if (field.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(field.validation.max)
      }
      break

    case 'date':
      schema = z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/,
        'Please enter a valid date'
      )
      break

    case 'checkbox':
      schema = z.boolean()
      break

    case 'select':
    case 'radio':
      if (field.options && field.options.length > 0) {
        const values = field.options.map((o) => o.value) as [string, ...string[]]
        schema = z.enum(values)
      } else {
        schema = z.string()
      }
      break

    case 'multiselect':
      schema = z.array(z.string())
      break

    case 'file':
      schema = z.any() // File handling is done separately
      break

    case 'signature':
      schema = z.string().min(1, 'Signature is required')
      break

    case 'address':
      schema = z.object({
        line1: z.string().min(1, 'Address is required'),
        line2: z.string().optional(),
        city: z.string().min(1, 'City is required'),
        state: z.string().length(2, 'Use 2-letter state code'),
        zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
      })
      break

    default:
      schema = z.string()
  }

  // Apply string validations
  if (field.type === 'text' || field.type === 'textarea') {
    if (field.validation?.minLength) {
      schema = (schema as z.ZodString).min(
        field.validation.minLength,
        `Must be at least ${field.validation.minLength} characters`
      )
    }
    if (field.validation?.maxLength) {
      schema = (schema as z.ZodString).max(
        field.validation.maxLength,
        `Must be at most ${field.validation.maxLength} characters`
      )
    }
    if (field.validation?.pattern) {
      schema = (schema as z.ZodString).regex(
        new RegExp(field.validation.pattern),
        field.validation.patternMessage || 'Invalid format'
      )
    }
  }

  // Make optional if not required
  if (!field.required) {
    schema = schema.optional()
  }

  return schema
}

/**
 * Generate a complete Zod schema from a form template
 */
export function generateFormSchema(
  template: FormTemplateSchema
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of template.fields) {
    shape[field.name] = generateFieldSchema(field)
  }

  return z.object(shape)
}

// ============================================
// Common Field Templates
// ============================================

export const commonFields = {
  firstName: {
    id: 'first_name',
    name: 'first_name',
    type: 'text' as FieldType,
    label: 'First Name',
    required: true,
    autofillKey: 'first_name',
  },
  lastName: {
    id: 'last_name',
    name: 'last_name',
    type: 'text' as FieldType,
    label: 'Last Name',
    required: true,
    autofillKey: 'last_name',
  },
  email: {
    id: 'email',
    name: 'email',
    type: 'email' as FieldType,
    label: 'Email Address',
    required: true,
    autofillKey: 'email',
  },
  phone: {
    id: 'phone',
    name: 'phone',
    type: 'phone' as FieldType,
    label: 'Phone Number',
    placeholder: '(555) 123-4567',
    autofillKey: 'phone',
  },
  dateOfBirth: {
    id: 'date_of_birth',
    name: 'date_of_birth',
    type: 'date' as FieldType,
    label: 'Date of Birth',
    required: true,
    sensitive: true,
    autofillKey: 'date_of_birth',
  },
  ssn: {
    id: 'ssn',
    name: 'ssn',
    type: 'ssn' as FieldType,
    label: 'Social Security Number',
    placeholder: 'XXX-XX-XXXX',
    required: true,
    sensitive: true,
    autofillKey: 'ssn',
  },
  address: {
    id: 'address',
    name: 'address',
    type: 'address' as FieldType,
    label: 'Home Address',
    required: true,
    autofillKey: 'address',
  },
  householdSize: {
    id: 'household_size',
    name: 'household_size',
    type: 'number' as FieldType,
    label: 'Number of People in Household',
    required: true,
    validation: { min: 1, max: 20 },
  },
  annualIncome: {
    id: 'annual_income',
    name: 'annual_income',
    type: 'currency' as FieldType,
    label: 'Annual Household Income',
    required: true,
    sensitive: true,
    autofillKey: 'income',
  },
  employmentStatus: {
    id: 'employment_status',
    name: 'employment_status',
    type: 'select' as FieldType,
    label: 'Employment Status',
    required: true,
    options: [
      { value: 'employed_full', label: 'Employed Full-Time' },
      { value: 'employed_part', label: 'Employed Part-Time' },
      { value: 'self_employed', label: 'Self-Employed' },
      { value: 'unemployed', label: 'Unemployed' },
      { value: 'retired', label: 'Retired' },
      { value: 'disabled', label: 'Unable to Work / Disabled' },
      { value: 'student', label: 'Student' },
    ],
  },
  citizenshipStatus: {
    id: 'citizenship_status',
    name: 'citizenship_status',
    type: 'select' as FieldType,
    label: 'Citizenship Status',
    required: true,
    options: [
      { value: 'us_citizen', label: 'U.S. Citizen' },
      { value: 'permanent_resident', label: 'Permanent Resident (Green Card)' },
      { value: 'refugee', label: 'Refugee / Asylee' },
      { value: 'visa_holder', label: 'Visa Holder' },
      { value: 'undocumented', label: 'Undocumented' },
      { value: 'other', label: 'Other' },
    ],
  },
  signature: {
    id: 'signature',
    name: 'signature',
    type: 'signature' as FieldType,
    label: 'Signature',
    required: true,
    helpText: 'By signing, you certify that the information provided is true and accurate.',
  },
  signatureDate: {
    id: 'signature_date',
    name: 'signature_date',
    type: 'date' as FieldType,
    label: 'Date',
    required: true,
  },
}

// ============================================
// Condition Evaluation
// ============================================

/**
 * Evaluate if a field should be shown based on conditions
 */
export function evaluateConditions(
  conditions: FieldCondition[] | undefined,
  formValues: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) {
    return true
  }

  return conditions.every((condition) => {
    const fieldValue = formValues[condition.field]

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value
      case 'notEquals':
        return fieldValue !== condition.value
      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string' &&
          fieldValue.includes(condition.value)
        )
      case 'notEmpty':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''
      case 'empty':
        return fieldValue === undefined || fieldValue === null || fieldValue === ''
      default:
        return true
    }
  })
}

/**
 * Filter fields based on current form values
 */
export function getVisibleFields(
  fields: FormFieldSchema[],
  formValues: Record<string, unknown>
): FormFieldSchema[] {
  return fields.filter((field) => evaluateConditions(field.conditions, formValues))
}
