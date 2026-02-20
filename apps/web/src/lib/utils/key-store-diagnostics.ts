/**
 * Key Store Diagnostics
 *
 * Utilities for testing and debugging the platform-aware key store.
 */

import { getPlatform, isNativePlatform } from '@/lib/platform'
import {
  hasActiveDEK,
  getSessionMetadata,
  clearKeys,
} from '@/lib/key-store'

export interface DiagnosticReport {
  platform: 'web' | 'ios' | 'android'
  isNative: boolean
  hasActiveDEK: boolean
  sessionMetadata: {
    userId: string
    timestamp: number
    version: number
  } | null
  timestamp: string
}

/**
 * Generate a diagnostic report of the current key store state
 */
export async function generateDiagnosticReport(): Promise<DiagnosticReport> {
  const platform = getPlatform()
  const isNative = isNativePlatform()
  const hasDEK = await hasActiveDEK()
  const metadata = await getSessionMetadata()

  return {
    platform,
    isNative,
    hasActiveDEK: hasDEK,
    sessionMetadata: metadata,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Clear all keys and generate a report
 */
export async function clearKeysAndReport(): Promise<{
  beforeClear: DiagnosticReport
  afterClear: DiagnosticReport
}> {
  const beforeClear = await generateDiagnosticReport()
  await clearKeys()
  const afterClear = await generateDiagnosticReport()

  return {
    beforeClear,
    afterClear,
  }
}

/**
 * Log diagnostic report to console
 */
export async function logDiagnostics(): Promise<void> {
  const report = await generateDiagnosticReport()
  console.group('🔐 Key Store Diagnostics')
  console.log('Platform:', report.platform, report.isNative ? '(Native)' : '(Web)')
  console.log('Has Active DEK:', report.hasActiveDEK ? '✅' : '❌')
  if (report.sessionMetadata) {
    console.log('Session Metadata:', report.sessionMetadata)
    const age = Date.now() - report.sessionMetadata.timestamp
    const ageMinutes = Math.floor(age / 1000 / 60)
    console.log(`Session Age: ${ageMinutes} minutes`)
  } else {
    console.log('Session Metadata: None')
  }
  console.log('Report Timestamp:', report.timestamp)
  console.groupEnd()
}
