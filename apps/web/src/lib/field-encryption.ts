/**
 * Field Encryption Service
 *
 * Wraps the vault's encrypt/decrypt with field-specific logic for:
 * - Structured objects (JSONB fields) - serializes to JSON, encrypts
 * - Simple string fields
 * - Array fields (TEXT[])
 *
 * Uses the vault DEK (Data Encryption Key) for all encryption/decryption.
 * Each field gets its own IV (Initialization Vector) - never reused.
 */

import { encryptField as vaultEncryptField, decryptField as vaultDecryptField } from '@/lib/vault'

// ============================================
// Type Definitions
// ============================================

export interface EncryptedFieldResult {
  ciphertext: string
  iv: string
}

export interface HouseholdMember {
  name: string
  relationship: string
  date_of_birth?: string
  ssn?: string
  income?: string
  is_dependent?: boolean
}

export interface EmployerInfo {
  employer_name?: string
  employer_ein?: string
  job_title?: string
  start_date?: string
  end_date?: string
  employment_type?: string
  wages?: string
  address?: string
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
  email?: string
  address?: string
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  zip_code: string
  country?: string
}

// Secure profile input/output types
export interface SecureProfileInput {
  household_members?: HouseholdMember[]
  employer_info?: EmployerInfo
  emergency_contact?: EmergencyContact
  mailing_address?: Address
  residential_address?: Address
  current_benefits?: string[]
}

export interface EncryptedSecureProfile {
  encrypted_household_members?: string
  household_members_iv?: string
  encrypted_employer_info?: string
  employer_info_iv?: string
  encrypted_emergency_contact?: string
  emergency_contact_iv?: string
  encrypted_mailing_address?: string
  mailing_address_iv?: string
  encrypted_residential_address?: string
  residential_address_iv?: string
  encrypted_current_benefits?: string
  current_benefits_iv?: string
}

// Form submission types
export interface EncryptedFormSubmission {
  encrypted_form_data: string
  form_data_iv: string
  encrypted_signature_data?: string
  signature_data_iv?: string
}

// ============================================
// Core Encryption Functions
// ============================================

/**
 * Encrypt a structured object (JSONB fields)
 * Serializes to JSON, then encrypts
 */
export async function encryptObject(data: object): Promise<EncryptedFieldResult> {
  const jsonString = JSON.stringify(data)
  return vaultEncryptField(jsonString)
}

/**
 * Decrypt a structured object
 * Decrypts, then parses JSON
 */
export async function decryptObject<T>(ciphertext: string, iv: string): Promise<T> {
  const jsonString = await vaultDecryptField(ciphertext, iv)
  return JSON.parse(jsonString) as T
}

/**
 * Encrypt a simple string field
 */
export async function encryptString(data: string): Promise<EncryptedFieldResult> {
  return vaultEncryptField(data)
}

/**
 * Decrypt a simple string field
 */
export async function decryptString(ciphertext: string, iv: string): Promise<string> {
  return vaultDecryptField(ciphertext, iv)
}

/**
 * Encrypt an array field (TEXT[])
 * Converts array to JSON, then encrypts
 */
export async function encryptArray(data: string[]): Promise<EncryptedFieldResult> {
  const jsonString = JSON.stringify(data)
  return vaultEncryptField(jsonString)
}

/**
 * Decrypt an array field
 * Decrypts, then parses JSON to array
 */
export async function decryptArray(ciphertext: string, iv: string): Promise<string[]> {
  const jsonString = await vaultDecryptField(ciphertext, iv)
  return JSON.parse(jsonString) as string[]
}

// ============================================
// Secure Profile Batch Operations
// ============================================

/**
 * Encrypt all fields in a secure profile
 * Returns encrypted fields ready for database storage
 */
export async function encryptSecureProfile(
  profile: SecureProfileInput
): Promise<EncryptedSecureProfile> {
  const result: EncryptedSecureProfile = {}

  // Encrypt household_members (array of objects)
  if (profile.household_members && profile.household_members.length > 0) {
    const encrypted = await encryptObject(profile.household_members)
    result.encrypted_household_members = encrypted.ciphertext
    result.household_members_iv = encrypted.iv
  }

  // Encrypt employer_info (single object)
  if (profile.employer_info) {
    const encrypted = await encryptObject(profile.employer_info)
    result.encrypted_employer_info = encrypted.ciphertext
    result.employer_info_iv = encrypted.iv
  }

  // Encrypt emergency_contact (single object)
  if (profile.emergency_contact) {
    const encrypted = await encryptObject(profile.emergency_contact)
    result.encrypted_emergency_contact = encrypted.ciphertext
    result.emergency_contact_iv = encrypted.iv
  }

  // Encrypt mailing_address (single object)
  if (profile.mailing_address) {
    const encrypted = await encryptObject(profile.mailing_address)
    result.encrypted_mailing_address = encrypted.ciphertext
    result.mailing_address_iv = encrypted.iv
  }

  // Encrypt residential_address (single object)
  if (profile.residential_address) {
    const encrypted = await encryptObject(profile.residential_address)
    result.encrypted_residential_address = encrypted.ciphertext
    result.residential_address_iv = encrypted.iv
  }

  // Encrypt current_benefits (array of strings)
  if (profile.current_benefits && profile.current_benefits.length > 0) {
    const encrypted = await encryptArray(profile.current_benefits)
    result.encrypted_current_benefits = encrypted.ciphertext
    result.current_benefits_iv = encrypted.iv
  }

  return result
}

/**
 * Decrypt all fields in a secure profile
 * Returns decrypted profile data
 */
export async function decryptSecureProfile(
  encrypted: EncryptedSecureProfile
): Promise<SecureProfileInput> {
  const result: SecureProfileInput = {}

  // Decrypt household_members
  if (encrypted.encrypted_household_members && encrypted.household_members_iv) {
    result.household_members = await decryptObject<HouseholdMember[]>(
      encrypted.encrypted_household_members,
      encrypted.household_members_iv
    )
  }

  // Decrypt employer_info
  if (encrypted.encrypted_employer_info && encrypted.employer_info_iv) {
    result.employer_info = await decryptObject<EmployerInfo>(
      encrypted.encrypted_employer_info,
      encrypted.employer_info_iv
    )
  }

  // Decrypt emergency_contact
  if (encrypted.encrypted_emergency_contact && encrypted.emergency_contact_iv) {
    result.emergency_contact = await decryptObject<EmergencyContact>(
      encrypted.encrypted_emergency_contact,
      encrypted.emergency_contact_iv
    )
  }

  // Decrypt mailing_address
  if (encrypted.encrypted_mailing_address && encrypted.mailing_address_iv) {
    result.mailing_address = await decryptObject<Address>(
      encrypted.encrypted_mailing_address,
      encrypted.mailing_address_iv
    )
  }

  // Decrypt residential_address
  if (encrypted.encrypted_residential_address && encrypted.residential_address_iv) {
    result.residential_address = await decryptObject<Address>(
      encrypted.encrypted_residential_address,
      encrypted.residential_address_iv
    )
  }

  // Decrypt current_benefits
  if (encrypted.encrypted_current_benefits && encrypted.current_benefits_iv) {
    result.current_benefits = await decryptArray(
      encrypted.encrypted_current_benefits,
      encrypted.current_benefits_iv
    )
  }

  return result
}

// ============================================
// Form Submission Batch Operations
// ============================================

/**
 * Encrypt form submission data
 * Encrypts both form_data and signature_data (if provided)
 */
export async function encryptFormSubmission(
  formData: Record<string, unknown>,
  signatureData?: string
): Promise<EncryptedFormSubmission> {
  // Encrypt form data (always required)
  const encryptedFormData = await encryptObject(formData)

  const result: EncryptedFormSubmission = {
    encrypted_form_data: encryptedFormData.ciphertext,
    form_data_iv: encryptedFormData.iv,
  }

  // Encrypt signature data (optional)
  if (signatureData) {
    const encryptedSignature = await encryptString(signatureData)
    result.encrypted_signature_data = encryptedSignature.ciphertext
    result.signature_data_iv = encryptedSignature.iv
  }

  return result
}

/**
 * Decrypt form submission data
 * Decrypts both form_data and signature_data (if present)
 */
export async function decryptFormSubmission(
  encrypted: EncryptedFormSubmission
): Promise<{ formData: Record<string, unknown>; signatureData?: string }> {
  // Decrypt form data (always present)
  const formData = await decryptObject<Record<string, unknown>>(
    encrypted.encrypted_form_data,
    encrypted.form_data_iv
  )

  const result: { formData: Record<string, unknown>; signatureData?: string } = { formData }

  // Decrypt signature data (optional)
  if (encrypted.encrypted_signature_data && encrypted.signature_data_iv) {
    result.signatureData = await decryptString(
      encrypted.encrypted_signature_data,
      encrypted.signature_data_iv
    )
  }

  return result
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if encrypted data exists for a field
 */
export function hasEncryptedData(ciphertext?: string | null, iv?: string | null): boolean {
  return !!(ciphertext && iv)
}

/**
 * Validate that encrypted field has both ciphertext and IV
 * Throws error if only one is present (data integrity issue)
 */
export function validateEncryptedField(
  ciphertext?: string | null,
  iv?: string | null,
  fieldName?: string
): void {
  const hasCiphertext = !!ciphertext
  const hasIv = !!iv

  if (hasCiphertext !== hasIv) {
    throw new Error(
      `Data integrity error${fieldName ? ` for ${fieldName}` : ''}: ` +
        'Encrypted field must have both ciphertext and IV, or neither'
    )
  }
}

/**
 * Batch validate all encrypted fields in a secure profile
 */
export function validateEncryptedSecureProfile(encrypted: EncryptedSecureProfile): void {
  validateEncryptedField(
    encrypted.encrypted_household_members,
    encrypted.household_members_iv,
    'household_members'
  )
  validateEncryptedField(
    encrypted.encrypted_employer_info,
    encrypted.employer_info_iv,
    'employer_info'
  )
  validateEncryptedField(
    encrypted.encrypted_emergency_contact,
    encrypted.emergency_contact_iv,
    'emergency_contact'
  )
  validateEncryptedField(
    encrypted.encrypted_mailing_address,
    encrypted.mailing_address_iv,
    'mailing_address'
  )
  validateEncryptedField(
    encrypted.encrypted_residential_address,
    encrypted.residential_address_iv,
    'residential_address'
  )
  validateEncryptedField(
    encrypted.encrypted_current_benefits,
    encrypted.current_benefits_iv,
    'current_benefits'
  )
}

/**
 * Batch validate all encrypted fields in a form submission
 */
export function validateEncryptedFormSubmission(encrypted: EncryptedFormSubmission): void {
  validateEncryptedField(encrypted.encrypted_form_data, encrypted.form_data_iv, 'form_data')
  validateEncryptedField(
    encrypted.encrypted_signature_data,
    encrypted.signature_data_iv,
    'signature_data'
  )
}
