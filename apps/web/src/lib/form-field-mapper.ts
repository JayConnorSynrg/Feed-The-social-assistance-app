/**
 * Form Field Autofill Mapper
 *
 * Pure function — no React imports, no Supabase imports.
 * Maps vault secure profile + public profile row + auth email
 * into the flat RHF field values used by the form wizard.
 *
 * SECURITY NOTE: ssn, date_of_birth, and annual_income are intentionally
 * NOT autofilled. The only candidate source for those fields is
 * household_members[0], which is a heuristic that risks autofilling the
 * wrong person's sensitive data. The user must enter those manually.
 */

import type { SecureProfileInput, Address } from '@/lib/field-encryption'

// ============================================
// Input types — plain objects, no framework deps
// ============================================

/**
 * Subset of the profiles DB Row that the mapper needs.
 * Kept narrow so callers don't need to import the full DB type here.
 */
export interface PublicProfileForAutofill {
  full_name?: string | null
  phone?: string | null
  location_city?: string | null
  location_state?: string | null
  zip_code?: string | null
}

export interface MapProfileToAutofillArgs {
  /** Decrypted vault secure profile (from useVaultSecureProfile) */
  vaultProfile: SecureProfileInput | null
  /** Public profiles row (from useAuth / AuthProvider) */
  publicProfile: PublicProfileForAutofill | null
  /** Auth user email (from supabase User.email) */
  email: string | null | undefined
}

// ============================================
// Address sub-type for the wizard (address.zip, not zip_code)
// ============================================

export interface WizardAddress {
  line1: string
  line2?: string
  city: string
  state: string
  /** Wizard uses `zip` — remapped from vault's `zip_code` */
  zip: string
}

// ============================================
// Output type
// ============================================

/**
 * Partial map of RHF field names → autofill values.
 * Only fields that could be resolved are included (no undefined keys).
 */
export type AutofillValues = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  address?: WizardAddress
  // ssn, date_of_birth, annual_income are deliberately excluded — see module JSDoc
}

// ============================================
// Pure mapper
// ============================================

/**
 * Map profile sources to wizard autofill values.
 *
 * Mapping rules:
 * - first_name  ← publicProfile.full_name split on first space (part 0)
 * - last_name   ← publicProfile.full_name remainder after first space
 * - email       ← auth user email
 * - phone       ← publicProfile.phone
 * - address     ← vaultProfile.residential_address, with zip_code remapped to zip
 *
 * Fields NOT autofilled (security): ssn, date_of_birth, annual_income
 */
export function mapProfileToAutofill(args: MapProfileToAutofillArgs): AutofillValues {
  const { vaultProfile, publicProfile, email } = args
  const result: AutofillValues = {}

  // --- first_name / last_name from public profile full_name ---
  const fullName = publicProfile?.full_name?.trim() ?? ''
  if (fullName) {
    const spaceIdx = fullName.indexOf(' ')
    if (spaceIdx === -1) {
      // Single token — treat entire name as first name
      result.first_name = fullName
    } else {
      result.first_name = fullName.slice(0, spaceIdx)
      result.last_name = fullName.slice(spaceIdx + 1).trim() || undefined
    }
    // Discard last_name if it ended up as empty string
    if (result.last_name === '') {
      delete result.last_name
    }
  }

  // --- email from auth user ---
  if (email) {
    result.email = email
  }

  // --- phone from public profile ---
  const phone = publicProfile?.phone?.trim() ?? ''
  if (phone) {
    result.phone = phone
  }

  // --- address from vault residential_address ---
  // CRITICAL: remap zip_code → zip (wizard registers address.zip)
  const residentialAddress: Address | undefined = vaultProfile?.residential_address
  if (residentialAddress) {
    const wizardAddress: WizardAddress = {
      line1: residentialAddress.line1,
      city: residentialAddress.city,
      state: residentialAddress.state,
      zip: residentialAddress.zip_code, // remap here
    }
    if (residentialAddress.line2) {
      wizardAddress.line2 = residentialAddress.line2
    }
    result.address = wizardAddress
  }

  return result
}
