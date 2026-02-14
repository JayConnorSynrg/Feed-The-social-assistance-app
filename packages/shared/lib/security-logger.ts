/**
 * Security Audit Logger for FEED Federation System
 *
 * Pure TypeScript implementation with zero external dependencies.
 * Logs security events with 90-day retention for admin audit queries.
 */

// ============================================================================
// Types
// ============================================================================

export type SecurityEventType =
  | 'signature_failed'
  | 'rate_limited'
  | 'abuse_detected'
  | 'instance_suspended'
  | 'instance_restored'
  | 'admin_override'
  | 'unauthorized_access'
  | 'content_filtered'
  | 'webhook_rejected';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  instanceId?: string;
  instanceName?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  details: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  expiresAt: number;  // timestamp + 90 days
}

export interface SecurityQuery {
  type?: SecurityEventType;
  severity?: SecurityEvent['severity'];
  instanceId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

export interface SecurityLogStats {
  total: number;
  byType: Record<SecurityEventType, number>;
  bySeverity: Record<string, number>;
  recentCritical: number;
}

// ============================================================================
// SecurityLogger Class
// ============================================================================

const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export class SecurityLogger {
  private events: Map<string, SecurityEvent> = new Map();
  private eventCounter = 0;

  /**
   * Generate a simple UUID-like identifier without dependencies
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (++this.eventCounter).toString(36).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 10);
    return `sec_${timestamp}_${counter}_${random}`;
  }

  /**
   * Log a security event
   */
  log(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'expiresAt'>): SecurityEvent {
    const now = Date.now();
    const fullEvent: SecurityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: now,
      expiresAt: now + RETENTION_MS,
    };

    this.events.set(fullEvent.id, fullEvent);

    // Auto-purge expired events periodically (every 100 logs)
    if (this.eventCounter % 100 === 0) {
      this.purgeExpired();
    }

    return fullEvent;
  }

  /**
   * Query security events with filtering
   */
  query(filter: SecurityQuery = {}): SecurityEvent[] {
    let results = Array.from(this.events.values());

    // Apply filters
    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    if (filter.severity) {
      results = results.filter(e => e.severity === filter.severity);
    }
    if (filter.instanceId) {
      results = results.filter(e => e.instanceId === filter.instanceId);
    }
    if (filter.startTime) {
      results = results.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      results = results.filter(e => e.timestamp <= filter.endTime!);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || results.length;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get statistics for security events
   */
  getStats(windowMs?: number): SecurityLogStats {
    const now = Date.now();
    const cutoff = windowMs ? now - windowMs : 0;

    const events = Array.from(this.events.values()).filter(
      e => e.timestamp >= cutoff
    );

    const byType: Record<SecurityEventType, number> = {
      signature_failed: 0,
      rate_limited: 0,
      abuse_detected: 0,
      instance_suspended: 0,
      instance_restored: 0,
      admin_override: 0,
      unauthorized_access: 0,
      content_filtered: 0,
      webhook_rejected: 0,
    };

    const bySeverity: Record<string, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    let recentCritical = 0;
    const recentWindow = now - (24 * 60 * 60 * 1000); // Last 24 hours

    for (const event of events) {
      byType[event.type]++;
      bySeverity[event.severity]++;

      if (event.severity === 'critical' && event.timestamp >= recentWindow) {
        recentCritical++;
      }
    }

    return {
      total: events.length,
      byType,
      bySeverity,
      recentCritical,
    };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit = 50): SecurityEvent[] {
    return this.query({ limit });
  }

  /**
   * Get events for a specific instance
   */
  getEventsByInstance(instanceId: string, limit = 100): SecurityEvent[] {
    return this.query({ instanceId, limit });
  }

  /**
   * Purge expired events beyond retention period
   */
  purgeExpired(): number {
    const now = Date.now();
    let purgedCount = 0;

    for (const [id, event] of this.events.entries()) {
      if (event.expiresAt <= now) {
        this.events.delete(id);
        purgedCount++;
      }
    }

    return purgedCount;
  }

  /**
   * Get total event count
   */
  size(): number {
    return this.events.size;
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.eventCounter = 0;
  }
}

// ============================================================================
// Convenience Methods
// ============================================================================

export function logSignatureFailure(
  logger: SecurityLogger,
  instanceId: string,
  ip: string,
  details: string
): SecurityEvent {
  return logger.log({
    type: 'signature_failed',
    severity: 'error',
    instanceId,
    ipAddress: ip,
    details,
    metadata: {
      category: 'authentication',
    },
  });
}

export function logRateLimitViolation(
  logger: SecurityLogger,
  instanceId: string,
  ip: string,
  category: string
): SecurityEvent {
  return logger.log({
    type: 'rate_limited',
    severity: 'warning',
    instanceId,
    ipAddress: ip,
    details: `Rate limit exceeded for category: ${category}`,
    metadata: {
      category,
    },
  });
}

export function logAbuseDetection(
  logger: SecurityLogger,
  instanceId: string,
  abuseType: string,
  score: number
): SecurityEvent {
  const severity: SecurityEvent['severity'] =
    score >= 0.9 ? 'critical' :
    score >= 0.7 ? 'error' :
    score >= 0.5 ? 'warning' : 'info';

  return logger.log({
    type: 'abuse_detected',
    severity,
    instanceId,
    details: `Abuse detected: ${abuseType} (score: ${score.toFixed(2)})`,
    metadata: {
      abuseType,
      score,
    },
  });
}

export function logInstanceSuspension(
  logger: SecurityLogger,
  instanceId: string,
  reason: string
): SecurityEvent {
  return logger.log({
    type: 'instance_suspended',
    severity: 'critical',
    instanceId,
    details: `Instance suspended: ${reason}`,
    metadata: {
      reason,
      action: 'suspend',
    },
  });
}

export function logAdminOverride(
  logger: SecurityLogger,
  adminAction: string,
  instanceId: string,
  details: string
): SecurityEvent {
  return logger.log({
    type: 'admin_override',
    severity: 'warning',
    instanceId,
    details: `Admin action: ${adminAction} - ${details}`,
    metadata: {
      adminAction,
    },
  });
}

// ============================================================================
// Singleton Factory
// ============================================================================

let globalLogger: SecurityLogger | null = null;

export function createSecurityLogger(): SecurityLogger {
  if (!globalLogger) {
    globalLogger = new SecurityLogger();
  }
  return globalLogger;
}

/**
 * Reset the singleton (for testing)
 */
export function resetSecurityLogger(): void {
  globalLogger = null;
}
