/**
 * Data Migration Utility
 *
 * Helps existing users migrate their plaintext data to encrypted columns.
 * This runs automatically when a user unlocks their vault for the first time
 * after the encryption migration.
 *
 * Migration strategy:
 * 1. Check if user has plaintext data but no encrypted data (encryption_migrated = false)
 * 2. Read plaintext fields from database
 * 3. Encrypt each field with user's DEK
 * 4. Write to encrypted columns
 * 5. Set encryption_migrated = true
 * 6. (Later: admin can drop old plaintext columns after all users migrate)
 */

import { createClient } from '@/lib/supabase/client'
import {
  encryptSecureProfile,
  encryptFormSubmission,
  type SecureProfileInput,
  type EncryptedSecureProfile,
  type EncryptedFormSubmission,
} from '@/lib/field-encryption'

// ============================================
// Type Definitions
// ============================================

export interface MigrationResult {
  success: boolean
  migratedFields: string[]
  errors: string[]
  timestamp: string
}

export interface SecureProfileMigrationResult extends MigrationResult {
  profileId: string
}

export interface FormSubmissionMigrationResult extends MigrationResult {
  submissionId: string
}

export interface BatchMigrationResult {
  totalProfiles: number
  migratedProfiles: number
  totalSubmissions: number
  migratedSubmissions: number
  errors: string[]
  startTime: string
  endTime: string
}

// ============================================
// User Secure Profile Migration
// ============================================

/**
 * Migrate a single user's secure profile from plaintext to encrypted
 * Called automatically when user unlocks vault for first time after migration
 */
export async function migrateUserSecureProfile(
  userId: string
): Promise<SecureProfileMigrationResult> {
  const supabase = createClient()
  const result: SecureProfileMigrationResult = {
    success: false,
    profileId: userId,
    migratedFields: [],
    errors: [],
    timestamp: new Date().toISOString(),
  }

  try {
    // 1. Fetch current profile data
    const { data: profile, error: fetchError } = await supabase
      .from('user_secure_profiles')
      .select(
        `
        id,
        encryption_migrated,
        household_members,
        employer_info,
        emergency_contact,
        mailing_address,
        residential_address,
        current_benefits
      `
      )
      .eq('id', userId)
      .single()

    if (fetchError) {
      result.errors.push(`Failed to fetch profile: ${fetchError.message}`)
      return result
    }

    if (!profile) {
      result.errors.push('Profile not found')
      return result
    }

    // 2. Check if already migrated
    if (profile.encryption_migrated) {
      result.success = true
      result.migratedFields.push('Already migrated')
      return result
    }

    // 3. Prepare plaintext data for encryption
    const plaintextData: SecureProfileInput = {}

    if (profile.household_members) {
      plaintextData.household_members = profile.household_members as any
      result.migratedFields.push('household_members')
    }

    if (profile.employer_info) {
      plaintextData.employer_info = profile.employer_info as any
      result.migratedFields.push('employer_info')
    }

    if (profile.emergency_contact) {
      plaintextData.emergency_contact = profile.emergency_contact as any
      result.migratedFields.push('emergency_contact')
    }

    if (profile.mailing_address) {
      plaintextData.mailing_address = profile.mailing_address as any
      result.migratedFields.push('mailing_address')
    }

    if (profile.residential_address) {
      plaintextData.residential_address = profile.residential_address as any
      result.migratedFields.push('residential_address')
    }

    if (profile.current_benefits && Array.isArray(profile.current_benefits)) {
      plaintextData.current_benefits = profile.current_benefits as string[]
      result.migratedFields.push('current_benefits')
    }

    // 4. If no data to migrate, mark as migrated and return
    if (result.migratedFields.length === 0) {
      const { error: updateError } = await supabase
        .from('user_secure_profiles')
        .update({
          encryption_migrated: true,
          encryption_migrated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateError) {
        result.errors.push(`Failed to mark as migrated: ${updateError.message}`)
        return result
      }

      result.success = true
      result.migratedFields = ['No data to migrate']
      return result
    }

    // 5. Encrypt the data
    let encryptedData: EncryptedSecureProfile
    try {
      encryptedData = await encryptSecureProfile(plaintextData)
    } catch (encryptError) {
      result.errors.push(
        `Encryption failed: ${encryptError instanceof Error ? encryptError.message : 'Unknown error'}`
      )
      return result
    }

    // 6. Update database with encrypted data
    const { error: updateError } = await supabase
      .from('user_secure_profiles')
      .update({
        ...encryptedData,
        encryption_migrated: true,
        encryption_migrated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      result.errors.push(`Failed to save encrypted data: ${updateError.message}`)
      return result
    }

    // 7. Success!
    result.success = true
    return result
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return result
  }
}

// ============================================
// Form Submissions Migration
// ============================================

/**
 * Migrate a single form submission from plaintext to encrypted
 */
export async function migrateFormSubmission(
  submissionId: string
): Promise<FormSubmissionMigrationResult> {
  const supabase = createClient()
  const result: FormSubmissionMigrationResult = {
    success: false,
    submissionId,
    migratedFields: [],
    errors: [],
    timestamp: new Date().toISOString(),
  }

  try {
    // 1. Fetch submission data
    const { data: submission, error: fetchError } = await supabase
      .from('form_submissions')
      .select(
        `
        id,
        encryption_migrated,
        form_data,
        signature_data
      `
      )
      .eq('id', submissionId)
      .single()

    if (fetchError) {
      result.errors.push(`Failed to fetch submission: ${fetchError.message}`)
      return result
    }

    if (!submission) {
      result.errors.push('Submission not found')
      return result
    }

    // 2. Check if already migrated
    if (submission.encryption_migrated) {
      result.success = true
      result.migratedFields.push('Already migrated')
      return result
    }

    // 3. Check if there's data to migrate
    if (!submission.form_data) {
      result.errors.push('No form data to migrate')
      return result
    }

    result.migratedFields.push('form_data')
    if (submission.signature_data) {
      result.migratedFields.push('signature_data')
    }

    // 4. Encrypt the data
    let encryptedData: EncryptedFormSubmission
    try {
      encryptedData = await encryptFormSubmission(
        submission.form_data,
        submission.signature_data || undefined
      )
    } catch (encryptError) {
      result.errors.push(
        `Encryption failed: ${encryptError instanceof Error ? encryptError.message : 'Unknown error'}`
      )
      return result
    }

    // 5. Update database with encrypted data
    const { error: updateError } = await supabase
      .from('form_submissions')
      .update({
        ...encryptedData,
        encryption_migrated: true,
        encryption_migrated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)

    if (updateError) {
      result.errors.push(`Failed to save encrypted data: ${updateError.message}`)
      return result
    }

    // 6. Success!
    result.success = true
    return result
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return result
  }
}

/**
 * Migrate all form submissions for a user
 */
export async function migrateAllUserSubmissions(userId: string): Promise<BatchMigrationResult> {
  const supabase = createClient()
  const result: BatchMigrationResult = {
    totalProfiles: 0,
    migratedProfiles: 0,
    totalSubmissions: 0,
    migratedSubmissions: 0,
    errors: [],
    startTime: new Date().toISOString(),
    endTime: '',
  }

  try {
    // Fetch all unmigrated submissions for user
    const { data: submissions, error: fetchError } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('encryption_migrated', false)

    if (fetchError) {
      result.errors.push(`Failed to fetch submissions: ${fetchError.message}`)
      result.endTime = new Date().toISOString()
      return result
    }

    result.totalSubmissions = submissions?.length || 0

    if (submissions && submissions.length > 0) {
      // Migrate each submission
      for (const submission of submissions) {
        const migrationResult = await migrateFormSubmission(submission.id)
        if (migrationResult.success) {
          result.migratedSubmissions++
        } else {
          result.errors.push(`Submission ${submission.id}: ${migrationResult.errors.join(', ')}`)
        }
      }
    }

    result.endTime = new Date().toISOString()
    return result
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    result.endTime = new Date().toISOString()
    return result
  }
}

// ============================================
// Complete User Migration (Profile + Submissions)
// ============================================

/**
 * Migrate all data for a user (profile + all submissions)
 * This should be called when user unlocks their vault for the first time
 * after the encryption migration
 */
export async function migrateUserDataToEncrypted(userId: string): Promise<BatchMigrationResult> {
  const result: BatchMigrationResult = {
    totalProfiles: 1,
    migratedProfiles: 0,
    totalSubmissions: 0,
    migratedSubmissions: 0,
    errors: [],
    startTime: new Date().toISOString(),
    endTime: '',
  }

  try {
    // 1. Migrate user secure profile
    const profileResult = await migrateUserSecureProfile(userId)
    if (profileResult.success) {
      result.migratedProfiles = 1
    } else {
      result.errors.push(`Profile migration failed: ${profileResult.errors.join(', ')}`)
    }

    // 2. Migrate all user form submissions
    const submissionsResult = await migrateAllUserSubmissions(userId)
    result.totalSubmissions = submissionsResult.totalSubmissions
    result.migratedSubmissions = submissionsResult.migratedSubmissions
    result.errors.push(...submissionsResult.errors)

    result.endTime = new Date().toISOString()
    return result
  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    result.endTime = new Date().toISOString()
    return result
  }
}

// ============================================
// Migration Status Check
// ============================================

/**
 * Check if user needs data migration
 * Returns true if user has plaintext data but hasn't migrated yet
 */
export async function needsMigration(userId: string): Promise<boolean> {
  const supabase = createClient()

  try {
    // Check profile migration status
    const { data: profile } = await supabase
      .from('user_secure_profiles')
      .select('encryption_migrated')
      .eq('id', userId)
      .single()

    if (profile && profile.encryption_migrated === false) {
      return true
    }

    // Check submissions migration status
    const { data: submissions } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('encryption_migrated', false)
      .limit(1)

    return (submissions?.length || 0) > 0
  } catch {
    // If error, assume no migration needed to avoid blocking user
    return false
  }
}

/**
 * Get migration progress for a user
 */
export async function getMigrationProgress(userId: string): Promise<{
  profileMigrated: boolean
  totalSubmissions: number
  migratedSubmissions: number
  percentComplete: number
}> {
  const supabase = createClient()

  try {
    // Check profile
    const { data: profile } = await supabase
      .from('user_secure_profiles')
      .select('encryption_migrated')
      .eq('id', userId)
      .single()

    // Count total and migrated submissions
    const { count: totalSubmissions } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: migratedSubmissions } = await supabase
      .from('form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('encryption_migrated', true)

    const total = (totalSubmissions || 0) + 1 // +1 for profile
    const migrated = (migratedSubmissions || 0) + (profile?.encryption_migrated ? 1 : 0)

    return {
      profileMigrated: profile?.encryption_migrated || false,
      totalSubmissions: totalSubmissions || 0,
      migratedSubmissions: migratedSubmissions || 0,
      percentComplete: total > 0 ? Math.round((migrated / total) * 100) : 100,
    }
  } catch {
    return {
      profileMigrated: false,
      totalSubmissions: 0,
      migratedSubmissions: 0,
      percentComplete: 0,
    }
  }
}
