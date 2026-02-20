// Session Management Utilities
// Handles user session tracking, device fingerprinting, and session revocation

import { createClient } from '@/lib/supabase/client'

export interface SessionInfo {
  id: string
  device_info: string
  ip_address: string
  location_info?: {
    city?: string
    country?: string
  }
  last_active_at: string
  created_at: string
  is_current: boolean
}

/**
 * Get browser/device information from User-Agent
 */
export function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown'

  const ua = navigator.userAgent
  let browser = 'Unknown Browser'
  let os = 'Unknown OS'

  // Detect browser
  if (ua.includes('Firefox/')) {
    browser = 'Firefox'
  } else if (ua.includes('Edg/')) {
    browser = 'Edge'
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome'
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari'
  }

  // Detect OS
  if (ua.includes('Windows')) {
    os = 'Windows'
  } else if (ua.includes('Mac OS X')) {
    os = 'macOS'
  } else if (ua.includes('Linux')) {
    os = 'Linux'
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS'
  } else if (ua.includes('Android')) {
    os = 'Android'
  }

  return `${browser} on ${os}`
}

/**
 * Session Manager Class
 */
export class SessionManager {
  private supabase = createClient()

  /**
   * Record a new session when user logs in
   */
  async recordSession(userId: string, sessionToken: string): Promise<void> {
    try {
      const deviceInfo = getDeviceInfo()

      // Get IP address from client-side API route
      const ipResponse = await fetch('/api/client-ip')
      const ipData = await ipResponse.json()

      await this.supabase.from('user_sessions').insert({
        user_id: userId,
        session_token: sessionToken,
        device_info: deviceInfo,
        ip_address: ipData.ip || null,
        location_info: ipData.location || null,
        is_current: true,
      })

      // Mark other sessions as not current
      await this.supabase
        .from('user_sessions')
        .update({ is_current: false })
        .eq('user_id', userId)
        .neq('session_token', sessionToken)
    } catch (error) {
      console.error('Failed to record session:', error)
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    try {
      await this.supabase
        .from('user_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('session_token', sessionToken)
    } catch (error) {
      console.error('Failed to update session activity:', error)
    }
  }

  /**
   * Get all active sessions for current user
   */
  async getUserSessions(): Promise<SessionInfo[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active_at', { ascending: false })

      if (error) throw error

      return (data || []).map(session => ({
        id: session.id,
        device_info: session.device_info || '',
        ip_address: String(session.ip_address || ''),
        location_info: session.location_info as { city?: string; country?: string } | undefined,
        last_active_at: session.last_active_at || '',
        created_at: session.created_at || '',
        is_current: session.is_current || false,
      }))
    } catch (error) {
      console.error('Failed to get user sessions:', error)
      return []
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId)

      return !error
    } catch (error) {
      console.error('Failed to revoke session:', error)
      return false
    }
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllOtherSessions(): Promise<boolean> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return false

      const { error } = await this.supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('is_current', false)

      return !error
    } catch (error) {
      console.error('Failed to revoke other sessions:', error)
      return false
    }
  }

  /**
   * Clean up sessions for logged-out user
   */
  async cleanupUserSessions(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)
    } catch (error) {
      console.error('Failed to cleanup sessions:', error)
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()
