/**
 * Audit Logger Service
 *
 * Provides centralized audit logging for security-relevant events.
 * Logs are immutable and stored in the audit_log table.
 *
 * Features:
 * - Non-blocking (fire-and-forget)
 * - Silent failure (never breaks the app)
 * - Automatic user context injection
 * - Type-safe event definitions
 */

import { createClient } from '@/lib/supabase/client'

// ============================================
// Types
// ============================================
export type AuditEventCategory = 'auth' | 'vault' | 'encryption' | 'mfa' | 'document' | 'profile' | 'admin' | 'system'
export type AuditSeverity = 'info' | 'warning' | 'critical'
export type AuditAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'encrypt'
  | 'decrypt'
  | 'verify'
  | 'setup'
  | 'enroll'
  | 'unenroll'
  | 'upload'
  | 'download'
  | 'lock'
  | 'unlock'
  | 'change_password'

export interface AuditEvent {
  eventType: string
  eventCategory: AuditEventCategory
  action: AuditAction
  severity?: AuditSeverity
  resourceType?: string
  resourceId?: string
  details?: Record<string, any>
}

interface AuditEventDefinition {
  eventType: string
  eventCategory: AuditEventCategory
  severity: AuditSeverity
}

// ============================================
// Pre-defined Event Types
// ============================================
export const AUDIT_EVENTS = {
  // Auth events
  AUTH_LOGIN_SUCCESS: {
    eventType: 'auth.login_success',
    eventCategory: 'auth',
    severity: 'info',
  },
  AUTH_LOGIN_FAILED: {
    eventType: 'auth.login_failed',
    eventCategory: 'auth',
    severity: 'warning',
  },
  AUTH_LOGOUT: {
    eventType: 'auth.logout',
    eventCategory: 'auth',
    severity: 'info',
  },
  AUTH_PASSWORD_CHANGED: {
    eventType: 'auth.password_changed',
    eventCategory: 'auth',
    severity: 'critical',
  },
  AUTH_ACCOUNT_LOCKED: {
    eventType: 'auth.account_locked',
    eventCategory: 'auth',
    severity: 'critical',
  },
  AUTH_MFA_REQUIRED: {
    eventType: 'auth.mfa_required',
    eventCategory: 'auth',
    severity: 'info',
  },

  // Vault events
  VAULT_SETUP: {
    eventType: 'vault.setup',
    eventCategory: 'vault',
    severity: 'critical',
  },
  VAULT_UNLOCK: {
    eventType: 'vault.unlock',
    eventCategory: 'vault',
    severity: 'info',
  },
  VAULT_LOCK: {
    eventType: 'vault.lock',
    eventCategory: 'vault',
    severity: 'info',
  },
  VAULT_PASSWORD_CHANGED: {
    eventType: 'vault.password_changed',
    eventCategory: 'vault',
    severity: 'critical',
  },
  VAULT_UNLOCK_FAILED: {
    eventType: 'vault.unlock_failed',
    eventCategory: 'vault',
    severity: 'warning',
  },

  // Encryption events
  DATA_ENCRYPTED: {
    eventType: 'data.encrypted',
    eventCategory: 'encryption',
    severity: 'info',
  },
  DATA_DECRYPTED: {
    eventType: 'data.decrypted',
    eventCategory: 'encryption',
    severity: 'info',
  },
  DATA_MIGRATION: {
    eventType: 'data.migration',
    eventCategory: 'encryption',
    severity: 'warning',
  },
  ENCRYPTION_ERROR: {
    eventType: 'encryption.error',
    eventCategory: 'encryption',
    severity: 'critical',
  },

  // MFA events
  MFA_ENROLLED: {
    eventType: 'mfa.enrolled',
    eventCategory: 'mfa',
    severity: 'critical',
  },
  MFA_UNENROLLED: {
    eventType: 'mfa.unenrolled',
    eventCategory: 'mfa',
    severity: 'critical',
  },
  MFA_VERIFIED: {
    eventType: 'mfa.verified',
    eventCategory: 'mfa',
    severity: 'info',
  },
  MFA_FAILED: {
    eventType: 'mfa.failed',
    eventCategory: 'mfa',
    severity: 'warning',
  },
  MFA_BACKUP_CODE_USED: {
    eventType: 'mfa.backup_code_used',
    eventCategory: 'mfa',
    severity: 'warning',
  },
  MFA_BACKUP_CODES_GENERATED: {
    eventType: 'mfa.backup_codes_generated',
    eventCategory: 'mfa',
    severity: 'critical',
  },

  // Document events
  DOCUMENT_UPLOADED: {
    eventType: 'document.uploaded',
    eventCategory: 'document',
    severity: 'info',
  },
  DOCUMENT_DOWNLOADED: {
    eventType: 'document.downloaded',
    eventCategory: 'document',
    severity: 'info',
  },
  DOCUMENT_DELETED: {
    eventType: 'document.deleted',
    eventCategory: 'document',
    severity: 'warning',
  },
  DOCUMENT_VIEWED: {
    eventType: 'document.viewed',
    eventCategory: 'document',
    severity: 'info',
  },

  // Profile events
  PROFILE_SENSITIVE_VIEWED: {
    eventType: 'profile.sensitive_viewed',
    eventCategory: 'profile',
    severity: 'info',
  },
  PROFILE_SENSITIVE_UPDATED: {
    eventType: 'profile.sensitive_updated',
    eventCategory: 'profile',
    severity: 'warning',
  },
  PROFILE_CREATED: {
    eventType: 'profile.created',
    eventCategory: 'profile',
    severity: 'info',
  },
  PROFILE_UPDATED: {
    eventType: 'profile.updated',
    eventCategory: 'profile',
    severity: 'info',
  },

  // Admin events
  ADMIN_USER_VIEWED: {
    eventType: 'admin.user_viewed',
    eventCategory: 'admin',
    severity: 'warning',
  },
  ADMIN_RESOURCE_APPROVED: {
    eventType: 'admin.resource_approved',
    eventCategory: 'admin',
    severity: 'info',
  },
  ADMIN_USER_UPDATED: {
    eventType: 'admin.user_updated',
    eventCategory: 'admin',
    severity: 'warning',
  },
} as const satisfies Record<string, AuditEventDefinition>

// ============================================
// Audit Logger Class
// ============================================
class AuditLogger {
  /**
   * Log an audit event
   *
   * Fire-and-forget: Never throws, never blocks the main action
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // No user context - log as system event
        console.warn('Audit event logged without user context:', event.eventType)
      }

      // Get session info for additional context
      const {
        data: { session },
      } = await supabase.auth.getSession()

      // Insert audit log entry
      const { error } = await supabase.from('audit_log').insert({
        user_id: user?.id || null,
        session_id: session?.access_token ? this.hashSessionId(session.access_token) : null,
        event_type: event.eventType,
        event_category: event.eventCategory,
        severity: event.severity || 'info',
        resource_type: event.resourceType || null,
        resource_id: event.resourceId || null,
        action: event.action,
        details: event.details || null,
        // IP address and user agent would be extracted server-side via Edge Function
        // if we want to avoid exposing them to client code
      })

      if (error) {
        // Silent failure - just log to console
        console.error('Failed to log audit event:', error)
      }
    } catch (err) {
      // Never throw - audit logging failure should not break the app
      console.error('Audit logging error:', err)
    }
  }

  /**
   * Log a pre-defined event type with automatic metadata
   */
  async logPredefinedEvent(
    eventKey: keyof typeof AUDIT_EVENTS,
    options?: {
      action: AuditAction
      resourceType?: string
      resourceId?: string
      details?: Record<string, any>
    }
  ): Promise<void> {
    const eventDef = AUDIT_EVENTS[eventKey]

    await this.logEvent({
      eventType: eventDef.eventType,
      eventCategory: eventDef.eventCategory,
      severity: eventDef.severity,
      action: options?.action || 'read',
      resourceType: options?.resourceType,
      resourceId: options?.resourceId,
      details: options?.details,
    })
  }

  /**
   * Hash session ID for privacy
   * We don't want to store full JWT tokens in logs
   */
  private hashSessionId(sessionId: string): string {
    // Simple hash for session tracking without exposing full token
    // In production, consider using a proper hash function
    return sessionId.substring(0, 16)
  }
}

// ============================================
// Singleton Instance
// ============================================
export const auditLogger = new AuditLogger()

// ============================================
// Convenience Functions
// ============================================
/**
 * Log an audit event (fire-and-forget)
 */
export function logAuditEvent(event: AuditEvent): void {
  // Fire and forget - don't await
  auditLogger.logEvent(event).catch((err) => {
    console.error('Audit event logging failed:', err)
  })
}

/**
 * Log a pre-defined event type
 */
export function logPredefinedEvent(
  eventKey: keyof typeof AUDIT_EVENTS,
  options?: {
    action: AuditAction
    resourceType?: string
    resourceId?: string
    details?: Record<string, any>
  }
): void {
  // Fire and forget
  auditLogger.logPredefinedEvent(eventKey, options).catch((err) => {
    console.error('Audit event logging failed:', err)
  })
}
