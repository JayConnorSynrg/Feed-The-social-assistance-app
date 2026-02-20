/**
 * Platform Detection Utility
 *
 * Detects whether the app is running on web, iOS, or Android.
 * Used to conditionally use IndexedDB (web) vs native secure storage (mobile).
 */

import { Capacitor } from '@capacitor/core'

/**
 * Check if running on a native platform (iOS or Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Get the current platform
 */
export function getPlatform(): 'web' | 'ios' | 'android' {
  if (!Capacitor.isNativePlatform()) {
    return 'web'
  }
  return Capacitor.getPlatform() as 'ios' | 'android'
}

/**
 * Check if running in a browser environment (SSR-safe)
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}
