# FEED Federation Protocol - Documentation Index

**Version**: 1.0
**Created**: 2026-02-05
**Status**: Design Complete - Ready for Community Review

---

## Overview

This directory contains the complete specification for the FEED Federation Protocol (FFP), which enables volunteer-hosted FEED instances to share resource directories while maintaining complete data sovereignty and privacy.

**Think**: "Mastodon for mutual aid resources" - decentralized, privacy-first, community-owned.

---

## Documentation Structure

### 📘 Core Specification
**File**: [`FEDERATION_PROTOCOL.md`](./FEDERATION_PROTOCOL.md)

The authoritative technical specification covering:
- Protocol overview and architecture
- Instance discovery mechanisms (WebFinger, DHT, manual)
- Federation handshake process
- Resource sharing API (query, search, sync)
- Trust model (web of trust, trust scores, reputation)
- Search federation (cross-instance queries, deduplication)
- Data consistency (eventual consistency, conflict resolution)
- Security model (HTTP signatures, authentication, attack prevention)
- 6-phase implementation roadmap (24 weeks)

**Who should read**: All team members, external contributors, instance admins

**Key sections**:
- Section 2: Instance Discovery (how instances find each other)
- Section 3: Federation Handshake (how to establish trust)
- Section 5: Trust Model (reputation and blocklists)
- Section 9: Implementation Roadmap (24-week plan)

---

### 🛠️ Implementation Guide
**File**: [`FEDERATION_IMPLEMENTATION_GUIDE.md`](./FEDERATION_IMPLEMENTATION_GUIDE.md)

Practical guide with code examples and setup instructions:
- Quick start (5-minute setup)
- Database schema (SQL migrations)
- Code examples (TypeScript/Next.js)
  - Key generation CLI
  - HTTP signature utilities
  - Federation client
  - Resource sync service
  - API routes
- Testing federation (Docker Compose setup)
- Deployment checklist
- Troubleshooting guide

**Who should read**: Engineers implementing federation

**Key sections**:
- Section 1: Quick Start (get running fast)
- Section 2: Database Setup (SQL migrations)
- Section 3: Code Examples (copy-paste ready)
- Section 4: Testing Federation (local testing)
- Section 5: Deployment Checklist (production launch)

---

### 📊 Architecture Summary
**File**: [`FEDERATION_ARCHITECTURE_SUMMARY.md`](./FEDERATION_ARCHITECTURE_SUMMARY.md)

Executive-level overview with decision rationale:
- TL;DR (problem, solution, timeline)
- Problem statement (current vs. desired state)
- Architecture overview (high-level design)
- Key design decisions (with trade-offs)
  - ActivityPub-inspired vs. custom
  - Pull vs. push sync
  - Strong vs. eventual consistency
  - Centralized registry vs. DHT
  - What to federate (and what not to)
- Security analysis (threat model, mitigations)
- Performance characteristics (latency, scaling)
- Risk assessment (probability, impact, mitigation)
- Success metrics (technical and business KPIs)

**Who should read**: Product managers, stakeholders, decision-makers

**Key sections**:
- TL;DR (read this first!)
- Section 4: Key Design Decisions (understand the "why")
- Section 6: Security Analysis (trust this system?)
- Section 8: Risk Assessment (can we pull this off?)
- Appendix F: FAQ (common questions)

---

### 🎨 Visual Diagrams
**File**: [`FEDERATION_DIAGRAMS.md`](./FEDERATION_DIAGRAMS.md)

Visual representations of architecture and flows:
- System architecture diagrams
- Sequence diagrams (handshake, sync, search, trust scoring)
- Data flow diagrams (resource lifecycle, trust propagation)
- State machines (instance states, sync states)
- Network topology (mesh vs. hub-and-spoke, geographic distribution)
- Component diagrams (HTTP signatures)
- UI mockups (search results, admin dashboard)

**Who should read**: Everyone (pictures worth 1000 words)

**Key sections**:
- Section 1.2: Federation Network Topology (see the mesh!)
- Section 2: Sequence Diagrams (understand the flows)
- Section 3.2: Trust Propagation (web of trust visual)
- Section 7: UI Mockups (what users see)

---

## Quick Navigation

### I want to...

**...understand the big picture**
→ Read: [`FEDERATION_ARCHITECTURE_SUMMARY.md`](./FEDERATION_ARCHITECTURE_SUMMARY.md) (TL;DR section)

**...see how it works visually**
→ Read: [`FEDERATION_DIAGRAMS.md`](./FEDERATION_DIAGRAMS.md) (all diagrams)

**...implement federation**
→ Read: [`FEDERATION_IMPLEMENTATION_GUIDE.md`](./FEDERATION_IMPLEMENTATION_GUIDE.md) (Quick Start)

**...understand the protocol details**
→ Read: [`FEDERATION_PROTOCOL.md`](./FEDERATION_PROTOCOL.md) (full spec)

**...evaluate security**
→ Read: [`FEDERATION_ARCHITECTURE_SUMMARY.md`](./FEDERATION_ARCHITECTURE_SUMMARY.md) (Security Analysis)

**...know if this is feasible**
→ Read: [`FEDERATION_ARCHITECTURE_SUMMARY.md`](./FEDERATION_ARCHITECTURE_SUMMARY.md) (Risk Assessment)

**...get started today**
→ Read: [`FEDERATION_IMPLEMENTATION_GUIDE.md`](./FEDERATION_IMPLEMENTATION_GUIDE.md) (Section 1)

---

## Key Concepts

### Federation
Multiple independent FEED instances sharing resources while maintaining data sovereignty.

### Instance
A single FEED deployment (e.g., "Oakland FEED" at oakland.feed.social).

### Trust Score
Numerical reputation (0.0-1.0) measuring instance reliability and data quality.

### Federated Resource
A resource (food bank, service) originating from another instance.

### HTTP Signatures
Cryptographic authentication mechanism (RSA-4096) for securing requests.

### Web of Trust
Decentralized reputation model where instances vouch for each other.

### Eventual Consistency
Data model where resources sync over time (15min interval), accepting temporary inconsistency for high availability.

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-4) ⭐ MVP
Database schema + manual federation + basic resource API

**Deliverable**: Two instances can share resources

### Phase 2: Authentication & Trust (Weeks 5-8)
HTTP signatures + federation handshake + trust scoring

**Deliverable**: Secure, authenticated federation

### Phase 3: Resource Sync (Weeks 9-12)
Automated pull-based sync + deduplication

**Deliverable**: Resources sync automatically

### Phase 4: Federated Search (Weeks 13-16)
Cross-instance search + result aggregation

**Deliverable**: Users search across federation

### Phase 5: Advanced Features (Weeks 17-20)
Web of trust + shared moderation + WebFinger

**Deliverable**: Self-regulating network

### Phase 6: Production Hardening (Weeks 21-24)
Security audit + monitoring + documentation

**Deliverable**: Production-ready federation

**Total Timeline**: 24 weeks (6 months)

---

## Technology Stack

### Core Technologies
- **Protocol**: ActivityPub-inspired (HTTP Signatures + JSON-LD)
- **Transport**: HTTPS with TLS 1.3
- **Authentication**: HTTP Signatures (RSA-4096)
- **Data Format**: JSON-LD (ActivityStreams 2.0)
- **Consistency**: Eventual consistency

### Implementation Technologies
- **Backend**: Next.js 14+ (TypeScript)
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Cache**: Redis (rate limiting + search cache)
- **Crypto**: Node.js crypto module (native)
- **Testing**: Vitest + Playwright

### Infrastructure
- **Deployment**: Vercel / Railway / Self-hosted
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston / Pino
- **CI/CD**: GitHub Actions

---

## Community Resources

### Getting Started
1. **Read**: [`FEDERATION_ARCHITECTURE_SUMMARY.md`](./FEDERATION_ARCHITECTURE_SUMMARY.md) (15 min)
2. **Review**: [`FEDERATION_DIAGRAMS.md`](./FEDERATION_DIAGRAMS.md) (10 min)
3. **Deep Dive**: [`FEDERATION_PROTOCOL.md`](./FEDERATION_PROTOCOL.md) (60 min)
4. **Implement**: [`FEDERATION_IMPLEMENTATION_GUIDE.md`](./FEDERATION_IMPLEMENTATION_GUIDE.md) (ongoing)

### Discussion Channels
- **GitHub**: [github.com/feed-platform/federation](https://github.com/feed-platform/federation) (issues, PRs)
- **Discord**: `#federation` channel (real-time chat)
- **Email**: federation@feed.social (private inquiries)

### Contributing
1. Read the specification documents
2. Join Discord #federation channel
3. Comment on GitHub issues
4. Submit feedback via GitHub Discussions

### Community Review Process
1. **Week 1**: Specification published for community review
2. **Week 2**: Gather feedback, hold community call
3. **Week 3**: Revise spec based on feedback
4. **Week 4**: Final approval from core team + pilot admins
5. **Week 5**: Begin Phase 1 implementation

---

## Frequently Asked Questions

### Q: Why not use ActivityPub directly?
**A**: ActivityPub is designed for social networks (follows, posts, likes). FEED needs resource directories (food banks, services). We borrow ActivityPub patterns (HTTP signatures, JSON-LD) but simplify for our use case.

### Q: Can users log in across instances?
**A**: Not in Phase 1. Users are local to each instance. May add cross-instance auth in Phase 2.

### Q: What if an instance goes offline?
**A**: Resources remain cached locally. After 24h, marked "stale". After 90 days, hidden from search. When back online, resources re-sync.

### Q: Does this share user data?
**A**: No. Only resources (food banks, services) federate. User accounts, form submissions, posts, and personal data NEVER leave the instance.

### Q: How do you prevent spam instances?
**A**: Trust score system + blocklists. New instances start with low trust (limited sharing). Trust increases with good behavior. Malicious instances are blocklisted.

### Q: Is this GDPR compliant?
**A**: Yes. Resources contain no personal data. Form submissions never federate. Each instance is its own data controller for its users.

---

## Success Criteria

### Technical Metrics (Phase 6 Exit)
- ✅ Federation uptime > 99%
- ✅ Sync success rate > 95%
- ✅ Search latency (p95) < 2 seconds
- ✅ Resource freshness < 5% stale
- ✅ Trust score accuracy > 90%

### Business Metrics (6 months post-launch)
- ✅ 10+ federated instances
- ✅ 30%+ searches include federated results
- ✅ 80%+ user satisfaction with federation
- ✅ 3x more resources via federation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-05 | Initial specification (all 4 documents) |

---

## License

This specification is licensed under **Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)**.

**You are free to**:
- Share: Copy and redistribute in any format
- Adapt: Remix, transform, build upon

**Under these terms**:
- Attribution: Credit FEED Platform Team
- ShareAlike: Distribute under same license

See [LICENSE](../LICENSE) for full text.

---

## Contact

- **Technical Questions**: Open GitHub issue
- **Security Concerns**: security@feed.social (GPG key available)
- **General Inquiries**: federation@feed.social

---

## Acknowledgments

This federation protocol design was inspired by research on existing decentralized systems:

### Core Protocols
- [ActivityPub](https://www.w3.org/TR/activitypub/) - W3C federated social networking standard
- [Mastodon](https://docs.joinmastodon.org/spec/activitypub/) - Practical ActivityPub implementation
- [WebFinger](https://datatracker.ietf.org/doc/html/rfc7033) - Web-based discovery protocol

### Distributed Systems
- [IPFS DHT](https://docs.ipfs.tech/concepts/dht/) - Distributed hash table for peer discovery
- [Kademlia](https://docs.libp2p.io/concepts/discovery-routing/kaddht/) - P2P routing protocol
- [CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) - Conflict-free replicated data types

### Trust & Security
- [PGP Web of Trust](https://wiki.p2pfoundation.net/Web_of_Trust) - Decentralized trust model
- [HTTP Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures) - Request authentication

### Search Federation
- [Elasticsearch Cross-Cluster](https://www.elastic.co/blog/tribe-nodes-and-cross-cluster-search-the-future-of-federated-search-in-elasticsearch) - Distributed search patterns
- [Federated Search (Wikipedia)](https://en.wikipedia.org/wiki/Federated_search) - Cross-system query aggregation

Special thanks to the Mastodon, ActivityPub, and open-source communities for pioneering decentralized social protocols.

---

## Next Steps

### For Reviewers (Week 1-2)
1. Read [`FEDERATION_ARCHITECTURE_SUMMARY.md`](./FEDERATION_ARCHITECTURE_SUMMARY.md)
2. Review [`FEDERATION_DIAGRAMS.md`](./FEDERATION_DIAGRAMS.md)
3. Provide feedback via GitHub Discussions
4. Attend community review call (TBD)

### For Implementers (Week 5+)
1. Clone repository
2. Follow [`FEDERATION_IMPLEMENTATION_GUIDE.md`](./FEDERATION_IMPLEMENTATION_GUIDE.md)
3. Set up local test environment
4. Join Discord #federation-dev channel

### For Instance Admins (Post-Launch)
1. Evaluate if federation is right for your instance
2. Read federation policy guidelines
3. Identify potential federation partners
4. Follow setup guide to enable federation

---

**Document Status**: ✅ Complete
**Community Review**: Starting 2026-02-05
**Target Implementation Start**: 2026-02-12

---

**End of Index**
