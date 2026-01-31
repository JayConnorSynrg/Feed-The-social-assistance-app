/**
 * Form Field Mapper
 *
 * Maps data from secure profile to form fields for autofill.
 * Zero external dependencies.
 */

import type { FormFieldSchema, FormTemplateSchema } from './form-schemas'
import type { SecureProfileData } from './secure-profile'

// ============================================
// Mapping Configuration
// ============================================

/**
 * Maps autofillKey values to their corresponding secure profile fields
 */
const AUTOFILL_KEY_MAP: Record<string, keyof SecureProfileData | ((profile: SecureProfileData) => string | undefined)> = {
  // Personal identifiers
  ssn: 'ssn',
  date_of_birth: 'date_of_birth',
  drivers_license: 'drivers_license',
  passport_number: 'passport_number',

  // Financial
  income: 'income',
  bank_account: 'bank_account',
  bank_routing: 'bank_routing',
  employer_ein: 'employer_ein',

  // Immigration
  immigration_status: 'immigration_status',

  // Medical
  medical_conditions: 'medical_conditions',
  medications: 'medications',
}

/**
 * Common field name aliases that should map to profile data
 * Handles variations in how form templates name fields
 */
const FIELD_NAME_ALIASES: Record<string, string[]> = {
  ssn: ['ssn', 'social_security', 'social_security_number', 'ss_number'],
  date_of_birth: ['date_of_birth', 'dob', 'birthdate', 'birth_date'],
  income: ['income', 'annual_income', 'gross_income', 'yearly_income', 'monthly_income'],
  bank_account: ['bank_account', 'account_number', 'bank_account_number'],
  bank_routing: ['bank_routing', 'routing_number', 'routing'],
  drivers_license: ['drivers_license', 'license_number', 'dl_number'],
}

// ============================================
// Mapping Functions
// ============================================

/**
 * Get value from secure profile for a given autofill key
 */
export function getProfileValue(
  autofillKey: string,
  profile: SecureProfileData
): string | undefined {
  const mapper = AUTOFILL_KEY_MAP[autofillKey]

  if (!mapper) {
    return undefined
  }

  if (typeof mapper === 'function') {
    return mapper(profile)
  }

  return profile[mapper]
}

/**
 * Find the matching autofill key for a field name
 */
export function findAutofillKey(fieldName: string): string | undefined {
  // Check direct match first
  if (AUTOFILL_KEY_MAP[fieldName]) {
    return fieldName
  }

  // Check aliases
  const normalizedName = fieldName.toLowerCase().replace(/[-\s]/g, '_')
  for (const [key, aliases] of Object.entries(FIELD_NAME_ALIASES)) {
    if (aliases.includes(normalizedName)) {
      return key
    }
  }

  return undefined
}

/**
 * Map secure profile data to form field values
 */
export function mapProfileToFormValues(
  fields: FormFieldSchema[],
  profile: SecureProfileData
): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {}

  for (const field of fields) {
    // Use explicit autofillKey if provided
    if (field.autofillKey) {
      const value = getProfileValue(field.autofillKey, profile)
      if (value !== undefined) {
        values[field.name] = value
      }
      continue
    }

    // Try to find matching key by field name
    const autofillKey = findAutofillKey(field.name)
    if (autofillKey) {
      const value = getProfileValue(autofillKey, profile)
      if (value !== undefined) {
        values[field.name] = value
      }
    }
  }

  return values
}

/**
 * Get list of fields that can be autofilled from profile
 */
export function getAutofillableFields(
  fields: FormFieldSchema[],
  profile: SecureProfileData
): FormFieldSchema[] {
  return fields.filter((field) => {
    // Check explicit autofillKey
    if (field.autofillKey) {
      const value = getProfileValue(field.autofillKey, profile)
      return value !== undefined
    }

    // Check field name
    const autofillKey = findAutofillKey(field.name)
    if (autofillKey) {
      const value = getProfileValue(autofillKey, profile)
      return value !== undefined
    }

    return false
  })
}

/**
 * Check how many fields can be autofilled
 */
export function getAutofillStats(
  template: FormTemplateSchema,
  profile: SecureProfileData
): {
  totalFields: number
  autofillableFields: number
  sensitiveFields: number
  filledFromProfile: number
} {
  const autofillable = getAutofillableFields(template.fields, profile)
  const sensitiveFields = template.fields.filter((f) => f.sensitive)

  return {
    totalFields: template.fields.length,
    autofillableFields: autofillable.length,
    sensitiveFields: sensitiveFields.length,
    filledFromProfile: autofillable.length,
  }
}

// ============================================
// Address Mapping (Special Case)
// ============================================

export interface AddressValue {
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
}

/**
 * Parse address from profile (assumes JSON string or object)
 */
export function parseAddressFromProfile(profile: SecureProfileData): AddressValue | null {
  // Check if address is stored as a separate field
  const addressData = (profile as Record<string, unknown>)['address']

  if (!addressData) {
    return null
  }

  // If it's already an object
  if (typeof addressData === 'object') {
    return addressData as AddressValue
  }

  // If it's a JSON string
  if (typeof addressData === 'string') {
    try {
      return JSON.parse(addressData) as AddressValue
    } catch {
      return null
    }
  }

  return null
}

/**
 * Map address fields from profile
 */
export function mapAddressFields(
  fieldName: string,
  profile: SecureProfileData
): Record<string, string> | null {
  const address = parseAddressFromProfile(profile)

  if (!address) {
    return null
  }

  return {
    [`${fieldName}.line1`]: address.line1,
    [`${fieldName}.line2`]: address.line2 || '',
    [`${fieldName}.city`]: address.city,
    [`${fieldName}.state`]: address.state,
    [`${fieldName}.zip`]: address.zip,
  }
}

// ============================================
// Form Prefill Utility
// ============================================

/**
 * Create complete form values object from profile and defaults
 */
export function createFormPrefillData(
  template: FormTemplateSchema,
  profile: SecureProfileData | null,
  additionalDefaults?: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  // Apply field default values first
  for (const field of template.fields) {
    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue
    }
  }

  // Apply additional defaults
  if (additionalDefaults) {
    Object.assign(values, additionalDefaults)
  }

  // Apply profile data (overwrites defaults)
  if (profile) {
    const profileValues = mapProfileToFormValues(template.fields, profile)
    Object.assign(values, profileValues)

    // Handle address fields specially
    for (const field of template.fields) {
      if (field.type === 'address') {
        const addressValues = mapAddressFields(field.name, profile)
        if (addressValues) {
          Object.assign(values, addressValues)
        }
      }
    }
  }

  return values
}

// ============================================
// Reverse Mapping (Form to Profile)
// ============================================

/**
 * Extract sensitive fields from form data to update profile
 */
export function extractSensitiveFields(
  template: FormTemplateSchema,
  formData: Record<string, unknown>
): Partial<SecureProfileData> {
  const sensitiveData: Partial<SecureProfileData> = {}

  for (const field of template.fields) {
    // Only extract fields marked as sensitive
    if (!field.sensitive) {
      continue
    }

    const value = formData[field.name]
    if (value === undefined || value === null || value === '') {
      continue
    }

    // Determine the profile field to update
    const profileKey = field.autofillKey || findAutofillKey(field.name)
    if (profileKey && typeof value === 'string') {
      (sensitiveData as Record<string, string>)[profileKey] = value
    }
  }

  return sensitiveData
}

/**
 * Check if form data should update profile
 */
export function shouldUpdateProfile(
  currentProfile: SecureProfileData,
  newData: Partial<SecureProfileData>
): boolean {
  for (const [key, value] of Object.entries(newData)) {
    if (value !== undefined && currentProfile[key as keyof SecureProfileData] !== value) {
      return true
    }
  }
  return false
}

/**
 * Merge new sensitive data into existing profile
 */
export function mergeIntoProfile(
  currentProfile: SecureProfileData,
  newData: Partial<SecureProfileData>
): SecureProfileData {
  return {
    ...currentProfile,
    ...newData,
  }
}
