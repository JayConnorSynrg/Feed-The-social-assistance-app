/**
 * Abuse Detection Library for FEED Federation Partners
 *
 * Zero-dependency TypeScript library for detecting and preventing abuse
 * from federated instances.
 *
 * @module abuse-detector
 */

// ============================================================================
// Types
// ============================================================================

export type AbuseType =
  | 'rate_abuse'
  | 'signature_abuse'
  | 'malformed_data'
  | 'spam_resources'
  | 'suspicious_activity';

export interface AbuseEvent {
  type: AbuseType;
  instanceId: string;
  timestamp: number;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AbuseReport {
  instanceId: string;
  events: AbuseEvent[];
  totalScore: number;
  recommendation: 'none' | 'warn' | 'throttle' | 'suspend';
  autoSuspended: boolean;
}

export interface AbuseDetectorConfig {
  /** Tracking window in milliseconds (default: 60 minutes) */
  windowMs: number;
  /** Maximum rate events before flagging (default: 100) */
  rateThreshold: number;
  /** Maximum signature failures (default: 5) */
  signatureFailThreshold: number;
  /** Maximum malformed data events (default: 10) */
  malformedDataThreshold: number;
  /** Score threshold for auto-suspend (default: 100) */
  autoSuspendScore: number;
  /** Point values for each abuse type */
  scoringWeights: Record<AbuseType, number>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export function createDefaultAbuseConfig(): AbuseDetectorConfig {
  return {
    windowMs: 60 * 60 * 1000, // 60 minutes
    rateThreshold: 100,
    signatureFailThreshold: 5,
    malformedDataThreshold: 10,
    autoSuspendScore: 100,
    scoringWeights: {
      rate_abuse: 10,
      signature_abuse: 25,
      malformed_data: 15,
      spam_resources: 20,
      suspicious_activity: 5,
    },
  };
}

// ============================================================================
// AbuseDetector Class
// ============================================================================

export class AbuseDetector {
  private config: AbuseDetectorConfig;
  private events: Map<string, AbuseEvent[]>;
  private suspensions: Set<string>;
  private lastCleanup: number;

  constructor(config?: Partial<AbuseDetectorConfig>) {
    this.config = { ...createDefaultAbuseConfig(), ...config };
    this.events = new Map();
    this.suspensions = new Set();
    this.lastCleanup = Date.now();
  }

  /**
   * Record an abuse event from a federated instance
   */
  public recordEvent(event: Omit<AbuseEvent, 'timestamp'>): void {
    const fullEvent: AbuseEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Get or create event list for this instance
    const instanceEvents = this.events.get(event.instanceId) || [];
    instanceEvents.push(fullEvent);
    this.events.set(event.instanceId, instanceEvents);

    // Cleanup old events periodically
    this.performCleanupIfNeeded();

    // Check for auto-suspend conditions
    const report = this.analyzeInstance(event.instanceId);
    if (report.totalScore >= this.config.autoSuspendScore) {
      this.suspensions.add(event.instanceId);
    }

    // Check threshold violations
    this.checkThresholds(event.instanceId, instanceEvents);
  }

  /**
   * Generate abuse report for a specific instance
   */
  public analyzeInstance(instanceId: string): AbuseReport {
    const instanceEvents = this.getRecentEvents(instanceId);
    const totalScore = this.calculateScore(instanceEvents);
    const autoSuspended = this.suspensions.has(instanceId);

    let recommendation: AbuseReport['recommendation'] = 'none';
    if (totalScore >= 100) {
      recommendation = 'suspend';
    } else if (totalScore >= 75) {
      recommendation = 'throttle';
    } else if (totalScore >= 50) {
      recommendation = 'warn';
    }

    return {
      instanceId,
      events: instanceEvents,
      totalScore,
      recommendation,
      autoSuspended,
    };
  }

  /**
   * Check if an instance is currently suspended
   */
  public isInstanceSuspended(instanceId: string): boolean {
    return this.suspensions.has(instanceId);
  }

  /**
   * Get all instances with active abuse alerts (score >= 50)
   */
  public getActiveAlerts(): AbuseReport[] {
    const alerts: AbuseReport[] = [];

    for (const instanceId of this.events.keys()) {
      const report = this.analyzeInstance(instanceId);
      if (report.totalScore >= 50) {
        alerts.push(report);
      }
    }

    // Sort by severity (highest score first)
    return alerts.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Admin override to clear abuse record for an instance
   */
  public clearInstance(instanceId: string): void {
    this.events.delete(instanceId);
    this.suspensions.delete(instanceId);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get events within the configured time window
   */
  private getRecentEvents(instanceId: string): AbuseEvent[] {
    const allEvents = this.events.get(instanceId) || [];
    const cutoff = Date.now() - this.config.windowMs;
    return allEvents.filter(event => event.timestamp >= cutoff);
  }

  /**
   * Calculate abuse score based on event types and severity
   */
  private calculateScore(events: AbuseEvent[]): number {
    return events.reduce((score, event) => {
      const baseWeight = this.config.scoringWeights[event.type];

      // Apply severity multiplier
      let multiplier = 1;
      switch (event.severity) {
        case 'low':
          multiplier = 0.5;
          break;
        case 'medium':
          multiplier = 1;
          break;
        case 'high':
          multiplier = 1.5;
          break;
        case 'critical':
          multiplier = 2;
          break;
      }

      return score + (baseWeight * multiplier);
    }, 0);
  }

  /**
   * Check if specific thresholds are violated
   */
  private checkThresholds(instanceId: string, events: AbuseEvent[]): void {
    const recentEvents = events.filter(
      e => e.timestamp >= Date.now() - this.config.windowMs
    );

    // Count events by type
    const counts: Record<AbuseType, number> = {
      rate_abuse: 0,
      signature_abuse: 0,
      malformed_data: 0,
      spam_resources: 0,
      suspicious_activity: 0,
    };

    for (const event of recentEvents) {
      counts[event.type]++;
    }

    // Check rate abuse threshold
    if (counts.rate_abuse >= this.config.rateThreshold) {
      this.recordEvent({
        type: 'rate_abuse',
        instanceId,
        details: `Exceeded rate threshold: ${counts.rate_abuse} events`,
        severity: 'critical',
      });
    }

    // Check signature abuse threshold
    if (counts.signature_abuse >= this.config.signatureFailThreshold) {
      this.recordEvent({
        type: 'signature_abuse',
        instanceId,
        details: `Exceeded signature failure threshold: ${counts.signature_abuse} failures`,
        severity: 'critical',
      });
    }

    // Check malformed data threshold
    if (counts.malformed_data >= this.config.malformedDataThreshold) {
      this.recordEvent({
        type: 'malformed_data',
        instanceId,
        details: `Exceeded malformed data threshold: ${counts.malformed_data} events`,
        severity: 'high',
      });
    }
  }

  /**
   * Cleanup old events to prevent memory growth
   */
  private performCleanupIfNeeded(): void {
    const now = Date.now();

    // Only cleanup every 5 minutes to avoid excessive processing
    if (now - this.lastCleanup < 5 * 60 * 1000) {
      return;
    }

    this.lastCleanup = now;
    const cutoff = now - this.config.windowMs;

    for (const [instanceId, events] of this.events.entries()) {
      // Filter out old events
      const recentEvents = events.filter(event => event.timestamp >= cutoff);

      if (recentEvents.length === 0) {
        // No recent events, remove instance entirely
        this.events.delete(instanceId);
        // Also remove suspension if no recent activity
        this.suspensions.delete(instanceId);
      } else {
        // Update with filtered events
        this.events.set(instanceId, recentEvents);
      }
    }
  }

  /**
   * Get configuration for inspection/debugging
   */
  public getConfig(): Readonly<AbuseDetectorConfig> {
    return { ...this.config };
  }

  /**
   * Get event count for an instance (useful for monitoring)
   */
  public getEventCount(instanceId: string): number {
    return this.getRecentEvents(instanceId).length;
  }

  /**
   * Get all tracked instance IDs
   */
  public getTrackedInstances(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get suspended instance IDs
   */
  public getSuspendedInstances(): string[] {
    return Array.from(this.suspensions);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AbuseDetector instance with optional configuration
 */
export function createAbuseDetector(
  config?: Partial<AbuseDetectorConfig>
): AbuseDetector {
  return new AbuseDetector(config);
}
