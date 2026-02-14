/**
 * Security Logger Usage Examples
 *
 * This demonstrates how to use the security logger in the FEED federation system.
 */

import {
  createSecurityLogger,
  logSignatureFailure,
  logRateLimitViolation,
  logAbuseDetection,
  logInstanceSuspension,
  logAdminOverride,
  type SecurityQuery,
} from './security-logger';

// ============================================================================
// Example 1: Basic Setup
// ============================================================================

// Create or get the singleton logger
const logger = createSecurityLogger();

// ============================================================================
// Example 2: Logging Events
// ============================================================================

// Log a failed signature verification
logSignatureFailure(
  logger,
  'partner.example.com',
  '203.0.113.42',
  'HMAC-SHA256 signature mismatch on webhook payload'
);

// Log a rate limit violation
logRateLimitViolation(
  logger,
  'partner.example.com',
  '203.0.113.42',
  'federation_api'
);

// Log abuse detection with severity based on score
logAbuseDetection(
  logger,
  'suspicious.feed.org',
  'spam_posting',
  0.87  // High score = error severity
);

// Log instance suspension
logInstanceSuspension(
  logger,
  'malicious.feed.net',
  'Repeated DMCA violations and user reports'
);

// Log admin override action
logAdminOverride(
  logger,
  'manual_unsuspend',
  'malicious.feed.net',
  'Legal review completed, suspension lifted'
);

// ============================================================================
// Example 3: Custom Event Logging
// ============================================================================

logger.log({
  type: 'unauthorized_access',
  severity: 'error',
  instanceId: 'partner.example.com',
  ipAddress: '198.51.100.23',
  userAgent: 'FEEDClient/1.0',
  endpoint: '/federation/api/v1/posts/sync',
  details: 'Attempted access to endpoint without valid authentication token',
  metadata: {
    requestId: 'req_abc123',
    userId: 'unknown',
  },
});

// ============================================================================
// Example 4: Querying Events
// ============================================================================

// Get all critical events
const criticalEvents = logger.query({
  severity: 'critical',
  limit: 20,
});

console.log(`Found ${criticalEvents.length} critical security events`);

// Get events for a specific instance
const instanceQuery: SecurityQuery = {
  instanceId: 'partner.example.com',
  startTime: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
  limit: 50,
};

const instanceEvents = logger.query(instanceQuery);
console.log(`Instance has ${instanceEvents.length} events in last 24h`);

// Get signature failures in the last hour
const recentFailures = logger.query({
  type: 'signature_failed',
  startTime: Date.now() - (60 * 60 * 1000),
});

console.log(`${recentFailures.length} signature failures in last hour`);

// ============================================================================
// Example 5: Statistics and Monitoring
// ============================================================================

// Get overall statistics
const stats = logger.getStats();

console.log('Security Event Statistics:');
console.log(`Total events: ${stats.total}`);
console.log(`Critical events (24h): ${stats.recentCritical}`);
console.log('By type:', stats.byType);
console.log('By severity:', stats.bySeverity);

// Get statistics for a specific time window
const hourlyStats = logger.getStats(60 * 60 * 1000); // Last hour
console.log(`Events in last hour: ${hourlyStats.total}`);

// ============================================================================
// Example 6: Admin Dashboard Queries
// ============================================================================

// Recent security events for admin dashboard
const recentEvents = logger.getRecentEvents(10);

recentEvents.forEach(event => {
  console.log(`[${event.severity.toUpperCase()}] ${event.type}`);
  console.log(`  Instance: ${event.instanceId || 'N/A'}`);
  console.log(`  IP: ${event.ipAddress || 'N/A'}`);
  console.log(`  Details: ${event.details}`);
  console.log(`  Time: ${new Date(event.timestamp).toISOString()}`);
  console.log('');
});

// ============================================================================
// Example 7: Instance-Specific Audit Trail
// ============================================================================

// Get complete audit trail for an instance
const auditTrail = logger.getEventsByInstance('partner.example.com', 100);

console.log(`Audit trail for partner.example.com: ${auditTrail.length} events`);

// Group by event type
const eventsByType = new Map<string, number>();
auditTrail.forEach(event => {
  eventsByType.set(event.type, (eventsByType.get(event.type) || 0) + 1);
});

console.log('Event breakdown:', Object.fromEntries(eventsByType));

// ============================================================================
// Example 8: Automated Maintenance
// ============================================================================

// Manually trigger expired event cleanup
const purgedCount = logger.purgeExpired();
console.log(`Purged ${purgedCount} expired events`);

// Note: Auto-purge runs every 100 log calls automatically

// ============================================================================
// Example 9: Pagination for Large Result Sets
// ============================================================================

function getPaginatedEvents(page: number, pageSize: number) {
  return logger.query({
    limit: pageSize,
    offset: page * pageSize,
  });
}

// Get page 1 (events 0-19)
const page1 = getPaginatedEvents(0, 20);

// Get page 2 (events 20-39)
const page2 = getPaginatedEvents(1, 20);

// ============================================================================
// Example 10: Integration with Federation Middleware
// ============================================================================

/**
 * Example middleware integration
 */
function federationSecurityMiddleware(req: any, res: any, next: any) {
  const instanceId = req.headers['x-feed-instance-id'];
  const signature = req.headers['x-feed-signature'];

  // Verify signature
  const isValid = verifySignature(req.body, signature);

  if (!isValid) {
    logSignatureFailure(
      logger,
      instanceId || 'unknown',
      req.ip,
      `Invalid signature on ${req.path}`
    );

    return res.status(401).json({
      error: 'Invalid signature',
      code: 'SIGNATURE_FAILED',
    });
  }

  next();
}

/**
 * Example rate limiter integration
 */
function checkRateLimit(instanceId: string, category: string): boolean {
  // Check rate limit logic here...
  const isRateLimited = false; // Placeholder

  if (isRateLimited) {
    logRateLimitViolation(
      logger,
      instanceId,
      '0.0.0.0', // Get from request
      category
    );
  }

  return isRateLimited;
}

/**
 * Example abuse detection integration
 */
function detectAbuse(instanceId: string, content: string): void {
  // Run abuse detection ML model...
  const abuseScore = 0.0; // Placeholder

  if (abuseScore > 0.5) {
    logAbuseDetection(
      logger,
      instanceId,
      'content_spam',
      abuseScore
    );
  }
}

// Dummy helper
function verifySignature(body: any, signature: string): boolean {
  return true;
}

// ============================================================================
// Example 11: Export for External Analysis
// ============================================================================

/**
 * Export events to JSON for external analysis tools
 */
function exportSecurityEvents(startTime: number, endTime: number) {
  const events = logger.query({
    startTime,
    endTime,
  });

  return JSON.stringify(events, null, 2);
}

// Export last 7 days
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const exportData = exportSecurityEvents(sevenDaysAgo, Date.now());

// Save to file or send to SIEM system
console.log(`Exported ${JSON.parse(exportData).length} events`);
