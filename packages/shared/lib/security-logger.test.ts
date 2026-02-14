/**
 * Security Logger Tests
 * Run with: npx tsx packages/shared/lib/security-logger.test.ts
 */

import {
  createSecurityLogger,
  resetSecurityLogger,
  logSignatureFailure,
  logRateLimitViolation,
  logAbuseDetection,
  logInstanceSuspension,
  logAdminOverride,
} from './security-logger';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runTests(): void {
  console.log('Running Security Logger Tests...\n');

  // Test 1: Basic logging
  resetSecurityLogger();
  const logger = createSecurityLogger();

  const event = logger.log({
    type: 'signature_failed',
    severity: 'error',
    instanceId: 'test-instance',
    ipAddress: '192.168.1.1',
    details: 'Invalid signature',
  });

  assert(event.id.startsWith('sec_'), 'Event ID has correct prefix');
  assert(event.timestamp > 0, 'Event has timestamp');
  assert(event.expiresAt > event.timestamp, 'Event has expiration');
  assert(logger.size() === 1, 'Logger has 1 event');

  // Test 2: Query filtering
  logger.log({
    type: 'rate_limited',
    severity: 'warning',
    instanceId: 'test-instance',
    ipAddress: '192.168.1.2',
    details: 'Rate limit exceeded',
  });

  logger.log({
    type: 'abuse_detected',
    severity: 'critical',
    instanceId: 'another-instance',
    ipAddress: '192.168.1.3',
    details: 'Spam detected',
  });

  const criticalEvents = logger.query({ severity: 'critical' });
  assert(criticalEvents.length === 1, 'Query finds critical events');
  assert(criticalEvents[0].type === 'abuse_detected', 'Critical event is abuse_detected');

  const instanceEvents = logger.query({ instanceId: 'test-instance' });
  assert(instanceEvents.length === 2, 'Query finds events by instance');

  // Test 3: Statistics
  const stats = logger.getStats();
  assert(stats.total === 3, 'Stats show total events');
  assert(stats.byType.signature_failed === 1, 'Stats count signature failures');
  assert(stats.byType.rate_limited === 1, 'Stats count rate limits');
  assert(stats.byType.abuse_detected === 1, 'Stats count abuse detections');
  assert(stats.bySeverity.error === 1, 'Stats count errors');
  assert(stats.bySeverity.warning === 1, 'Stats count warnings');
  assert(stats.bySeverity.critical === 1, 'Stats count critical');
  assert(stats.recentCritical === 1, 'Stats count recent critical events');

  // Test 4: Convenience methods
  resetSecurityLogger();
  const logger2 = createSecurityLogger();

  logSignatureFailure(logger2, 'inst1', '1.2.3.4', 'Bad signature');
  logRateLimitViolation(logger2, 'inst2', '1.2.3.5', 'api_calls');
  logAbuseDetection(logger2, 'inst3', 'spam', 0.95);
  logInstanceSuspension(logger2, 'inst4', 'Repeated violations');
  logAdminOverride(logger2, 'force_unsuspend', 'inst4', 'Manual review approved');

  assert(logger2.size() === 5, 'Convenience methods create events');

  const abuseEvents = logger2.query({ type: 'abuse_detected' });
  assert(abuseEvents.length === 1, 'Abuse event logged');
  assert(abuseEvents[0].severity === 'critical', 'High abuse score creates critical severity');
  assert(abuseEvents[0].metadata?.score === 0.95, 'Abuse score in metadata');

  // Test 5: Recent events
  const recent = logger2.getRecentEvents(3);
  assert(recent.length === 3, 'getRecentEvents limits results');
  assert(recent[0].timestamp >= recent[1].timestamp, 'Recent events sorted descending');

  // Test 6: Events by instance
  logger2.log({
    type: 'content_filtered',
    severity: 'info',
    instanceId: 'inst1',
    details: 'Content filtered',
  });

  const inst1Events = logger2.getEventsByInstance('inst1');
  assert(inst1Events.length === 2, 'getEventsByInstance returns all instance events');

  // Test 7: Pagination
  resetSecurityLogger();
  const logger3 = createSecurityLogger();

  for (let i = 0; i < 25; i++) {
    logger3.log({
      type: 'rate_limited',
      severity: 'warning',
      instanceId: `inst-${i}`,
      details: `Event ${i}`,
    });
  }

  const page1 = logger3.query({ limit: 10, offset: 0 });
  const page2 = logger3.query({ limit: 10, offset: 10 });
  const page3 = logger3.query({ limit: 10, offset: 20 });

  assert(page1.length === 10, 'First page has 10 results');
  assert(page2.length === 10, 'Second page has 10 results');
  assert(page3.length === 5, 'Third page has remaining 5 results');
  assert(page1[0].id !== page2[0].id, 'Pages have different events');

  // Test 8: Time window stats
  const windowStats = logger3.getStats(60000); // Last 60 seconds
  assert(windowStats.total === 25, 'Window stats include all recent events');

  // Test 9: Clear functionality
  logger3.clear();
  assert(logger3.size() === 0, 'Clear removes all events');

  console.log('\n✅ All tests passed!');
}

// Run tests
try {
  runTests();
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
