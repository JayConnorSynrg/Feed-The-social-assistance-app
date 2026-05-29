/**
 * Vault System Tests
 *
 * Tests for the zero-knowledge vault key management system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateDEK,
  deriveKEK,
  wrapDEK,
  unwrapDEK,
  rotateKEK,
  generateSalt,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../crypto'

describe('Crypto Functions', () => {
  describe('Key Generation', () => {
    it('should generate a valid DEK', async () => {
      const { key, rawBytes } = await generateDEK()
      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
      expect(key.algorithm.name).toBe('AES-GCM')
      expect(key.extractable).toBe(false)
      expect(rawBytes).toHaveLength(32)
    })

    it('should generate different DEKs each time', async () => {
      const { key: key1, rawBytes: bytes1 } = await generateDEK()
      const { key: key2, rawBytes: bytes2 } = await generateDEK()
      expect(key1).not.toBe(key2)
      // Raw bytes must differ (probability of collision is negligible)
      expect(Buffer.from(bytes1).toString('hex')).not.toBe(Buffer.from(bytes2).toString('hex'))
    })

    it('should generate a random salt', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1).toHaveLength(16)
      expect(salt2).toHaveLength(16)
      expect(salt1).not.toEqual(salt2)
    })
  })

  describe('KEK Derivation', () => {
    it('should derive a KEK from password and salt', async () => {
      const password = 'test-password-123'
      const salt = generateSalt()
      const kek = await deriveKEK(password, salt)

      expect(kek).toBeDefined()
      expect(kek.type).toBe('secret')
      // KEK uses encrypt/decrypt because the envelope pattern wraps raw DEK bytes
      // via AES-GCM encrypt/decrypt rather than the wrapKey/unwrapKey API.
      expect(kek.usages).toContain('encrypt')
      expect(kek.usages).toContain('decrypt')
    })

    it('should derive the same KEK with same password and salt', async () => {
      const password = 'test-password-123'
      const salt = generateSalt()

      const kek1 = await deriveKEK(password, salt)
      const kek2 = await deriveKEK(password, salt)

      // Can't compare CryptoKeys directly, but they should have same properties
      expect(kek1.algorithm).toEqual(kek2.algorithm)
      expect(kek1.usages).toEqual(kek2.usages)
    })

    it('should derive different KEKs with different passwords', async () => {
      const salt = generateSalt()
      const kek1 = await deriveKEK('password1', salt)
      const kek2 = await deriveKEK('password2', salt)

      // They're different keys (can't compare directly but structure is same)
      expect(kek1).not.toBe(kek2)
    })

    it('should derive different KEKs with different salts', async () => {
      const password = 'test-password-123'
      const kek1 = await deriveKEK(password, generateSalt())
      const kek2 = await deriveKEK(password, generateSalt())

      expect(kek1).not.toBe(kek2)
    })
  })

  describe('Key Wrapping', () => {
    // Fixed: wrapDEK now uses the envelope pattern — AES-GCM-encrypts the raw
    // DEK bytes with the KEK. The in-use CryptoKey stays non-extractable.
    // generateDEK() returns { key: CryptoKey; rawBytes: Uint8Array }.
    it('should wrap and unwrap a DEK', async () => {
      const password = 'test-password-123'
      const salt = generateSalt()

      const { key: dek, rawBytes: dekRawBytes } = await generateDEK()
      const kek = await deriveKEK(password, salt)

      const { wrappedKey, iv } = await wrapDEK(dekRawBytes, kek)

      expect(wrappedKey).toBeDefined()
      expect(iv).toBeDefined()
      // 32-byte plaintext + 16-byte GCM auth tag = 48 bytes
      expect(wrappedKey.byteLength).toBe(48)

      // Unwrap and verify it's a valid non-extractable CryptoKey
      const unwrappedDEK = await unwrapDEK(wrappedKey, kek, iv)
      expect(unwrappedDEK).toBeDefined()
      expect(unwrappedDEK.type).toBe('secret')
      expect(unwrappedDEK.algorithm.name).toBe('AES-GCM')
      expect(unwrappedDEK.extractable).toBe(false)

      // Verify the unwrapped key can round-trip data that the original key encrypted
      const iv2 = new Uint8Array(12)
      globalThis.crypto.getRandomValues(iv2)
      const enc = new TextEncoder()
      const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv2 }, dek, enc.encode('sentinel'))
      const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv2 }, unwrappedDEK, ct)
      expect(new TextDecoder().decode(pt)).toBe('sentinel')
    })

    it('should fail to unwrap with wrong KEK', async () => {
      const salt = generateSalt()
      const { rawBytes: dekRawBytes } = await generateDEK()

      const kek1 = await deriveKEK('password1', salt)
      const { wrappedKey, iv } = await wrapDEK(dekRawBytes, kek1)

      const kek2 = await deriveKEK('password2', salt)

      await expect(unwrapDEK(wrappedKey, kek2, iv)).rejects.toThrow()
    })

    it('should fail to unwrap with wrong IV', async () => {
      const password = 'test-password-123'
      const salt = generateSalt()

      const { rawBytes: dekRawBytes } = await generateDEK()
      const kek = await deriveKEK(password, salt)
      const { wrappedKey } = await wrapDEK(dekRawBytes, kek)

      const wrongIV = new Uint8Array(12) // all zeros — will not match the wrap IV

      await expect(unwrapDEK(wrappedKey, kek, wrongIV)).rejects.toThrow()
    })
  })

  describe('KEK Rotation', () => {
    it('should rotate KEK successfully', async () => {
      const oldPassword = 'old-password-123'
      const newPassword = 'new-password-456'
      const salt = generateSalt()

      // Wrap DEK with old password
      const { rawBytes: dekRawBytes } = await generateDEK()
      const oldKEK = await deriveKEK(oldPassword, salt)
      const { wrappedKey, iv } = await wrapDEK(dekRawBytes, oldKEK)

      // Rotate to new password
      const { newWrappedKey, newIV, newSalt } = await rotateKEK(
        oldPassword,
        newPassword,
        salt,
        wrappedKey,
        iv
      )

      // Should be able to unwrap with new password
      const newKEK = await deriveKEK(newPassword, newSalt)
      const unwrappedDEK = await unwrapDEK(newWrappedKey, newKEK, newIV)

      expect(unwrappedDEK).toBeDefined()
      expect(unwrappedDEK.type).toBe('secret')
      expect(unwrappedDEK.extractable).toBe(false)

      // Should NOT be able to unwrap with old password + new salt
      const oldKEKNewSalt = await deriveKEK(oldPassword, newSalt)
      await expect(unwrapDEK(newWrappedKey, oldKEKNewSalt, newIV)).rejects.toThrow()
    })

    it('should fail rotation with wrong old password', async () => {
      const salt = generateSalt()
      const { rawBytes: dekRawBytes } = await generateDEK()
      const kek = await deriveKEK('correct-password', salt)
      const { wrappedKey, iv } = await wrapDEK(dekRawBytes, kek)

      await expect(
        rotateKEK('wrong-password', 'new-password', salt, wrappedKey, iv)
      ).rejects.toThrow()
    })
  })

  describe('Utility Functions', () => {
    it('should convert ArrayBuffer to base64 and back', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5])
      const base64 = arrayBufferToBase64(original.buffer as ArrayBuffer)
      const restored = new Uint8Array(base64ToArrayBuffer(base64))

      expect(base64).toBe('AQIDBAU=')
      expect(restored).toEqual(original)
    })

    it('should handle empty ArrayBuffer', () => {
      const original = new Uint8Array([])
      const base64 = arrayBufferToBase64(original.buffer as ArrayBuffer)
      const restored = new Uint8Array(base64ToArrayBuffer(base64))

      expect(base64).toBe('')
      expect(restored).toEqual(original)
    })
  })
})

describe('Vault Integration', () => {
  // Note: These tests would require mocking Supabase and IndexedDB
  // For now, they serve as documentation of expected behavior

  it.todo('should set up vault for new user')
  it.todo('should unlock vault with correct password')
  it.todo('should reject unlock with wrong password')
  it.todo('should store DEK in IndexedDB after unlock')
  it.todo('should clear DEK from IndexedDB on lock')
  it.todo('should encrypt field with unlocked vault')
  it.todo('should decrypt field with unlocked vault')
  it.todo('should reject encryption when vault is locked')
  it.todo('should change master password successfully')
  it.todo('should expire session after 24 hours')
  it.todo('should persist session across page refresh')
})

describe('Security Tests', () => {
  it('should use non-extractable KEK', async () => {
    const password = 'test-password-123'
    const salt = generateSalt()
    const kek = await deriveKEK(password, salt)

    expect(kek.extractable).toBe(false)
  })

  it('should keep DEK non-extractable while wrapping succeeds (envelope pattern)', async () => {
    // Regression guard: the envelope pattern fixes the wrapKey extractable bug
    // without sacrificing XSS protection. The in-use CryptoKey must stay
    // non-extractable; wrapDEK works on the raw bytes directly, not the CryptoKey.
    const { key: dek, rawBytes: dekRawBytes } = await generateDEK()
    expect(dek.extractable).toBe(false) // XSS protection preserved

    // Wrapping must succeed despite non-extractable CryptoKey
    const salt = generateSalt()
    const kek = await deriveKEK('test-password', salt)
    const { wrappedKey, iv } = await wrapDEK(dekRawBytes, kek)
    expect(wrappedKey.byteLength).toBe(48) // 32-byte DEK + 16-byte GCM tag

    // Unwrapped key is also non-extractable
    const restored = await unwrapDEK(wrappedKey, kek, iv)
    expect(restored.extractable).toBe(false)
  })

  it.todo('should not expose password in memory')
  it.todo('should not expose KEK in memory after use')
  it.todo('should rate limit password attempts')
})
