/**
 * Document Encryption Tests
 *
 * Tests for client-side document encryption/decryption functionality.
 * Note: These tests require a browser environment with Web Crypto API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { encryptFile, decryptFile, validateDocument, estimateEncryptedSize } from '../document-encryption'

// Mock the key-store module
vi.mock('../key-store', () => ({
  getDEK: vi.fn(async () => {
    // Generate a mock DEK for testing
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
  }),
}))

describe('Document Encryption', () => {
  let testFile: File

  beforeEach(() => {
    // Create a test file
    const content = 'This is a test document with some content.'
    testFile = new File([content], 'test-document.txt', { type: 'text/plain' })
  })

  describe('validateDocument', () => {
    it('should validate a valid PDF file', () => {
      const pdfFile = new File(['PDF content'], 'document.pdf', { type: 'application/pdf' })
      const result = validateDocument(pdfFile)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject files that are too large', () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('') // 11MB
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      const result = validateDocument(largeFile)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds')
    })

    it('should reject invalid file types', () => {
      const invalidFile = new File(['content'], 'script.js', { type: 'text/javascript' })
      const result = validateDocument(invalidFile)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed')
    })
  })

  describe('encryptFile', () => {
    it('should encrypt a small file successfully', async () => {
      const result = await encryptFile(testFile)

      expect(result).toHaveProperty('encryptedBlob')
      expect(result).toHaveProperty('iv')
      expect(result).toHaveProperty('originalName', 'test-document.txt')
      expect(result).toHaveProperty('originalType', 'text/plain')
      expect(result).toHaveProperty('originalSize')
      expect(result).toHaveProperty('encryptedName')
      expect(result).toHaveProperty('encryptedNameIV')

      // Encrypted blob should be larger than original (due to auth tag)
      expect(result.encryptedBlob.size).toBeGreaterThan(0)
    })

    it('should encrypt with progress callback for large files', async () => {
      // Create a 6MB file (larger than LARGE_FILE_THRESHOLD)
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('')
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })

      const progressUpdates: number[] = []
      const onProgress = vi.fn((progress) => {
        progressUpdates.push(progress.percentage)
      })

      const result = await encryptFile(largeFile, onProgress)

      expect(result.encryptedBlob.size).toBeGreaterThan(0)
      expect(onProgress).toHaveBeenCalled()
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
    })

    it('should encrypt the filename', async () => {
      const result = await encryptFile(testFile)

      // Encrypted filename should be different from original
      expect(result.encryptedName).not.toBe(result.originalName)
      // Should be base64 encoded
      expect(result.encryptedName).toMatch(/^[A-Za-z0-9+/=]+$/)
    })
  })

  describe('decryptFile', () => {
    it('should decrypt an encrypted file back to original', async () => {
      // First encrypt
      const encrypted = await encryptFile(testFile)

      // Then decrypt
      const decrypted = await decryptFile(
        encrypted.encryptedBlob,
        encrypted.iv,
        encrypted.encryptedName,
        encrypted.encryptedNameIV,
        encrypted.originalType
      )

      // Check file properties
      expect(decrypted.name).toBe(testFile.name)
      expect(decrypted.type).toBe(testFile.type)
      expect(decrypted.size).toBe(testFile.size)

      // Check file content
      const originalContent = await testFile.text()
      const decryptedContent = await decrypted.text()
      expect(decryptedContent).toBe(originalContent)
    })

    it('should handle large file decryption with progress', async () => {
      // Create and encrypt a 6MB file
      const largeContent = new Array(6 * 1024 * 1024).fill('b').join('')
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })

      const encrypted = await encryptFile(largeFile)

      const progressUpdates: number[] = []
      const onProgress = vi.fn((progress) => {
        progressUpdates.push(progress.percentage)
      })

      const decrypted = await decryptFile(
        encrypted.encryptedBlob,
        encrypted.iv,
        encrypted.encryptedName,
        encrypted.encryptedNameIV,
        encrypted.originalType,
        onProgress
      )

      expect(decrypted.size).toBe(largeFile.size)
      expect(onProgress).toHaveBeenCalled()
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
    })
  })

  describe('estimateEncryptedSize', () => {
    it('should estimate encrypted size correctly for small files', () => {
      const originalSize = 1000
      const estimated = estimateEncryptedSize(originalSize)
      // Should add auth tag (16 bytes per chunk)
      expect(estimated).toBeGreaterThan(originalSize)
      expect(estimated).toBeLessThan(originalSize + 100)
    })

    it('should estimate encrypted size correctly for large files', () => {
      const originalSize = 10 * 1024 * 1024 // 10MB
      const estimated = estimateEncryptedSize(originalSize)
      // Should account for multiple chunks
      expect(estimated).toBeGreaterThan(originalSize)
    })
  })

  describe('Round-trip encryption/decryption', () => {
    it('should preserve file integrity through encrypt/decrypt cycle', async () => {
      // Create test files with different types
      const testFiles = [
        new File(['PDF content here'], 'test.pdf', { type: 'application/pdf' }),
        new File(['JPEG binary data'], 'photo.jpg', { type: 'image/jpeg' }),
        new File(['PNG binary data'], 'image.png', { type: 'image/png' }),
      ]

      for (const file of testFiles) {
        const originalContent = await file.text()

        // Encrypt
        const encrypted = await encryptFile(file)

        // Decrypt
        const decrypted = await decryptFile(
          encrypted.encryptedBlob,
          encrypted.iv,
          encrypted.encryptedName,
          encrypted.encryptedNameIV,
          encrypted.originalType
        )

        // Verify
        const decryptedContent = await decrypted.text()
        expect(decryptedContent).toBe(originalContent)
        expect(decrypted.name).toBe(file.name)
        expect(decrypted.type).toBe(file.type)
      }
    })
  })
})
