/**
 * Test utilities for key store integration
 *
 * This file provides manual testing functions for the platform-aware key store.
 * Import and run these in a component to verify functionality.
 */

import { generateDEK } from '@/lib/crypto'
import {
  storeDEK,
  getDEK,
  clearKeys,
  hasActiveDEK,
  getSessionMetadata,
} from '@/lib/key-store'
import { getPlatform } from '@/lib/platform'

/**
 * Test the full key store lifecycle
 */
export async function testKeyStoreLifecycle(): Promise<{
  success: boolean
  platform: string
  errors: string[]
}> {
  const errors: string[] = []
  const platform = getPlatform()

  console.log(`🧪 Testing key store on platform: ${platform}`)

  try {
    // 1. Clear any existing keys
    console.log('1️⃣ Clearing existing keys...')
    await clearKeys()
    const hasKeyAfterClear = await hasActiveDEK()
    if (hasKeyAfterClear) {
      errors.push('Keys still exist after clearKeys()')
    }

    // 2. Generate and store a DEK
    console.log('2️⃣ Generating and storing DEK...')
    const dek = await generateDEK()
    const testUserId = 'test-user-123'
    await storeDEK(dek, testUserId)

    // 3. Verify DEK exists
    console.log('3️⃣ Verifying DEK exists...')
    const hasKey = await hasActiveDEK()
    if (!hasKey) {
      errors.push('DEK not found after storing')
    }

    // 4. Retrieve DEK
    console.log('4️⃣ Retrieving DEK...')
    const retrievedDEK = await getDEK()
    if (!retrievedDEK) {
      errors.push('Failed to retrieve DEK')
    }

    // 5. Verify metadata
    console.log('5️⃣ Verifying session metadata...')
    const metadata = await getSessionMetadata()
    if (!metadata) {
      errors.push('Session metadata not found')
    } else if (metadata.userId !== testUserId) {
      errors.push(`User ID mismatch: expected ${testUserId}, got ${metadata.userId}`)
    }

    // 6. Test encryption/decryption with retrieved DEK
    console.log('6️⃣ Testing encryption with retrieved DEK...')
    if (retrievedDEK) {
      const testData = 'Hello, FEED!'
      const encoder = new TextEncoder()
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        retrievedDEK,
        encoder.encode(testData)
      )

      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        retrievedDEK,
        ciphertext
      )

      const decoder = new TextDecoder()
      const decryptedText = decoder.decode(plaintext)

      if (decryptedText !== testData) {
        errors.push(`Encryption test failed: expected "${testData}", got "${decryptedText}"`)
      }
    }

    // 7. Clear keys
    console.log('7️⃣ Clearing keys...')
    await clearKeys()
    const hasKeyAfterFinalClear = await hasActiveDEK()
    if (hasKeyAfterFinalClear) {
      errors.push('Keys still exist after final clearKeys()')
    }

    console.log('✅ Test complete')
    return {
      success: errors.length === 0,
      platform,
      errors,
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
    errors.push(error instanceof Error ? error.message : String(error))
    return {
      success: false,
      platform,
      errors,
    }
  }
}

/**
 * Quick test to verify platform detection
 */
export function testPlatformDetection(): void {
  const platform = getPlatform()
  console.log('Platform:', platform)
  console.log('User Agent:', navigator.userAgent)
}
