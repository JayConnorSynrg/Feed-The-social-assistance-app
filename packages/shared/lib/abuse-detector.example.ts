/**
 * Example usage of AbuseDetector for FEED Federation
 *
 * This file demonstrates how to use the abuse detection library
 * in a federation partner monitoring system.
 */

import { createAbuseDetector, AbuseDetector } from './abuse-detector';

// ============================================================================
// Basic Usage
// ============================================================================

// Create detector with default configuration
const detector = createAbuseDetector();

// Record various abuse events
detector.recordEvent({
  type: 'rate_abuse',
  instanceId: 'partner-instance-123',
  details: 'Excessive API requests: 150 req/min',
  severity: 'high',
});

detector.recordEvent({
  type: 'signature_abuse',
  instanceId: 'partner-instance-123',
  details: 'Invalid signature on resource sync',
  severity: 'critical',
});

detector.recordEvent({
  type: 'malformed_data',
  instanceId: 'partner-instance-456',
  details: 'Resource missing required field: location',
  severity: 'medium',
});

// Check if instance is suspended
const isSuspended = detector.isInstanceSuspended('partner-instance-123');
console.log(`Instance suspended: ${isSuspended}`);

// Get abuse report for specific instance
const report = detector.analyzeInstance('partner-instance-123');
console.log('Abuse Report:', {
  instanceId: report.instanceId,
  eventCount: report.events.length,
  totalScore: report.totalScore,
  recommendation: report.recommendation,
  autoSuspended: report.autoSuspended,
});

// Get all active alerts
const alerts = detector.getActiveAlerts();
console.log(`Active alerts: ${alerts.length}`);
for (const alert of alerts) {
  console.log(`- ${alert.instanceId}: Score ${alert.totalScore} (${alert.recommendation})`);
}

// Admin action: clear abuse record
detector.clearInstance('partner-instance-789');

// ============================================================================
// Custom Configuration
// ============================================================================

const strictDetector = createAbuseDetector({
  windowMs: 30 * 60 * 1000, // 30 minutes instead of 60
  rateThreshold: 50, // More strict rate limiting
  signatureFailThreshold: 3, // Lower tolerance for signature failures
  autoSuspendScore: 75, // Suspend at lower score
  scoringWeights: {
    rate_abuse: 15, // Higher penalty for rate abuse
    signature_abuse: 30, // Critical penalty for signature issues
    malformed_data: 20,
    spam_resources: 25,
    suspicious_activity: 10,
  },
});

// ============================================================================
// Integration Example: Federation API Middleware
// ============================================================================

interface FederationRequest {
  instanceId: string;
  signature: string;
  data: unknown;
}

class FederationAPI {
  private detector: AbuseDetector;

  constructor() {
    this.detector = createAbuseDetector();
  }

  async handleIncomingRequest(request: FederationRequest): Promise<boolean> {
    // Check if instance is already suspended
    if (this.detector.isInstanceSuspended(request.instanceId)) {
      console.error(`Request from suspended instance: ${request.instanceId}`);
      return false;
    }

    // Validate signature
    if (!this.validateSignature(request)) {
      this.detector.recordEvent({
        type: 'signature_abuse',
        instanceId: request.instanceId,
        details: 'Invalid signature on incoming request',
        severity: 'critical',
      });
      return false;
    }

    // Validate data structure
    if (!this.validateData(request.data)) {
      this.detector.recordEvent({
        type: 'malformed_data',
        instanceId: request.instanceId,
        details: 'Malformed data in request payload',
        severity: 'medium',
      });
      return false;
    }

    // Check for spam patterns
    if (this.detectSpam(request.data)) {
      this.detector.recordEvent({
        type: 'spam_resources',
        instanceId: request.instanceId,
        details: 'Spam pattern detected in resource submission',
        severity: 'high',
      });
      return false;
    }

    // Track rate for monitoring
    const report = this.detector.analyzeInstance(request.instanceId);
    if (report.totalScore >= 50) {
      console.warn(`Instance ${request.instanceId} approaching abuse threshold: ${report.totalScore}`);
    }

    return true;
  }

  private validateSignature(request: FederationRequest): boolean {
    // Implementation would verify cryptographic signature
    return true;
  }

  private validateData(data: unknown): boolean {
    // Implementation would validate data structure
    return true;
  }

  private detectSpam(data: unknown): boolean {
    // Implementation would check for spam patterns
    return false;
  }

  getAbuseReport(instanceId: string) {
    return this.detector.analyzeInstance(instanceId);
  }

  getAllAlerts() {
    return this.detector.getActiveAlerts();
  }

  adminClearAbuse(instanceId: string) {
    this.detector.clearInstance(instanceId);
    console.log(`Cleared abuse record for ${instanceId}`);
  }
}

// ============================================================================
// Monitoring Dashboard Example
// ============================================================================

function generateDashboardData(detector: AbuseDetector) {
  const alerts = detector.getActiveAlerts();
  const trackedInstances = detector.getTrackedInstances();
  const suspendedInstances = detector.getSuspendedInstances();

  return {
    summary: {
      totalTracked: trackedInstances.length,
      totalAlerts: alerts.length,
      totalSuspended: suspendedInstances.length,
    },
    alerts: alerts.map(alert => ({
      instanceId: alert.instanceId,
      score: alert.totalScore,
      recommendation: alert.recommendation,
      recentEvents: alert.events.slice(-5).map(e => ({
        type: e.type,
        severity: e.severity,
        details: e.details,
      })),
    })),
    suspendedInstances,
  };
}

export { FederationAPI, generateDashboardData };
