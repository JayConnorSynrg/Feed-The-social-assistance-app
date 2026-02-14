# FEED Federation Architecture - Executive Summary

**Version**: 1.0
**Date**: 2026-02-05
**Status**: Design Complete - Ready for Implementation

---

## TL;DR

The FEED Federation Protocol enables volunteer-hosted instances to share resource directories (food banks, housing services, etc.) while maintaining complete data sovereignty and privacy. Think "Mastodon for mutual aid resources" - decentralized, privacy-first, community-owned.

**Key Features**:
- ✅ Cross-instance resource discovery (Oakland users find Seattle food banks)
- ✅ Data sovereignty (no central authority, each instance controls its data)
- ✅ Opt-in federation (instances choose partners)
- ✅ Privacy-preserving (no user tracking across instances)
- ✅ Resilient (graceful degradation when instances offline)

**Timeline**: 20-24 weeks (6 phases)
**Complexity**: Moderate (builds on ActivityPub patterns)
**Risk**: Low (MVP starts simple, grows incrementally)

---

## Problem Statement

### Current State (Single Instance)

```
┌────────────────────────────────┐
│      Oakland FEED Instance     │
│                                │
│  - 127 local resources         │
│  - 500 users                   │
│  - Isolated                    │
└────────────────────────────────┘

Problem: Seattle user can't discover Oakland resources
```

### Desired State (Federated Network)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Oakland   │◄────►│   Seattle   │◄────►│  Portland   │
│  127 res.   │      │   98 res.   │      │  156 res.   │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                     │
       └────────────────────┴─────────────────────┘
                         │
                    Federated
                   Search Query
                         │
                         ▼
              "food banks near Seattle"
                         │
                         ▼
              381 results (deduplicated)
              From: Oakland, Seattle, Portland
```

**Value Proposition**: Users get 3x more resources, instances maintain independence.

---

## Architecture Overview

### High-Level Design

```
┌──────────────────────────────────────────────────────────┐
│                    FEED Instance                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Local DB   │    │ Federation   │    │  External │ │
│  │             │    │   Module     │    │ Instances │ │
│  │ • Resources │◄──►│              │◄──►│           │ │
│  │ • Users     │    │ • Sync       │    │ • Oakland │ │
│  │ • Posts     │    │ • Trust      │    │ • Portland│ │
│  └─────────────┘    │ • Search     │    │ • SF      │ │
│                     └──────────────┘    └───────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │             User Interface                       │  │
│  │  • Search (local + federated)                    │  │
│  │  • Map (combined markers)                        │  │
│  │  • "Federated" badges on external resources     │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow: Federated Search

```
User: "food banks near me"
         │
         ▼
┌──────────────────────┐
│  Search Controller   │
└──────────┬───────────┘
           │
           ├──► Local Search (fast, 0-100ms)
           │    └─► Returns 35 resources
           │
           └──► Federation Query (parallel, 100-2000ms)
                ├─► Oakland Instance (400ms)
                │   └─► Returns 12 resources
                │
                ├─► Portland Instance (350ms)
                │   └─► Returns 8 resources
                │
                └─► SF Instance (timeout after 2s)
                    └─► No results (offline)
                         │
                         ▼
                ┌─────────────────┐
                │ Result Merger   │
                │ • Deduplicate   │
                │ • Sort by dist. │
                │ • Add badges    │
                └────────┬────────┘
                         │
                         ▼
                  55 total results
                  (35 local + 20 federated)
```

### Trust Model

```
┌─────────────────────────────────────────────────┐
│           Trust Score Calculation               │
├─────────────────────────────────────────────────┤
│                                                 │
│  trust_score = weighted_average(                │
│    uptime_score          * 0.30  ───┐          │
│    data_quality_score    * 0.25  ───┤          │
│    moderation_score      * 0.20  ───┼──► 0.85  │
│    community_reports     * 0.15  ───┤          │
│    longevity_score       * 0.10  ───┘          │
│  )                                              │
│                                                 │
│  Trust Levels:                                  │
│  • 0.0-0.2: Untrusted (blocked)                │
│  • 0.2-0.4: Pending (limited sharing)          │
│  • 0.4-0.7: Trusted (full sharing)             │
│  • 0.7-0.9: Verified (prioritized)             │
│  • 0.9-1.0: Core (unlimited)                   │
└─────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### Decision 1: ActivityPub-Inspired vs. Custom Protocol

**Options Considered**:
1. Full ActivityPub implementation
2. Custom REST API
3. ActivityPub-inspired hybrid ✓ (chosen)

**Rationale**:
- ActivityPub is mature and proven (Mastodon, 15M+ users)
- Full ActivityPub is complex (designed for social networks, not resource directories)
- Hybrid approach: Borrow HTTP signatures, JSON-LD, Actor model; simplify for our use case

**Trade-offs**:
- ✅ Pro: Proven security model (HTTP signatures)
- ✅ Pro: Standard formats (JSON-LD, ActivityStreams)
- ❌ Con: Not fully compatible with Mastodon clients (acceptable - different use case)

### Decision 2: Pull vs. Push Sync

**Options Considered**:
1. Push-based (instances push updates via webhooks)
2. Pull-based (instances poll for updates) ✓ (MVP)
3. Hybrid (push for critical updates, pull for bulk)

**Rationale**:
- Pull is simpler (no webhook management, firewall-friendly)
- Resources change slowly (hours/days, not seconds)
- Can upgrade to push in Phase 2

**Trade-offs**:
- ✅ Pro: Simple to implement
- ✅ Pro: Works behind firewalls/NAT
- ❌ Con: 15-minute sync delay (acceptable for MVP)

### Decision 3: Strong vs. Eventual Consistency

**Options Considered**:
1. Strong consistency (distributed transactions)
2. Eventual consistency ✓ (chosen)

**Rationale**:
- Resources change slowly (not real-time trading system)
- Availability > consistency for mutual aid (CAP theorem)
- Strong consistency requires complex distributed coordination

**Trade-offs**:
- ✅ Pro: High availability (instances work independently)
- ✅ Pro: Simple implementation (no distributed locks)
- ❌ Con: Temporary inconsistency (resources may be stale for 15 minutes)

### Decision 4: Centralized Registry vs. DHT

**Options Considered**:
1. Centralized instance registry
2. DHT (Kademlia/IPFS) ✓ (Phase 2+)
3. Manual federation ✓ (MVP)

**Rationale**:
- Start simple: Manual federation (admin adds partners)
- DHT adds complexity (P2P networking, NAT traversal)
- Can upgrade to DHT in Phase 2 for automatic discovery

**Trade-offs**:
- ✅ Pro: Simple and secure (admin controls)
- ✅ Pro: No external dependencies
- ❌ Con: Manual setup required (acceptable for small networks)

### Decision 5: What to Federate

**Federated** ✅:
- Resources (food banks, housing, services)
- Instance metadata (trust scores, status)

**Not Federated** ❌:
- User accounts (local to instance)
- Form submissions (contains personal data)
- Posts/social feed (privacy)
- Documents (sensitive)

**Rationale**:
- Privacy-first: Personal data NEVER leaves instance
- GDPR/CCPA compliance: Each instance is own data controller
- Simplicity: Fewer data types = simpler protocol

---

## Security Analysis

### Threat Model

| Threat | Mitigation | Severity |
|--------|-----------|----------|
| **Impersonation Attack** | HTTP signatures (RSA-4096) | High → Low |
| **Data Poisoning** | Trust scores + moderation | Medium → Low |
| **DDoS Attack** | Rate limiting + circuit breakers | High → Medium |
| **Privacy Leak** | Never federate user data | High → None |
| **MITM Attack** | TLS 1.3 required | High → Low |
| **Spam/Malicious Content** | Blocklists + trust decay | Medium → Low |

### Authentication Flow

```
Oakland → Seattle Request
         │
         ▼
┌─────────────────────────┐
│ 1. Oakland signs        │
│    request with         │
│    private key          │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 2. Seattle fetches      │
│    Oakland's public key │
│    from metadata        │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ 3. Seattle verifies     │
│    signature            │
│    (crypto.verify)      │
└──────────┬──────────────┘
           │
           ├─► Valid? → Allow request
           │
           └─► Invalid? → Reject (401)
```

### Rate Limiting Strategy

```typescript
Rate Limits (per source instance):
- Health checks:     1 req/min
- Resource queries: 30 req/min
- Resource searches: 10 req/min
- Resource details: 60 req/min

Enforcement: Redis-backed token bucket
Overflow: 429 with Retry-After header
```

---

## Performance Characteristics

### Latency Breakdown

```
Federated Search: "food banks near Seattle"

Local search:           50-100ms   ████
Oakland query:         300-500ms   ████████████
Portland query:        250-400ms   ██████████
Deduplication:          20-50ms    ██
Sorting:                10-30ms    █
──────────────────────────────────────
Total (p95):          ~650-1100ms

Target: < 2 seconds (includes timeouts)
```

### Resource Requirements

**Per-Instance Overhead**:
- Database: +2 tables, ~500KB per 1000 federated resources
- Memory: +50MB (resource cache)
- CPU: +5% (sync jobs every 15 minutes)
- Network: ~10MB/day (resource sync traffic)

**Scaling**:
- Supports 50-100 federated instances per instance (MVP)
- Can handle 10,000+ federated resources
- Sync time: ~30 seconds per instance (200 resources)

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4) ⭐ MVP

**Scope**: Manual federation + basic resource sync

```
Tasks:
✓ Database schema (federated_instances, federated_resources)
✓ Keypair generation CLI
✓ Instance metadata endpoint
✓ Basic resource API (unauthenticated)
✓ Manual federation config (admin UI)

Deliverable: Two instances can share resources (manual setup)
```

### Phase 2: Authentication & Trust (Weeks 5-8)

**Scope**: Secure federation with trust scoring

```
Tasks:
✓ HTTP signature implementation
✓ Federation handshake protocol
✓ Trust score calculation
✓ Health checks + uptime monitoring
✓ Rate limiting

Deliverable: Secure, authenticated federation
```

### Phase 3: Resource Sync (Weeks 9-12)

**Scope**: Automated synchronization

```
Tasks:
✓ Pull-based sync (cron job every 15min)
✓ Deduplication algorithm
✓ Conflict resolution (Last Write Wins)
✓ Staleness detection

Deliverable: Resources sync automatically
```

### Phase 4: Federated Search (Weeks 13-16)

**Scope**: Cross-instance search

```
Tasks:
✓ Federated search API
✓ Result aggregation + deduplication
✓ Result streaming (local → federated)
✓ Search caching (15min TTL)
✓ UI integration ("Federated" badges)

Deliverable: Users search across federation
```

### Phase 5: Advanced Features (Weeks 17-20)

**Scope**: Web of trust, shared moderation

```
Tasks:
✓ Trust attestations
✓ Web of trust graph
✓ Shared blocklists
✓ WebFinger discovery
✓ DHT registry (optional)

Deliverable: Self-regulating federation network
```

### Phase 6: Production Hardening (Weeks 21-24)

**Scope**: Security audit, monitoring, docs

```
Tasks:
✓ Penetration testing
✓ Performance optimization (1000 req/s load test)
✓ API documentation (OpenAPI spec)
✓ Monitoring (Prometheus + Grafana)
✓ Compliance review (GDPR/CCPA)

Deliverable: Production-ready federation
```

---

## Comparison with Existing Protocols

### ActivityPub (Mastodon)

**Similarities**:
- HTTP signatures for auth
- JSON-LD for data format
- Actor model (instances as actors)
- Federated architecture

**Differences**:
- ActivityPub: User-centric (follows, posts, likes)
- FEED: Resource-centric (food banks, services)
- ActivityPub: Real-time social graph
- FEED: Slow-changing resource directory

### DHT (BitTorrent/IPFS)

**Similarities**:
- Decentralized discovery
- No central authority
- Peer-to-peer network

**Differences**:
- DHT: Fully distributed (no instances)
- FEED: Instance-based federation
- DHT: P2P networking required
- FEED: Works with standard HTTP

### Web of Trust (PGP)

**Similarities**:
- Trust attestations
- Decentralized reputation
- Transitive trust

**Differences**:
- PGP: User-level identity
- FEED: Instance-level trust
- PGP: Manual key signing
- FEED: Automated trust scoring

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low adoption | Medium | High | Start with 3-5 pilot instances, proven use case |
| Trust score gaming | Low | Medium | Multiple score components, admin oversight |
| Performance issues | Medium | Medium | Caching, timeouts, gradual rollout |
| Security vulnerabilities | Low | High | Security audit in Phase 6, HTTP signatures |
| Spam/abuse | Medium | Medium | Trust scores, blocklists, moderation tools |
| Complexity creep | High | Medium | Phased rollout, MVP-first approach |

**Overall Risk**: **Low-Medium** (manageable with phased approach)

---

## Success Metrics

### Technical Metrics

- **Federation Uptime**: > 99% (excluding planned maintenance)
- **Sync Success Rate**: > 95% (resource sync completes without errors)
- **Search Latency (p95)**: < 2 seconds (including federated queries)
- **Resource Freshness**: < 5% stale resources
- **Trust Score Accuracy**: > 90% agreement with admin judgments

### Business Metrics

- **Federated Instances**: 10+ instances in first 6 months
- **Cross-Instance Searches**: 30%+ of searches include federated results
- **User Satisfaction**: 80%+ users find federated search helpful
- **Resource Coverage**: 3x more resources via federation

---

## Open Questions for Discussion

### For Community Feedback

1. **Sync Interval**: Is 15 minutes acceptable, or do we need real-time updates?
   - *Recommendation*: 15min for MVP, push-based in Phase 2

2. **Trust Score Thresholds**: Are the trust levels (0.2/0.4/0.7/0.9) appropriate?
   - *Recommendation*: Start with proposed values, adjust based on data

3. **User Accounts**: Should users be able to log in across instances (like Mastodon)?
   - *Recommendation*: Not in Phase 1, consider in Phase 2 with OAuth

4. **Privacy**: Should we support private federations (invite-only networks)?
   - *Recommendation*: Yes, add "public" vs "private" federation mode

### For Technical Review

5. **Conflict Resolution**: Is Last Write Wins sufficient, or do we need CRDTs?
   - *Recommendation*: LWW for MVP, CRDTs if conflicts become frequent

6. **Key Rotation**: How often should federation keypairs rotate?
   - *Recommendation*: Every 12 months with 30-day overlap

7. **Monitoring**: What metrics should we expose via Prometheus?
   - *Recommendation*: See Success Metrics section, expose all via /metrics

---

## Next Steps

### Immediate Actions (Week 1)

1. **Community Review**: Share spec with FEED community for feedback
2. **Pilot Partners**: Identify 2-3 instances for pilot federation
3. **Security Review**: External security review of HTTP signature implementation
4. **Database Design**: Final review of migration files

### Phase 1 Kickoff (Week 2-4)

5. **Implement Database Schema**: Run migrations on dev instances
6. **Build Federation Module**: Core federation client + sync service
7. **Manual Federation**: Admin UI to add federation partners
8. **Test with Pilot**: Two-instance federation test (Seattle + Oakland)

### Long-Term Roadmap

- **Q2 2026**: Phase 1-2 complete (secure federation)
- **Q3 2026**: Phase 3-4 complete (automated sync + search)
- **Q4 2026**: Phase 5-6 complete (web of trust + production launch)
- **Q1 2027**: 10+ federated instances live

---

## Conclusion

The FEED Federation Protocol enables decentralized resource sharing while preserving the core values of mutual aid: community ownership, data sovereignty, and privacy. By adopting proven patterns from ActivityPub and distributed systems, we can build a resilient, scalable federation network that grows organically.

**Why This Will Succeed**:
1. **Proven Model**: ActivityPub powers 15M+ Mastodon users
2. **Simple MVP**: Manual federation reduces complexity
3. **Privacy-First**: No user data leaves instance (GDPR-compliant)
4. **Phased Rollout**: Low risk, incremental value
5. **Community Owned**: Instances decide who to federate with

**Key Takeaway**: Start simple (Phase 1), prove value, iterate based on feedback.

---

## Appendix: Quick Reference

### Key URLs

- Full specification: `FEDERATION_PROTOCOL.md`
- Implementation guide: `FEDERATION_IMPLEMENTATION_GUIDE.md`
- GitHub repo: `github.com/feed-platform/federation`
- Discussion: Discord #federation

### Essential Commands

```bash
# Generate keys
npm run federation:generate-keys

# Add federation partner
npm run federation:add-instance -- --domain oakland.feed.social

# Manual sync
npm run federation:sync

# Check status
npm run federation:status

# View logs
npm run federation:logs
```

### Key Endpoints

```
GET  /.well-known/feed-instance    # Instance discovery
GET  /api/federation/instance      # Instance metadata
POST /api/federation/handshake     # Federation handshake
GET  /api/federation/resources     # Resource query
POST /api/federation/resources/search  # Federated search
GET  /api/federation/health        # Health check
```

### Database Tables

```sql
federated_instances         # Federation partners
federated_resources         # Synced resources
federation_sync_log         # Sync history
trust_attestations          # Web of trust
federation_blocklist        # Blocked instances
federated_resource_conflicts  # Conflicts for review
```

---

**Document Status**: ✅ Complete
**Review Status**: Pending community feedback
**Approval Required**: Core team + 3 pilot instance admins
**Target Start Date**: 2026-02-12 (1 week after community review)

---

## Sources & References

This federation protocol design was informed by research on existing decentralized protocols:

### Core Protocols
- [ActivityPub W3C Recommendation](https://www.w3.org/TR/activitypub/) - Standard for federated social networks
- [Mastodon Federation Documentation](https://docs.joinmastodon.org/spec/activitypub/) - Practical ActivityPub implementation
- [WebFinger RFC 7033](https://datatracker.ietf.org/doc/html/rfc7033) - Web-based user discovery protocol

### Distributed Systems Research
- [Distributed Hash Tables (DHT)](https://docs.ipfs.tech/concepts/dht/) - IPFS documentation on peer discovery
- [Eventual Consistency in Distributed Systems](https://www.geeksforgeeks.org/system-design/eventual-consistency-in-distributive-systems-learn-system-design/) - Conflict resolution strategies
- [Kademlia DHT](https://docs.libp2p.io/concepts/discovery-routing/kaddht/) - P2P routing protocol

### Trust & Security
- [Web of Trust - P2P Foundation](https://wiki.p2pfoundation.net/Web_of_Trust) - Decentralized reputation systems
- [OpenPGP Web of Trust](https://sequoia-pgp.gitlab.io/sequoia-wot/) - Trust propagation models
- [HTTP Signatures Draft](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures) - Request authentication

### Search Federation
- [Federated Search - Wikipedia](https://en.wikipedia.org/wiki/Federated_search) - Cross-system query aggregation
- [Elastic Cross-Cluster Search](https://www.elastic.co/blog/tribe-nodes-and-cross-cluster-search-the-future-of-federated-search-in-elasticsearch) - Distributed search patterns

These sources provided architectural patterns, security models, and proven approaches for building decentralized systems while maintaining data sovereignty and user privacy.
