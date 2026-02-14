# FEED Federation Protocol - Production Launch Checklist

**Version:** 1.0.0
**Last Updated:** 2026-02-14
**Phase:** F6-T8 - Federation Production Launch
**Status:** Pre-Launch Validation

---

## 1. Pre-Launch Requirements

### Database & Schema
- [ ] All federation migrations applied to production
  - [ ] `20240115000000_create_federation_partners.sql`
  - [ ] `20240115000001_create_federation_resources.sql`
  - [ ] `20240115000002_create_federation_trust.sql`
  - [ ] `20240115000003_create_federation_cache.sql`
  - [ ] `20240115000004_create_federation_indexes.sql`
  - [ ] `20240115000005_create_federation_views.sql`
- [ ] Type generation completed (`packages/database/types.ts` updated)
- [ ] Materialized view `federation_trust_overview` populated with initial data
- [ ] RLS policies enabled on all federation tables
- [ ] Database connection pooling configured (min: 10, max: 100)

### Cryptographic Infrastructure
- [ ] Federation keypair generated using Ed25519 algorithm
- [ ] Private key secured in environment variable (not in git)
- [ ] Public key registered in database (`federation_partners.public_key`)
- [ ] HMAC-SHA256 signature verification tested end-to-end
- [ ] Key rotation procedure documented

### Environment Configuration
- [ ] All required environment variables set in production hosting provider
- [ ] Environment variables validated with test script
- [ ] Secrets properly injected (not hardcoded)
- [ ] NEXT_PUBLIC_* variables verified in client bundle
- [ ] Service role key access restricted to server-side only

### Performance & Capacity
- [ ] Rate limits configured and tested:
  - [ ] Partner registration: 10/hour per IP
  - [ ] Resource sync: 100/minute per partner
  - [ ] WebFinger discovery: 60/minute per IP
  - [ ] Search queries: 1000/hour per user
- [ ] Cache warming script executed for active partners
- [ ] Geographic search indexes verified (PostGIS functional)
- [ ] Load testing completed (see Performance Checklist section)

### Content Safety
- [ ] Content filtering active on all incoming resources
- [ ] Profanity filter enabled (bad-words library)
- [ ] Spam detection patterns configured
- [ ] Manual review queue operational
- [ ] Abuse reporting workflow tested

### Abuse Detection
- [ ] Trust scoring algorithm calibrated
- [ ] Automatic partner suspension thresholds set
- [ ] Alert webhooks configured for trust violations
- [ ] Admin dashboard displaying trust metrics
- [ ] Incident response procedure documented

---

## 2. Security Checklist

### Cryptographic Security
- [ ] HMAC-SHA256 signature verification operational on all endpoints
- [ ] Signatures validated before processing any incoming data
- [ ] Replay attack prevention (timestamp validation ±5 minutes)
- [ ] Nonce tracking to prevent duplicate requests
- [ ] Partner authentication required for all federation endpoints

### Network Security
- [ ] TLS/HTTPS enforced on all federation endpoints
- [ ] HSTS headers configured (max-age=31536000)
- [ ] SSL certificate valid and auto-renewing
- [ ] Cipher suites limited to TLS 1.2+ only
- [ ] Certificate pinning documented for mobile apps

### Access Control
- [ ] Rate limiting enforced on all federation endpoints:
  - [ ] `/api/federation/resources` - 100 req/min per partner
  - [ ] `/api/federation/webhook` - 1000 req/hour per partner
  - [ ] `/api/federation/search` - 500 req/hour per user
  - [ ] `/.well-known/webfinger` - 60 req/min per IP
- [ ] CORS properly configured (allow only trusted partner domains)
- [ ] Row-Level Security (RLS) enabled on all federation tables
- [ ] Service role key usage audited (no client-side exposure)

### Data Protection
- [ ] Content filter active on incoming resources (XSS, injection prevention)
- [ ] Input validation on all API endpoints (Zod schemas)
- [ ] SQL injection prevention (parameterized queries only)
- [ ] Sensitive data encrypted at rest (partner credentials, keys)
- [ ] PII handling compliant with privacy policies

### Secrets Management
- [ ] Private keys secured (not in git, not in client bundle)
- [ ] Environment variables not exposed in error messages
- [ ] API keys rotated and documented
- [ ] Webhook secrets unique per partner
- [ ] Service account credentials least-privilege access

### Audit & Logging
- [ ] Security audit log capturing all federation events:
  - [ ] Partner registration/suspension
  - [ ] Trust score changes
  - [ ] Content filtering violations
  - [ ] Failed authentication attempts
  - [ ] Rate limit violations
- [ ] Logs retained for 90 days minimum
- [ ] Log access restricted to authorized personnel
- [ ] Sensitive data redacted from logs (tokens, keys)

### Vulnerability Management
- [ ] Dependency scan completed (npm audit, Snyk)
- [ ] Known vulnerabilities patched
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Error messages sanitized (no stack traces in production)
- [ ] Penetration testing completed (or scheduled)

---

## 3. Performance Checklist

### Database Optimization
- [ ] All federation indexes created per migration file:
  - [ ] `idx_federation_resources_partner` (partner_id)
  - [ ] `idx_federation_resources_type` (resource_type)
  - [ ] `idx_federation_resources_location` (geography column, GiST)
  - [ ] `idx_federation_resources_synced` (last_synced_at)
  - [ ] `idx_federation_trust_partner` (partner_id, created_at DESC)
  - [ ] `idx_federation_cache_key` (cache_key, expires_at)
- [ ] Query execution plans analyzed (EXPLAIN ANALYZE on critical queries)
- [ ] Slow query log enabled and monitored
- [ ] Connection pooling active (Supabase Pooler enabled)
- [ ] Materialized view refresh scheduled (every 5 minutes)

### Caching Strategy
- [ ] Federation cache operational (`federation_cache` table)
- [ ] Cache hit rate > 70% for search queries
- [ ] Cache invalidation working on resource updates
- [ ] Cache TTL configured (search: 5min, resources: 1hr, partners: 24hr)
- [ ] Edge caching configured (Vercel Edge Network or equivalent)

### Query Performance Targets
- [ ] Search queries < 100ms (p95 latency)
  - Verified with: `SELECT * FROM federation_resources WHERE ... LIMIT 20`
- [ ] Geographic queries < 50ms (p95 latency)
  - Verified with: `SELECT * FROM federation_resources WHERE ST_DWithin(...)`
- [ ] Partner discovery < 200ms (p95 latency)
  - Verified with: `GET /.well-known/webfinger`
- [ ] Resource sync < 500ms per resource (p95 latency)
- [ ] Trust score calculation < 100ms per update

### Load Testing Results
- [ ] Load tested to 1000 concurrent users
- [ ] Sustained throughput: 10,000 requests/minute
- [ ] No database connection exhaustion under load
- [ ] No memory leaks detected (24-hour soak test)
- [ ] Error rate < 0.1% under normal load
- [ ] Auto-scaling triggers tested (CPU > 70%, memory > 80%)

### Resource Limits
- [ ] Edge Function timeout: 10 seconds (configured)
- [ ] Database query timeout: 5 seconds (configured)
- [ ] Request payload limit: 10MB (configured)
- [ ] WebSocket connection limit: 10,000 (verified)
- [ ] File upload size limit: 50MB (configured)

---

## 4. Federation Partners

### Partner Onboarding
- [ ] At least 2 production federation partners live
- [ ] Partner 1: _______________________ (name, URL)
- [ ] Partner 2: _______________________ (name, URL)
- [ ] Partner registration flow tested end-to-end
- [ ] Admin approval workflow operational
- [ ] Partner credentials securely delivered

### Discovery & Connectivity
- [ ] WebFinger discovery verified between all partner instances
  - Test: `GET https://partner.example.com/.well-known/webfinger?resource=acct:feed@partner.example.com`
- [ ] DNS records properly configured for federation
- [ ] Firewall rules allow partner-to-partner traffic
- [ ] mTLS optional (documented for future enhancement)

### Resource Synchronization
- [ ] Bidirectional resource sync confirmed:
  - [ ] Outbound: Local resources pushed to partners
  - [ ] Inbound: Partner resources pulled to local instance
- [ ] Initial sync completed for all partners (< 10,000 resources each)
- [ ] Incremental sync operational (webhooks triggered on updates)
- [ ] Conflict resolution tested (same resource on multiple partners)
- [ ] Deduplication working (same resource not stored twice)

### Webhook Infrastructure
- [ ] Webhook notifications flowing in both directions
- [ ] Webhook signatures validated (HMAC-SHA256)
- [ ] Retry logic tested (3 retries with exponential backoff)
- [ ] Dead letter queue configured for failed webhooks
- [ ] Webhook delivery rate > 99.5%

### Trust & Safety
- [ ] Trust scores calibrated for each partner (baseline established)
- [ ] Manual trust adjustment tested (admin override)
- [ ] Automatic suspension triggered on low trust score (< 30)
- [ ] Partner re-activation workflow tested
- [ ] Trust score transparency (partners can view their own score)

---

## 5. Monitoring & Observability

### Error Tracking
- [ ] Error alerting configured (Sentry, Rollbar, or equivalent)
- [ ] Alert channels configured (Slack, PagerDuty, email)
- [ ] Critical error escalation path defined
- [ ] Error rate baseline established (< 0.5% in staging)
- [ ] Source maps uploaded for client-side debugging

### Uptime Monitoring
- [ ] Uptime monitoring for federation endpoints:
  - [ ] `/.well-known/webfinger` (external ping every 1 minute)
  - [ ] `/api/federation/resources` (authenticated health check every 5 minutes)
  - [ ] `/api/federation/webhook` (synthetic transaction every 10 minutes)
- [ ] Uptime SLA target: 99.9% monthly
- [ ] Downtime alerts configured (> 1 minute outage)
- [ ] Status page configured (status.feedplatform.com or equivalent)

### Sync Health Dashboard
- [ ] Dashboard displaying per-partner sync metrics:
  - [ ] Last successful sync timestamp
  - [ ] Resources synced (total count)
  - [ ] Failed sync attempts (last 24 hours)
  - [ ] Sync latency (p50, p95, p99)
  - [ ] Pending webhook queue depth
- [ ] Alert on sync failure (> 5 consecutive failures)
- [ ] Alert on sync lag (> 1 hour behind)

### Trust Score Dashboard
- [ ] Dashboard displaying trust metrics:
  - [ ] Current trust score per partner
  - [ ] Trust score trend (7-day, 30-day)
  - [ ] Trust violations breakdown (spam, abuse, errors)
  - [ ] Suspended partners list
  - [ ] Manual adjustments history
- [ ] Alert on trust score drop (> 20 points in 24 hours)
- [ ] Alert on automatic suspension event

### Webhook Delivery Monitoring
- [ ] Webhook delivery success rate per partner (target: > 99%)
- [ ] Webhook retry queue depth (alert if > 100 pending)
- [ ] Webhook latency (p95 < 1 second)
- [ ] Failed webhook log with error details
- [ ] Dead letter queue size (alert if > 50 undeliverable)

### Performance Metrics
- [ ] Application Performance Monitoring (APM) configured (Vercel Analytics, New Relic, etc.)
- [ ] Metrics tracked:
  - [ ] API response times (p50, p95, p99)
  - [ ] Database query latency
  - [ ] Cache hit rate
  - [ ] Edge Function cold start rate
  - [ ] Client-side Core Web Vitals (LCP, FID, CLS)

---

## 6. Documentation

### Technical Documentation
- [ ] Federation Protocol specification complete:
  - Location: `/specs/001-feed-platform/federation-protocol.md`
  - Sections: Architecture, Authentication, Resource Schema, Trust System
- [ ] API documentation for partners:
  - Location: `/docs/api/federation.md`
  - Includes: Endpoint reference, authentication guide, example requests
- [ ] WebFinger implementation guide
- [ ] Webhook integration guide with code samples

### Operational Documentation
- [ ] Admin guide for partner management:
  - Location: `/docs/admin/federation-partners.md`
  - Covers: Adding partners, suspending partners, trust adjustments
- [ ] Troubleshooting runbook:
  - Location: `/docs/runbooks/federation-troubleshooting.md`
  - Scenarios: Sync failures, webhook issues, trust violations, performance degradation
- [ ] Incident response procedure:
  - Location: `/docs/runbooks/federation-incident-response.md`
  - Steps: Detection, triage, mitigation, resolution, post-mortem

### Developer Resources
- [ ] Code examples repository (GitHub)
- [ ] Postman/Insomnia collection for testing
- [ ] TypeScript SDK for partners (optional, future enhancement)
- [ ] Changelog maintained (`/docs/FEDERATION_CHANGELOG.md`)

### User-Facing Documentation
- [ ] Help center article: "What is FEED Federation?"
- [ ] FAQ: Federation privacy and data sharing
- [ ] Partner directory visible on public website

---

## 7. Rollback Plan

### Feature Flags
- [ ] Feature flag configured for federation (can disable without code deploy)
  - Flag name: `federation_enabled`
  - Control: LaunchDarkly, Vercel Edge Config, or environment variable
- [ ] Gradual rollout strategy:
  - [ ] 10% of users (beta testers)
  - [ ] 50% of users (staged rollout)
  - [ ] 100% of users (full launch)

### Partner Suspension
- [ ] Can suspend individual partners without affecting others
  - Method: Set `status = 'suspended'` in `federation_partners` table
- [ ] Suspended partner data retained (not deleted)
- [ ] Re-activation procedure tested
- [ ] Users notified when partner is suspended (via dashboard)

### Data Integrity
- [ ] Database rollback scripts ready:
  - Location: `/supabase/migrations/rollback/`
  - Scripts: Drop federation tables, restore pre-federation schema
- [ ] Backup created before launch (full database snapshot)
- [ ] Rollback tested in staging environment
- [ ] No data loss on rollback (federated resources marked as inactive)

### Emergency Procedures
- [ ] Kill switch documented (disable all federation instantly)
  - Method: Set `FEDERATION_ENABLED=false` in environment
  - Propagation time: < 1 minute (edge cache invalidation)
- [ ] Incident commander assigned (primary and backup)
- [ ] Communication templates prepared (status page, user notifications)
- [ ] Rollback decision criteria defined (error rate > 5%, trust violations > 50/hour)

---

## 8. Environment Variables Reference

### Production Environment Variables

| Variable | Description | Example | Required | Sensitive |
|----------|-------------|---------|----------|-----------|
| `FEDERATION_PRIVATE_KEY` | Ed25519 private key for signing federation requests | `base64-encoded-key-...` | Yes | **YES** |
| `FEDERATION_PUBLIC_KEY` | Ed25519 public key for signature verification | `base64-encoded-key-...` | Yes | No |
| `FEDERATION_INSTANCE_ID` | Unique identifier for this FEED instance | `feed-primary-001` | Yes | No |
| `FEDERATION_INSTANCE_URL` | Public URL of this instance | `https://feedplatform.com` | Yes | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-accessible) | `https://xyz.supabase.co` | Yes | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-accessible) | `eyJhbGciOiJIUzI1NiIs...` | Yes | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | `eyJhbGciOiJIUzI1NiIs...` | Yes | **YES** |
| `SUPABASE_DB_URL` | Direct database connection string | `postgresql://postgres:...` | Yes | **YES** |
| `FEDERATION_ENABLED` | Feature flag to enable/disable federation | `true` | No (default: false) | No |
| `FEDERATION_RATE_LIMIT_ENABLED` | Enable rate limiting on federation endpoints | `true` | No (default: true) | No |
| `FEDERATION_CACHE_TTL` | Cache TTL in seconds | `300` (5 minutes) | No (default: 300) | No |
| `FEDERATION_WEBHOOK_SECRET` | Secret for validating outbound webhooks | `random-secret-string` | Yes | **YES** |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI chat (if using federation) | `sk-or-v1-...` | No | **YES** |
| `SENTRY_DSN` | Sentry error tracking DSN | `https://...@sentry.io/...` | No | No |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for uploading source maps | `sntrys_...` | No | **YES** |
| `VERCEL_URL` | Auto-populated by Vercel (deployment URL) | `feed-xyz.vercel.app` | Auto | No |
| `NODE_ENV` | Node environment | `production` | Auto | No |

### Validation Script

Run before launch to verify all required variables are set:

```bash
#!/bin/bash
# Location: /scripts/validate-federation-env.sh

REQUIRED_VARS=(
  "FEDERATION_PRIVATE_KEY"
  "FEDERATION_PUBLIC_KEY"
  "FEDERATION_INSTANCE_ID"
  "FEDERATION_INSTANCE_URL"
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "FEDERATION_WEBHOOK_SECRET"
)

MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
  echo "✅ All required environment variables are set."
  exit 0
else
  echo "❌ Missing required environment variables:"
  printf '  - %s\n' "${MISSING_VARS[@]}"
  exit 1
fi
```

---

## 9. Launch Day Procedure

### T-24 Hours: Pre-Launch Preparation
1. **Create production database snapshot**
   ```bash
   npx supabase db dump -f backup-pre-federation-$(date +%Y%m%d).sql
   ```
2. **Deploy code to staging environment**
   - Verify build passes: `npm run build`
   - Verify type-check: `npm run type-check`
   - Run integration tests: `npm run test:e2e`
3. **Run final security scan**
   ```bash
   npm audit
   npx snyk test
   ```
4. **Notify stakeholders of launch window**
   - Email: engineering@feedplatform.com, ops@feedplatform.com
   - Slack: #feed-launches channel

### T-1 Hour: Final Checks
1. **Set environment variables in production hosting provider**
   - Vercel: Dashboard → Project Settings → Environment Variables
   - Validate with script: `bash scripts/validate-federation-env.sh`
2. **Enable monitoring alerts**
   - Sentry: Unmute federation project alerts
   - Uptime: Enable federation endpoint monitoring
3. **Verify partner readiness**
   - Contact Partner 1: Confirm ready to receive webhooks
   - Contact Partner 2: Confirm ready to receive webhooks
4. **Scale infrastructure (if manual)**
   - Database: Increase connection pool size to max
   - Edge Functions: Pre-warm instances (trigger test requests)

### T-0: Launch
1. **Deploy to production**
   ```bash
   git checkout main
   git pull origin main
   git tag v1.0.0-federation
   git push origin v1.0.0-federation
   # Vercel auto-deploys from main branch
   ```
2. **Apply database migrations** (if not auto-applied)
   ```bash
   npx supabase db push --linked
   ```
3. **Enable feature flag**
   - Set `FEDERATION_ENABLED=true` in Vercel environment variables
   - Redeploy to propagate change
4. **Trigger initial partner sync**
   - Admin dashboard → Federation → Partners → "Sync All"
   - Monitor sync progress in real-time dashboard

### T+15 Minutes: Smoke Testing
1. **Verify WebFinger discovery**
   ```bash
   curl "https://feedplatform.com/.well-known/webfinger?resource=acct:feed@feedplatform.com"
   # Expected: 200 OK with JRD response
   ```
2. **Verify resource sync**
   - Admin dashboard → Federation → Resources → Check count > 0
3. **Verify webhook delivery**
   - Admin dashboard → Federation → Webhooks → Check recent deliveries
4. **Check error rate**
   - Sentry → Last 15 minutes → Error count should be 0 or minimal

### T+1 Hour: Validation
1. **Verify all partners synced successfully**
   - Check sync health dashboard (all green)
2. **Verify trust scores initialized**
   - All partners should have trust score ≥ 70
3. **Verify search functionality**
   - Test federated search query in production UI
4. **Check performance metrics**
   - API latency p95 < 200ms
   - Database query latency p95 < 100ms

### T+4 Hours: Gradual Rollout (if using feature flag percentage)
1. **Increase rollout to 50% of users**
   - LaunchDarkly/Edge Config: Set `federation_enabled` to 50%
2. **Monitor error rate and performance**
   - Continue for 4 more hours before 100% rollout

### T+8 Hours: Full Rollout
1. **Enable federation for 100% of users**
   - Set `federation_enabled` to 100%
2. **Announce launch**
   - Blog post: "Introducing FEED Federation"
   - Social media: Twitter, LinkedIn
   - Email: User newsletter

---

## 10. Post-Launch Monitoring

### First 24 Hours: Critical Monitoring

#### Every 1 Hour (Hours 0-24)
- [ ] Check error rate (target: < 0.5%)
  - Sentry dashboard → Last 1 hour
- [ ] Check API response times (target: p95 < 200ms)
  - Vercel Analytics → Functions → Check `api/federation/*`
- [ ] Check database connection pool (target: < 80% utilization)
  - Supabase dashboard → Database → Connection Pooler
- [ ] Check partner sync status (target: all synced within last hour)
  - Admin dashboard → Federation → Sync Health
- [ ] Check webhook delivery rate (target: > 99%)
  - Admin dashboard → Federation → Webhooks → Delivery Rate

#### Every 4 Hours (Hours 0-24)
- [ ] Review security audit log
  - Check for suspicious activity (multiple failed auth, unusual traffic patterns)
- [ ] Review trust scores
  - Check for unexpected trust score drops (> 10 points)
- [ ] Review user feedback
  - Support tickets related to federation
  - Social media mentions
- [ ] Check disk usage (target: < 70%)
  - Database size growth rate
  - Log file accumulation

#### End of Day 1 (T+24 Hours)
- [ ] Generate launch report:
  - Total resources synced: _______
  - Total partners active: _______
  - Total searches executed: _______
  - Error rate: _______%
  - Average API latency: _______ms
  - Trust violations: _______
  - Incidents: _______
- [ ] Schedule post-launch retrospective (within 48 hours)

### First 48 Hours: Stabilization

#### Every 6 Hours (Hours 24-48)
- [ ] Check error rate trends (should be stable or decreasing)
- [ ] Check performance metrics (should be stable)
- [ ] Check partner satisfaction (reach out to Partner 1 and Partner 2)
- [ ] Review abuse reports (target: 0 valid reports)
- [ ] Check cache hit rate (target: > 70%)

#### End of Day 2 (T+48 Hours)
- [ ] Reduce monitoring frequency to every 12 hours
- [ ] Document any issues encountered and resolutions
- [ ] Update runbooks if new issues discovered

### First 72 Hours: Optimization

#### Every 12 Hours (Hours 48-72)
- [ ] Analyze query performance
  - Identify slow queries (> 500ms)
  - Add indexes if needed
- [ ] Review cache effectiveness
  - Adjust TTL values if hit rate < 70%
- [ ] Review rate limit effectiveness
  - Adjust limits if false positives detected
- [ ] Check for resource bottlenecks
  - CPU, memory, network utilization

#### End of Day 3 (T+72 Hours)
- [ ] Transition to standard monitoring (daily checks)
- [ ] Close launch incident channel (if created)
- [ ] Archive launch logs for future reference
- [ ] Update documentation based on lessons learned

### Week 1: Fine-Tuning
- [ ] Daily check of all monitoring dashboards
- [ ] Weekly partner sync review meeting
- [ ] Collect user feedback on federated features
- [ ] Identify optimization opportunities
- [ ] Plan Phase 2 enhancements based on data

---

## Sign-Off

### Pre-Launch Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | _______________ | _______________ | ________ |
| DevOps Lead | _______________ | _______________ | ________ |
| Security Lead | _______________ | _______________ | ________ |
| Product Manager | _______________ | _______________ | ________ |

### Launch Execution

| Milestone | Time | Status | Notes |
|-----------|------|--------|-------|
| Code deployed | ________ | ⬜ | ________________ |
| Migrations applied | ________ | ⬜ | ________________ |
| Feature flag enabled | ________ | ⬜ | ________________ |
| Partners synced | ________ | ⬜ | ________________ |
| Smoke tests passed | ________ | ⬜ | ________________ |
| Full rollout complete | ________ | ⬜ | ________________ |

---

## Appendix: Quick Reference

### Critical Endpoints
- WebFinger: `/.well-known/webfinger?resource=acct:feed@{domain}`
- Resource Sync: `/api/federation/resources`
- Webhook Receiver: `/api/federation/webhook`
- Partner Discovery: `/api/federation/partners`
- Health Check: `/api/health`

### Emergency Contacts
- On-Call Engineer: __________________
- DevOps Lead: __________________
- CTO: __________________
- Hosting Provider Support: __________________

### Rollback Command
```bash
# Emergency federation disable
vercel env rm FEDERATION_ENABLED production
vercel --prod
```

### Useful Queries
```sql
-- Check partner sync status
SELECT
  partner_id,
  instance_url,
  status,
  COUNT(fr.id) as synced_resources,
  MAX(fr.last_synced_at) as last_sync
FROM federation_partners fp
LEFT JOIN federation_resources fr ON fp.id = fr.partner_id
GROUP BY fp.id;

-- Check trust scores
SELECT * FROM federation_trust_overview ORDER BY current_trust_score ASC;

-- Recent errors
SELECT * FROM federation_audit_log
WHERE event_type = 'error'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

**End of Checklist**
**Version:** 1.0.0
**Next Review:** Post-launch retrospective
