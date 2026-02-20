# US Privacy & Data Protection Law Compliance Report
## FEED Mutual Aid Resource Sharing Platform

**Date**: February 20, 2026
**Scope**: Federal and state laws applicable to a platform handling PII (names, SSN, DOB, financial data, health information, immigration status, government IDs) for government benefits applications (SNAP, Medicaid, housing assistance, etc.)

---

## Table of Contents

1. [Federal Requirements Summary](#1-federal-requirements-summary)
2. [Comprehensive State Privacy Laws (20 States)](#2-comprehensive-state-privacy-laws-20-states)
3. [State-by-State Breach Notification Matrix (All 50 States)](#3-state-by-state-breach-notification-matrix)
4. [State-Specific Security Mandates](#4-state-specific-security-mandates)
5. [Strictest Requirements Analysis](#5-strictest-requirements-analysis)
6. [Encryption Safe Harbor Analysis](#6-encryption-safe-harbor-analysis)
7. [Key Questions Answered](#7-key-questions-answered)
8. [Compliance Recommendations for FEED](#8-compliance-recommendations-for-feed)

---

## 1. Federal Requirements Summary

### 1.1 HIPAA (Health Insurance Portability and Accountability Act)

**Applicability to FEED: LIKELY NOT DIRECTLY APPLICABLE, BUT WARRANTS CAUTION**

HIPAA applies to "covered entities" (healthcare providers, health plans, healthcare clearinghouses) and their "business associates." FEED is not a healthcare provider and does not bill for healthcare services.

**Key analysis:**
- Government-funded programs whose principal purpose is NOT providing or paying the cost of healthcare (e.g., food stamps/SNAP) are explicitly excluded from HIPAA's "health plan" definition.
- FEED assists users in applying for government benefits, including Medicaid. This assistance role does NOT make FEED a covered entity.
- **However**: If FEED stores health information that users provide (e.g., disability status, medical conditions for Medicaid applications), FEED should treat this data with HIPAA-equivalent protections as a best practice, even if not legally required.
- If FEED ever partners with or processes data on behalf of a covered entity (e.g., a healthcare organization), FEED would become a Business Associate and HIPAA would fully apply.

**Recommendation**: Implement HIPAA-grade protections for any health-related data as a defensive measure, even though FEED is likely not a covered entity.

Sources: [HHS HIPAA Overview](https://www.hhs.gov/hipaa/index.html), [Nonprofit HIPAA Compliance](https://www.wagenmakerlaw.com/blog/some-not-all-nonprofits-are-subject-to-hipaa-requirements)

---

### 1.2 COPPA (Children's Online Privacy Protection Act)

**Applicability to FEED: APPLICABLE IF CHILDREN UNDER 13 USE THE PLATFORM**

COPPA applies to operators of commercial websites and online services (including mobile apps) directed at children under 13 or that knowingly collect personal information from children under 13.

**Key requirements (2025 amendments, effective June 23, 2025; compliance deadline April 22, 2026):**
- **Expanded PI definition**: Now includes persistent identifiers (device IDs, IP addresses), biometric data, geolocation, and behavioral/inferred data
- **Parental consent**: Required before collecting, using, or disclosing children's personal information; separate consent required for third-party disclosures vs. primary functions
- **Data minimization**: Collect only what is reasonably necessary
- **Data retention**: Delete data when no longer necessary; provide clear retention policies
- **Security**: Heightened data security obligations
- **Penalties**: Up to $53,088 per violation (2025 amount)

**FEED-specific analysis**: FEED is likely a "general audience" or "mixed audience" service. If families with children under 13 use the platform (e.g., parents applying for children's benefits), FEED should implement age-gating or ensure children under 13 do not directly create accounts or provide personal information.

Sources: [FTC COPPA Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa), [COPPA Compliance 2025](https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/), [2025 COPPA Amendments](https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule)

---

### 1.3 FTC Act Section 5 (Unfair or Deceptive Practices)

**Applicability to FEED: ALWAYS APPLICABLE**

Section 5 of the FTC Act prohibits "unfair or deceptive acts or practices in or affecting commerce." This is a catch-all federal authority that applies to ALL businesses handling consumer data, regardless of industry.

**Key requirements:**
- **Privacy promises**: Any representations made in a privacy policy must be honored. Failure to follow stated practices = deceptive practice.
- **Data security**: Failure to implement reasonable security measures for sensitive data = unfair practice.
- **Data minimization**: Collecting more data than necessary or retaining it longer than needed can be deemed unfair.
- **Consent**: Sharing data in ways not disclosed to consumers = deceptive practice.

**2025-2026 enforcement trends:**
- FTC remains active on privacy enforcement, focusing on misleading representations
- Heavy focus on youth privacy and online safety
- Evaluating "informational injury" as a harm theory
- Expected expansion into data broker restrictions

**FEED-specific**: Given FEED handles extremely sensitive PII (SSN, immigration status, health data), FTC scrutiny risk is elevated. Privacy policy must be accurate, specific, and followed precisely.

Sources: [FTC Privacy Enforcement](https://www.ftc.gov/news-events/topics/protecting-consumer-privacy-security/privacy-security-enforcement), [2025 FTC Enforcement Recap](https://perkinscoie.com/insights/blog/privacy-law-recap-2025-ftc-enforcement)

---

### 1.4 Gramm-Leach-Bliley Act (GLBA)

**Applicability to FEED: LIKELY NOT APPLICABLE**

GLBA applies to "financial institutions" -- entities that offer consumers financial products or services such as loans, financial advice, or insurance. The FTC's Privacy Rule covers non-bank financial institutions (payday lenders, mortgage brokers, debt collectors, etc.).

**FEED-specific analysis**: FEED does not provide financial products or services. It helps people access government benefits. However, FEED collects financial information (income, assets) as part of benefits applications.

**Key consideration**: If FEED ever provides financial counseling, loan referrals, or financial product recommendations, GLBA could apply.

**If applicable, GLBA would require:**
- Privacy notices with opt-out rights for third-party sharing
- Written information security program (Safeguards Rule)
- Designated qualified individual overseeing security
- Risk assessments and penetration testing
- Encryption for customer data
- Access controls

Sources: [FTC GLBA Overview](https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act), [GLBA Compliance Guide](https://iapp.org/resources/article/guide-to-the-gramm-leach-bliley-act)

---

### 1.5 42 CFR Part 2 (Substance Use Disorder Records)

**Applicability to FEED: APPLICABLE IF FEED HANDLES SUD TREATMENT RECORDS**

42 CFR Part 2 protects the confidentiality of substance use disorder (SUD) patient records. A major final rule was published February 8, 2024, with a compliance deadline of February 16, 2026.

**Key 2026 changes:**
- Aligned with HIPAA rules and HITECH Act
- Single patient consent can now authorize future disclosures for treatment, payment, and healthcare operations
- Privacy notices must conform to HIPAA's Notice of Privacy Practices
- OCR has enforcement authority (same process as HIPAA enforcement)
- Penalties: $141 to $2.1 million per violation (aligned with HIPAA)

**FEED-specific analysis**: If users disclose substance use disorder treatment information in benefits applications (e.g., for Medicaid or disability benefits), FEED should be aware of Part 2 requirements. FEED is unlikely to be a "Part 2 program" but should implement protections for any SUD-related data users share.

Sources: [42 CFR Part 2 Final Rule](https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html), [Part 2 Compliance Deadline](https://www.hipaajournal.com/february-16-2026-compliance-deadline-part-2-final-rule/)

---

## 2. Comprehensive State Privacy Laws (20 States)

As of February 2026, **20 states** have enacted comprehensive consumer data privacy laws. Below is a detailed analysis of each.

### 2.1 California -- CCPA/CPRA

| Attribute | Detail |
|-----------|--------|
| **Law** | California Consumer Privacy Act (CCPA) as amended by California Privacy Rights Act (CPRA) |
| **Effective** | CCPA: Jan 1, 2020; CPRA amendments: Jan 1, 2023 |
| **Thresholds** | Annual gross revenue >$25M; OR buy/sell/share PI of 100,000+ consumers/households; OR derive 50%+ revenue from selling/sharing PI |
| **Consumer Rights** | Access, delete, correct, portability, opt-out of sale/sharing, limit use of sensitive PI, non-discrimination |
| **Sensitive Data** | SSN, financial info, precise geolocation, race/ethnicity, health data, biometric data, sexual orientation, immigration/citizenship status |
| **Security** | Implement "reasonable security procedures and practices" |
| **DPA Required** | Risk assessments required (regulations effective 2026; certification required by 2028) |
| **Breach Notification** | 30 days (as of SB 446, signed Sept 2025) |
| **Penalties** | $2,663/unintentional violation; $7,988/intentional or minor-related violation (2025 adjusted amounts) |
| **Private Right of Action** | YES -- for data breaches involving unencrypted/unredacted PI due to failure to implement reasonable security; statutory damages $107-$799/consumer/incident |
| **Cure Period** | None (eliminated by CPRA; discretionary by CPPA) |
| **AG Notification** | Required |
| **Notable** | Only state with meaningful private right of action for data breaches; mandatory cybersecurity audits for certain businesses starting 2026 |

Sources: [CPPA 2025 Penalties](https://cppa.ca.gov/announcements/2024/20241217.html), [CCPA/CPRA Fines](https://www.clym.io/blog/ccpa-penalties-and-fines-what-businesses-need-to-know)

---

### 2.2 Virginia -- VCDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Virginia Consumer Data Protection Act |
| **Effective** | January 1, 2023 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND derive 50%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Racial/ethnic origin, religious beliefs, health diagnosis, sexual orientation, citizenship/immigration status, genetic/biometric data, children's data, precise geolocation |
| **Security** | Establish, implement, and maintain reasonable administrative, technical, and physical data security practices |
| **DPA Required** | Yes -- for targeted advertising, sale, profiling, sensitive data processing |
| **Breach Notification** | "Without unreasonable delay" (no specific timeline in comprehensive law; separate breach notification statute applies) |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (mandatory, does not sunset) |
| **Enforcer** | Attorney General exclusively |

---

### 2.3 Colorado -- CPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Colorado Privacy Act |
| **Effective** | July 1, 2023 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND derive revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Racial/ethnic origin, religious beliefs, health data, sexual orientation, citizenship/immigration status, genetic/biometric data |
| **Security** | Reasonable data security practices appropriate to data volume/nature |
| **DPA Required** | Yes -- for high-risk processing activities |
| **Breach Notification** | 30 days |
| **Penalties** | Up to $20,000 per violation; maximum $500,000 per incident |
| **Private Right of Action** | No |
| **Cure Period** | 60 days (sunsetted January 1, 2025) |
| **Enforcer** | Attorney General and District Attorneys |
| **Notable** | Among strictest penalty caps; cure period has expired |

---

### 2.4 Connecticut -- CTDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Connecticut Data Privacy Act |
| **Effective** | July 1, 2023; amended provisions effective July 1, 2026 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND derive 25%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Racial/ethnic origin, religious beliefs, health data, sexual orientation, citizenship/immigration status, genetic/biometric data, children's data |
| **Security** | Reasonable data security practices |
| **DPA Required** | Yes |
| **Breach Notification** | 60 days |
| **Penalties** | Up to $5,000 per violation; maximum $500,000 per incident |
| **Private Right of Action** | No |
| **Cure Period** | 60 days (sunsetted January 1, 2025) |
| **Enforcer** | Attorney General |

---

### 2.5 Utah -- UCPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Utah Consumer Privacy Act |
| **Effective** | December 31, 2023; amendments July 1, 2026 |
| **Thresholds** | Annual revenue $25M+; AND control/process PI of 100,000+ consumers; OR 25,000+ consumers AND 50%+ revenue from selling PI |
| **Consumer Rights** | Access, delete, portability, opt-out of targeted advertising/sale |
| **Sensitive Data** | Racial/ethnic origin, religious beliefs, health data, sexual orientation, citizenship/immigration status, genetic/biometric data |
| **Security** | Reasonable data security practices |
| **DPA Required** | No |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (mandatory, does not sunset) |
| **Enforcer** | Attorney General |
| **Notable** | Most business-friendly; highest threshold (requires $25M revenue AND data volume); no right to correct; no DPA required; children's data encryption requirements added (2026) |

---

### 2.6 Iowa -- ICDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Iowa Consumer Data Protection Act |
| **Effective** | January 1, 2025 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND 50%+ revenue from selling PI |
| **Consumer Rights** | Access, delete, portability, opt-out of targeted advertising/sale |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 90 days (does not sunset -- most generous) |
| **Enforcer** | Attorney General |

---

### 2.7 Indiana -- ICDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Indiana Consumer Data Protection Act |
| **Effective** | January 1, 2026 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND 50%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **DPA Required** | Yes |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (does not sunset) |
| **Enforcer** | Attorney General |

---

### 2.8 Tennessee -- TIPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Tennessee Information Protection Act |
| **Effective** | July 1, 2025 |
| **Thresholds** | Revenue $25M+; AND process PI of 175,000+ consumers; OR 25,000+ consumers AND 50%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **DPA Required** | Yes |
| **Penalties** | Up to $7,500 per violation; triple damages for intentional breaches |
| **Private Right of Action** | No |
| **Cure Period** | 60 days (does not sunset) |
| **Enforcer** | Attorney General |
| **Notable** | Triple damages for intentional violations; high threshold (175,000 consumers + $25M revenue) |

---

### 2.9 Montana -- MCDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Montana Consumer Data Privacy Act |
| **Effective** | October 1, 2024 |
| **Thresholds** | Process/control PI of 50,000+ consumers; OR 25,000+ consumers AND 25%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **DPA Required** | Yes |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | Removed (no cure period) |
| **Enforcer** | Attorney General |
| **Notable** | Lower threshold (50,000) reflecting smaller state population; cure period removed |

---

### 2.10 Texas -- TDPSA

| Attribute | Detail |
|-----------|--------|
| **Law** | Texas Data Privacy and Security Act |
| **Effective** | July 1, 2024 |
| **Thresholds** | Conducts business in TX or produces products/services for TX residents; NOT a small business (<500 employees per SBA definition) |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Includes citizenship/immigration status |
| **DPA Required** | Yes |
| **Breach Notification** | 30 days (to AG if 250+ TX residents affected); 60 days to consumers |
| **Penalties** | Up to $7,500 per violation; up to $25,000 for violations involving deceptive trade practices |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (does not sunset) |
| **Enforcer** | Attorney General (Texas AG has been aggressive in enforcement) |
| **Notable** | No revenue/data volume threshold -- applies broadly to non-small businesses; AG already filing enforcement actions |

---

### 2.11 Oregon -- OCPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Oregon Consumer Privacy Act |
| **Effective** | July 1, 2024 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND 25%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling, list of third-party data recipients |
| **DPA Required** | Yes |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (expires January 1, 2026 -- likely already expired) |
| **Enforcer** | Attorney General |
| **Notable** | Applies to nonprofits (unlike most state laws); right to list of third-party recipients is unique; cure period sunsets |

---

### 2.12 Delaware -- DPDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Delaware Personal Data Privacy Act |
| **Effective** | January 1, 2025 |
| **Thresholds** | Control/process PI of 35,000+ consumers; OR 10,000+ consumers AND 20%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Includes national origin, transgender/non-binary status |
| **DPA Required** | Yes |
| **Penalties** | Up to $10,000 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 60 days (sunsets December 31, 2025) |
| **Enforcer** | Attorney General |
| **Notable** | Low threshold (35,000 consumers); expanded sensitive data categories |

---

### 2.13 New Hampshire -- NHDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | New Hampshire Data Privacy Act |
| **Effective** | January 1, 2025 |
| **Thresholds** | Control/process PI of 35,000+ consumers; OR 10,000+ consumers AND 25%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Penalties** | Up to $10,000 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 60 days (does not sunset) |
| **Enforcer** | Attorney General |

---

### 2.14 New Jersey -- NJDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | New Jersey Data Privacy Act |
| **Effective** | January 15, 2025 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND derive revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Includes national origin, transgender/non-binary status, financial account information |
| **DPA Required** | Yes |
| **Penalties** | Up to $10,000 first violation; $20,000 subsequent violations (under NJ Consumer Fraud Act) |
| **Private Right of Action** | No (under comprehensive privacy law; NJ Consumer Fraud Act has separate private right of action) |
| **Cure Period** | 30 days (sunsets July 1, 2026) |
| **Enforcer** | Attorney General |
| **Notable** | Nonprofits are NOT exempt; broadened sensitive data categories; NJ Consumer Fraud Act linkage increases penalty risk |

---

### 2.15 Nebraska -- NDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Nebraska Data Privacy Act |
| **Effective** | January 1, 2025 |
| **Thresholds** | No minimum threshold -- applies to all entities conducting business in NE or offering products/services to NE residents |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **DPA Required** | Yes |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (does not sunset) |
| **Enforcer** | Attorney General |
| **Notable** | NO THRESHOLD -- broadest applicability of any state; applies to all businesses regardless of size or data volume |

---

### 2.16 Minnesota -- MCDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Minnesota Consumer Data Privacy Act |
| **Effective** | July 31, 2025 |
| **Thresholds** | Process PI of 100,000+ consumers; OR 25,000+ consumers AND 25%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling, **right to question profiling decisions** |
| **Sensitive Data** | Standard categories plus heightened protections |
| **DPA Required** | Yes -- for targeted advertising, sensitive data, sale, profiling, high-risk processing |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days |
| **Enforcer** | Attorney General |
| **Notable** | UNIQUE profiling rights: consumers can question automated decisions affecting jobs, housing, education, insurance, essential services; must designate chief privacy officer or equivalent; non-discrimination provision |

---

### 2.17 Maryland -- MODPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Maryland Online Data Privacy Act |
| **Effective** | October 1, 2025 (applies to processing activities after April 1, 2026) |
| **Thresholds** | Control/process PI of 35,000+ consumers; OR 10,000+ consumers AND revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **Sensitive Data** | Biometric, genetic, health, precise geolocation, children's data, national origin, transgender/non-binary status |
| **Data Minimization** | **STRICTEST in US**: Collection limited to what is "reasonably necessary and proportionate" to provide the specific service requested; sensitive data may only be processed when "strictly necessary" |
| **Sale of Sensitive Data** | **PROHIBITED outright** (not merely opt-out) |
| **Minors** | Bans selling/using PI of individuals under 18 for targeted advertising |
| **Penalties** | $1,000 first violation; $5,000 subsequent violations |
| **Private Right of Action** | No |
| **Cure Period** | Available at AG discretion |
| **Enforcer** | Attorney General |
| **Notable** | STRICTEST data minimization requirements in the US; outright ban on sensitive data sales; stricter than GDPR in some respects |

---

### 2.18 Kentucky -- KCDPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Kentucky Consumer Data Protection Act |
| **Effective** | January 1, 2026 |
| **Thresholds** | Control/process PI of 100,000+ consumers; OR 25,000+ consumers AND 50%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **DPA Required** | Yes -- including for profiling with risk of discriminatory impact |
| **Penalties** | Up to $7,500 per violation |
| **Private Right of Action** | No |
| **Cure Period** | 30 days (does not sunset) |
| **Enforcer** | Attorney General |

---

### 2.19 Rhode Island -- RIDTPPA

| Attribute | Detail |
|-----------|--------|
| **Law** | Rhode Island Data Transparency and Privacy Protection Act |
| **Effective** | January 1, 2026 |
| **Thresholds** | Control/process PI of 35,000+ consumers; OR 10,000+ consumers AND 20%+ revenue from selling PI |
| **Consumer Rights** | Access, correct, delete, portability, opt-out of targeted advertising/sale/profiling |
| **DPA Required** | Yes |
| **Penalties** | Subject to state UDAP statutes |
| **Private Right of Action** | No |
| **Cure Period** | No cure period (one of only a few states) |
| **Enforcer** | Attorney General |
| **Notable** | NO cure period; low threshold (35,000 consumers) |

---

### 2.20 Summary: Comprehensive State Privacy Law Comparison Matrix

| State | Effective | Threshold (Consumers) | Revenue Threshold | Penalty/Violation | Cure Period | DPA Required | PRA |
|-------|-----------|----------------------|-------------------|-------------------|-------------|-------------|-----|
| **CA** | 2020/2023 | 100K or $25M rev | $25M or 50% sale | $2,663-$7,988 | None | Yes (2026+) | YES |
| **VA** | 2023 | 100K or 25K+sale | 50% from sale | $7,500 | 30 days | Yes | No |
| **CO** | 2023 | 100K or 25K+sale | Revenue from sale | $20,000 (max $500K) | Expired | Yes | No |
| **CT** | 2023 | 100K or 25K+sale | 25% from sale | $5,000 (max $500K) | Expired | Yes | No |
| **UT** | 2023 | 100K or 25K+sale | $25M + 50% sale | $7,500 | 30 days | No | No |
| **MT** | 2024 | 50K or 25K+sale | 25% from sale | $7,500 | Removed | Yes | No |
| **TX** | 2024 | Non-SBA small biz | None | $7,500-$25,000 | 30 days | Yes | No |
| **OR** | 2024 | 100K or 25K+sale | 25% from sale | $7,500 | Expired | Yes | No |
| **DE** | 2025 | 35K or 10K+sale | 20% from sale | $10,000 | Expired | Yes | No |
| **IA** | 2025 | 100K or 25K+sale | 50% from sale | $7,500 | 90 days | No | No |
| **NE** | 2025 | **None** | None | $7,500 | 30 days | Yes | No |
| **NH** | 2025 | 35K or 10K+sale | 25% from sale | $10,000 | 60 days | No | No |
| **NJ** | 2025 | 100K or 25K+sale | Revenue from sale | $10,000-$20,000 | 30 days (sunsets) | Yes | No |
| **TN** | 2025 | 175K or 25K+sale | $25M + 50% sale | $7,500 (3x intent) | 60 days | Yes | No |
| **MN** | 2025 | 100K or 25K+sale | 25% from sale | $7,500 | 30 days | Yes | No |
| **MD** | 2025/2026 | 35K or 10K+sale | Revenue from sale | $1,000-$5,000 | AG discretion | Yes | No |
| **IN** | 2026 | 100K or 25K+sale | 50% from sale | $7,500 | 30 days | Yes | No |
| **KY** | 2026 | 100K or 25K+sale | 50% from sale | $7,500 | 30 days | Yes | No |
| **RI** | 2026 | 35K or 10K+sale | 20% from sale | UDAP penalties | **None** | Yes | No |

---

## 3. State-by-State Breach Notification Matrix

All 50 states plus DC, Guam, Puerto Rico, and the US Virgin Islands have data breach notification laws.

### 3.1 Notification Timeline by State

**30-Day States (Strictest):**
| State | Timeline | AG Notice Required | Notes |
|-------|----------|-------------------|-------|
| California | 30 days (SB 446, 2025) | Yes | Recently tightened from "expedient" |
| Colorado | 30 days | Yes (if 500+ residents) | |
| Florida | 30 days | Yes (if 500+ residents) | |
| Maine | 30 days | Yes | |
| New York | 30 days | Yes | Amended 2025 |
| Washington | 30 days | Yes (if 500+ residents) | |

**45-Day States:**
| State | Timeline | AG Notice Required |
|-------|----------|-------------------|
| Alabama | 45 days | Yes |
| Arizona | 45 days | Yes |
| Indiana | 45 days | Yes |
| New Mexico | 45 days | Yes |
| Ohio | 45 days | Yes |
| Oregon | 45 days | Yes |
| Rhode Island | 45 days | Yes |
| Tennessee | 45 days | Yes |
| Vermont | 45 days | Yes |
| Wisconsin | 45 days | No |

**60-Day States:**
| State | Timeline | AG Notice Required |
|-------|----------|-------------------|
| Connecticut | 60 days | Yes |
| Delaware | 60 days | Yes |
| Louisiana | 60 days | Yes |
| Oklahoma | 60 days (as of Jan 2026) | Yes (if 500+) |
| South Dakota | 60 days | Yes |
| Texas | 60 days (consumers); 30 days (AG) | Yes |

**"Without Unreasonable Delay" States (No Specific Timeline):**

The remaining ~31 states use qualitative language. This includes: Alaska, Arkansas, Georgia, Hawaii, Idaho, Illinois, Iowa, Kansas, Kentucky, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, North Carolina, North Dakota, Pennsylvania, South Carolina, Utah, Virginia, West Virginia, Wyoming, and DC.

**Important**: "Without unreasonable delay" is typically interpreted as 30-60 days by courts and regulators, but some states have found 90+ day delays to be reasonable under certain circumstances.

### 3.2 What Constitutes "Personal Information" (Breach Trigger)

**Standard definition (most states):**
First name/initial + last name combined with:
- Social Security Number
- Driver's license / state ID number
- Financial account number + access code/PIN/password

**Expanded definitions (growing number of states):**
Many states have expanded to also include:
- Health/medical information (IL, OR, RI, and others)
- Biometric data (IL, TX, WA, and others)
- Email/username + password (CA, FL, and others)
- Tax ID numbers
- Health insurance information
- Passport numbers
- Individual taxpayer identification numbers

### 3.3 AG Notification Thresholds

| Threshold | States |
|-----------|--------|
| Always required | Most states with AG notification |
| 250+ residents | Texas |
| 500+ residents | California, Colorado, Florida, Washington, Oklahoma |
| 1,000+ residents | Some states |

---

## 4. State-Specific Security Mandates

### 4.1 New York SHIELD Act (2019)

**Applicability**: Any person or business that owns or licenses computerized data including private information of a New York resident.

**Requirements**:
- Implement and maintain "reasonable safeguards" to protect security, confidentiality, and integrity of private information
- Designate employee(s) to coordinate security program
- Identify reasonably foreseeable internal and external risks
- Assess sufficiency of existing safeguards
- Train employees in security program practices
- Select service providers capable of maintaining appropriate safeguards
- Adjust security program in light of business changes or new circumstances

**Small business exception**: Small businesses (fewer than 50 employees, less than $3M gross revenue in each of 3 preceding years, less than $5M in year-end total assets) have a reduced standard -- security program "appropriate for the size and complexity of the small business."

**Penalties**: Violations enforced under NY General Business Law; AG can seek injunctive relief and civil penalties.

**Breach notification**: 30 days (as of 2025 amendment).

---

### 4.2 Massachusetts 201 CMR 17.00

**Applicability**: ANY person who owns or licenses personal information about a Massachusetts resident, regardless of where the business is located.

**SPECIFIC TECHNICAL REQUIREMENTS** (among the most prescriptive in the US):
- **Encryption of ALL transmitted records** containing PI that travel across public networks
- **Encryption of ALL data transmitted wirelessly** containing PI
- **Encryption of ALL PI stored on laptops or portable devices**
- Reasonably up-to-date firewall protection for systems connected to the Internet
- Operating system security patches reasonably applied
- Up-to-date antivirus/malware protection
- Education and training of employees on security program
- Regular monitoring to ensure security program operates effectively
- Written, comprehensive information security program (WISP) required

**Penalties**: Violations enforced under MA consumer protection statute; AG can seek $5,000 per violation. Private right of action exists under state consumer protection law for security breaches.

**Notable**: Massachusetts is one of the ONLY states that mandates specific encryption requirements (not just "reasonable security") AND provides a private right of action for security breaches.

Sources: [MA 201 CMR 17.00](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-residents-of-the-commonwealth), [201 CMR 17.04 Computer Security](https://www.law.cornell.edu/regulations/massachusetts/201-CMR-17-04)

---

### 4.3 Illinois BIPA (Biometric Information Privacy Act)

**Applicability**: Any private entity that collects, captures, purchases, receives through trade, or otherwise obtains biometric identifiers or biometric information.

**Biometric identifiers**: Retina/iris scans, fingerprints, voiceprints, scans of hand/face geometry.

**Requirements**:
- Written policy establishing retention schedule and destruction guidelines
- Informed written consent before collection
- Cannot sell, lease, trade, or otherwise profit from biometric data
- Must store, transmit, and protect using "reasonable standard of care" and at least the same level as other confidential/sensitive information

**Penalties**:
- $1,000 per negligent violation
- $5,000 per intentional/reckless violation
- Plus reasonable attorney fees and costs
- **FULL PRIVATE RIGHT OF ACTION** (consumers can sue directly)

**2024 Amendment**: Redefines repeated collection/transmission of same biometric data by same party as a SINGLE violation (reducing exposure significantly).

**FEED-specific**: Unless FEED implements biometric authentication (fingerprint, face ID for login), BIPA is unlikely to apply. If biometric auth is added, BIPA compliance is critical.

Sources: [BIPA Overview](https://en.wikipedia.org/wiki/Biometric_Information_Privacy_Act), [2024 BIPA Amendment](https://www.gtlaw.com/en/insights/2024/8/bipa-update-illinois-limits-liability-and-clarifies-electronic-consent-for-biometric-data-collection)

---

### 4.4 Other Notable State Security Mandates

| State | Law/Regulation | Key Requirement |
|-------|---------------|-----------------|
| **Connecticut** | 2025 child data amendments | Encrypt minors' data "at all times during processing" |
| **Utah** | 2026 UCPA amendments | Encrypt children's data at all times during processing |
| **North Dakota** | HB 1127 | Financial entities must implement "continuous encryption measures" |
| **Nevada** | NRS 603A | Requires encryption of PI transmitted outside business's secure system |
| **New Mexico** | HB 15 (2025) | Strengthens agency privacy protections for SSN, national origin |

---

## 5. Strictest Requirements Analysis

### 5.1 Strictest Data Minimization

**Winner: Maryland (MODPA)**
- Collection must be "reasonably necessary and proportionate" to the specific service requested
- Sensitive data processing allowed only when "strictly necessary"
- Outright BAN on sale of sensitive data (not merely opt-out)
- This exceeds even GDPR's standard in some respects

### 5.2 Strictest Breach Notification Timeline

**Winner: Tied -- California, Colorado, Florida, Maine, New York, Washington (30 days)**
- No state currently requires faster than 30 days for consumer notification
- Federal CIRCIA requires 24-hour reporting of ransomware payments (critical infrastructure only)
- AG notification can be even faster in some states (e.g., Texas requires AG notification within 30 days but gives 60 days for consumer notification)

### 5.3 Strictest Penalties

| Category | Winner | Amount |
|----------|--------|--------|
| Highest per-violation (comprehensive law) | Colorado | $20,000/violation, $500,000 max |
| Highest per-violation (consumer fraud linkage) | New Jersey | $10,000 first, $20,000 subsequent |
| Highest penalty (with private right of action) | California | $2,663-$7,988/violation + $107-$799/consumer statutory damages |
| Highest biometric penalty | Illinois (BIPA) | $5,000/intentional violation + private right of action |
| Most aggressive enforcement | California, Texas | Active AG enforcement; CA CPPA filing hundreds of investigations |

### 5.4 Broadest Applicability

| Category | Winner | Details |
|----------|--------|---------|
| Lowest threshold | Nebraska | NO threshold -- applies to ALL businesses |
| Broadest by business type | Texas | Applies to all non-SBA-small businesses (500+ employees) |
| Applies to nonprofits | Oregon, New Jersey | Most states exempt nonprofits; OR and NJ do NOT |
| Lowest consumer threshold | Delaware, New Hampshire, Rhode Island | 35,000 consumers |

### 5.5 Most Consumer-Friendly

| Category | Winner | Details |
|----------|--------|---------|
| Private right of action (data breach) | California | Statutory damages $107-$799/consumer |
| Private right of action (biometrics) | Illinois | $1,000-$5,000/violation |
| Private right of action (security breach) | Massachusetts | $100-$750/consumer + actual damages |
| No cure period | CA, CO (expired), CT (expired), MT, OR (expired), RI | Immediate enforcement without grace period |
| Strongest profiling rights | Minnesota | Right to question automated decisions on essential services |

---

## 6. Encryption Safe Harbor Analysis

### 6.1 How Encryption Safe Harbors Work

Most state breach notification laws define a "breach" as unauthorized acquisition of **unencrypted** computerized data containing personal information. If data is properly encrypted at the time of the breach, notification is typically NOT required.

### 6.2 Key Requirements for Safe Harbor

1. **Encryption must be in place at the time of the breach** -- encrypting after the fact does not help
2. **Encryption keys must NOT be compromised** -- if the encryption key is also accessed/stolen, the safe harbor is lost
3. **Encryption must meet recognized standards** -- while most states do not specify algorithms, "recognized" typically means AES-128 or AES-256

### 6.3 State-by-State Encryption Safe Harbor Status

| Category | States | Notes |
|----------|--------|-------|
| **Strong safe harbor** (encrypted data excluded from breach definition) | Majority of states (~40+) | Breach = unauthorized access to "unencrypted" data |
| **Safe harbor with key caveat** | Oklahoma (2026), and others | Encrypted data triggers notification if encryption keys are ALSO compromised |
| **No explicit safe harbor** | A small minority | Must notify regardless of encryption status |

### 6.4 Client-Side / Zero-Knowledge Encryption Benefits

**Legal advantages of FEED's client-side encryption architecture:**

1. **Maximizes safe harbor protection**: If FEED never holds encryption keys (zero-knowledge), then even a server-side breach cannot result in key compromise. The safe harbor applies in virtually all states.

2. **Reduces breach scope**: Even if FEED's database is compromised, encrypted data is not "personal information" under most breach notification statutes because it cannot be read without the key.

3. **Demonstrates "reasonable security"**: Client-side encryption exceeds the "reasonable security" standard required by virtually all state laws and the FTC.

4. **Limits FTC exposure**: Zero-knowledge architecture means FEED cannot access user data even if compelled, reducing the risk of "unfair practice" claims.

5. **Minimizes penalty exposure**: Smaller breach scope = fewer affected individuals = lower total penalties.

6. **Supports data minimization**: If FEED cannot read the data, it strengthens the argument that FEED minimizes its use of personal information.

**Critical caveat**: The encryption keys must be managed on the CLIENT side and NEVER transmitted to or stored on FEED's servers in unencrypted form. If FEED holds a copy of the key, the safe harbor benefit is significantly reduced.

---

## 7. Key Questions Answered

### Q1: Which states have the STRICTEST requirements?

**Top 5 strictest states for a platform like FEED:**

1. **California** -- Private right of action, no cure period, active enforcement, mandatory cybersecurity audits (2026+), 30-day breach notification
2. **Maryland** -- Strictest data minimization in the US, outright ban on sensitive data sales, low threshold
3. **Colorado** -- $20,000/violation penalty, $500K max, no cure period, 30-day breach notification
4. **New Jersey** -- $20,000 subsequent violations, nonprofits not exempt, broad sensitive data definition
5. **Minnesota** -- Unique profiling rights, strong DPA requirements, CPO designation required

### Q2: What is the strictest breach notification timeline?

**30 days** -- shared by California, Colorado, Florida, Maine, New York, and Washington. No state requires faster for general consumer notification. For AG notification, Texas requires 30 days (but gives 60 for consumers).

### Q3: Do any states REQUIRE specific encryption standards?

**No state mandates a specific algorithm (e.g., AES-256) in its comprehensive privacy law.** However:
- **Massachusetts 201 CMR 17**: Mandates encryption of PI in transit and on portable devices (no algorithm specified, but must be "reasonable")
- **Connecticut & Utah**: Require encryption of children's data "at all times during processing" (2025-2026 amendments)
- **Iowa**: State enterprise standards specify AES-256 for state agency data transfers
- **Federal (HIPAA proposed 2025)**: Proposed mandatory AES-256 for ePHI at rest and TLS 1.3 in transit (if finalized, this sets the de facto standard)

**Best practice**: Use AES-256 for data at rest, TLS 1.3 for data in transit. This exceeds all current state requirements.

### Q4: Do any states require specific key management practices?

**No state law specifies key management procedures.** However:
- **Oklahoma's 2026 breach law** explicitly addresses key compromise -- if encryption keys are accessed alongside encrypted data, the safe harbor is lost
- **Massachusetts 201 CMR 17** implicitly requires proper key management since it mandates encryption effectiveness
- **Federal GLBA Safeguards Rule** (if applicable) requires key management via HSMs or equivalent
- **HIPAA (proposed 2025)**: Would require HSMs or equivalent for key lifecycle management

**Best practice**: Implement client-side key generation with keys never transmitted to server; use PBKDF2 or Argon2 for key derivation; implement key rotation policies.

### Q5: Which states grant a private right of action?

| State | Scope | Damages |
|-------|-------|---------|
| **California (CCPA/CPRA)** | Data breaches from unreasonable security | $107-$799/consumer/incident statutory; actual damages |
| **Illinois (BIPA)** | Biometric data violations | $1,000 negligent; $5,000 intentional/reckless |
| **Massachusetts** | Security breach under consumer protection law | $100-$750/consumer + actual damages |

All other comprehensive state privacy laws rely on AG enforcement only. No private right of action for general privacy violations.

### Q6: Does zero-knowledge/client-side encryption provide legal benefits?

**YES, significantly.** See Section 6.4 above. Summary:
- Triggers encryption safe harbors in ~40+ states
- Demonstrates "reasonable security" under all state laws and FTC Act
- Reduces breach notification obligations
- Minimizes penalty exposure
- Supports data minimization compliance (especially for Maryland MODPA)
- Reduces FTC enforcement risk

### Q7: What are the maximum penalties per state?

| State | Max Penalty/Violation | Total Cap | Private Action |
|-------|----------------------|-----------|----------------|
| California | $7,988 | None | $799/consumer |
| Colorado | $20,000 | $500,000 | No |
| Connecticut | $5,000 | $500,000 | No |
| Delaware | $10,000 | None stated | No |
| New Hampshire | $10,000 | None stated | No |
| New Jersey | $20,000 (subsequent) | None stated | No |
| Texas | $25,000 (deceptive) | None stated | No |
| Illinois BIPA | $5,000 (intentional) | None (per violation) | $5,000/violation |
| All others | $7,500 | None stated | No |

---

## 8. Compliance Recommendations for FEED

### 8.1 Immediate Actions (Critical)

1. **Implement a comprehensive privacy policy** that accurately describes data collection, use, sharing, and retention practices. This is required by all 20 comprehensive state laws and the FTC Act.

2. **Implement consent mechanisms for sensitive data** -- FEED collects SSN, health data, financial data, and immigration status. All 20 comprehensive state laws require opt-in consent for sensitive data processing.

3. **Implement "reasonable security"** -- This is the universal baseline. At minimum:
   - AES-256 encryption at rest
   - TLS 1.3 in transit
   - Access controls (role-based)
   - Audit logging
   - Regular security assessments

4. **Maintain client-side/zero-knowledge encryption for SSN, health data, financial data, and immigration status** -- This triggers encryption safe harbors in virtually all states and demonstrates "reasonable security" under all laws.

5. **Implement 30-day breach notification capability** -- Design incident response procedures to detect, investigate, and notify within 30 days (the strictest state deadline).

### 8.2 Architectural Recommendations

6. **Never store encryption keys server-side** -- Zero-knowledge architecture ensures FEED cannot be compelled to decrypt data and maximizes safe harbor protections.

7. **Implement data minimization** -- Collect only what is needed for the specific service requested. This is legally required by Maryland and a best practice under all state laws.

8. **Build consumer rights infrastructure**:
   - Data access/export (all 20 states)
   - Data deletion (all 20 states)
   - Data correction (18 states)
   - Opt-out of sale (all 20 states)
   - Opt-out of targeted advertising (18 states)
   - Opt-out of profiling (16 states)

9. **Conduct Data Protection Assessments** -- Required by 15+ states for processing sensitive data. Document the assessment before launching features that handle sensitive PI.

10. **Implement age verification/gating** -- Prevent children under 13 from creating accounts or providing PI directly (COPPA compliance). Consider MODPA's under-18 protections.

### 8.3 Operational Recommendations

11. **Designate a privacy officer** -- Required by Minnesota; best practice under all state laws.

12. **Maintain a Written Information Security Program (WISP)** -- Required by Massachusetts 201 CMR 17; best practice everywhere.

13. **Train all personnel** on data handling, security, and privacy practices -- Required by Massachusetts, New York SHIELD Act; best practice everywhere.

14. **Maintain breach notification templates** for all 50 states -- Different states have different requirements for notification content, timing, and recipients.

15. **Monitor nonprofit exemptions** -- Most state laws exempt nonprofits, but Oregon and New Jersey do NOT. If FEED operates as a nonprofit, confirm exemption status in each state.

### 8.4 Priority Compliance by State Risk

**Tier 1 -- Highest Risk (comply immediately):**
- California (private right of action, active enforcement)
- Texas (broadest applicability, aggressive AG)
- New Jersey (nonprofits not exempt, high penalties)
- Massachusetts (specific encryption mandates, private right of action)

**Tier 2 -- High Risk (comply within 6 months):**
- Colorado (high penalties, no cure period)
- Maryland (strictest data minimization)
- New York (SHIELD Act, 30-day breach notification)
- Illinois (if biometric auth is used)
- Minnesota (profiling rights, CPO required)

**Tier 3 -- Standard Risk (comply within 12 months):**
- All other comprehensive state privacy laws
- Remaining state breach notification laws

---

## Appendix A: Data Types Handled by FEED and Applicable Laws

| Data Type | Federal Law | State Laws (Selected) |
|-----------|-------------|----------------------|
| **Name, Email, Phone** | FTC Act | All 50 state breach notification laws |
| **Social Security Number** | FTC Act | All 50 states (core PI definition); NM heightened protection |
| **Date of Birth** | FTC Act, COPPA (if <13) | All states with expanded PI definitions |
| **Financial Information** | FTC Act, possibly GLBA | All 20 comprehensive state laws (sensitive data) |
| **Health/Medical Information** | Possibly HIPAA (see analysis) | All 20 comprehensive state laws (sensitive data); IL, OR, RI breach laws |
| **Immigration Status** | FTC Act | CA, VA, CO, CT, TX, and others (sensitive data category); NM, IL heightened protections |
| **Government ID Numbers** | FTC Act | All 50 state breach notification laws |
| **Biometric Data** | FTC Act | IL BIPA; TX, WA biometric laws; all 20 comprehensive state laws |
| **Children's Data** | COPPA | CT, UT (mandatory encryption); CA, MD (enhanced protections) |
| **Substance Abuse Records** | 42 CFR Part 2 | State-specific confidentiality laws |

---

## Appendix B: Research Sources

### Federal
- [HHS HIPAA Overview](https://www.hhs.gov/hipaa/index.html)
- [FTC COPPA Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
- [COPPA 2025 Amendments](https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule)
- [FTC Privacy Enforcement](https://www.ftc.gov/news-events/topics/protecting-consumer-privacy-security/privacy-security-enforcement)
- [FTC GLBA Overview](https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act)
- [42 CFR Part 2 Final Rule](https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html)

### State Privacy Laws
- [IAPP US State Privacy Legislation Tracker](https://iapp.org/resources/article/us-state-privacy-legislation-tracker)
- [Bloomberg Law State Privacy Tracker](https://pro.bloomberglaw.com/insights/privacy/state-privacy-legislation-tracker/)
- [MultiState: Comprehensive Privacy Laws 2026](https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026)
- [White & Case: 2025 State Privacy Laws](https://www.whitecase.com/insight-alert/2025-state-privacy-laws-what-businesses-need-know-compliance)
- [IAPP: New Rules for 2026](https://iapp.org/news/a/new-year-new-rules-us-state-privacy-requirements-coming-online-as-2026-begins)
- [CPPA 2025 Penalty Increases](https://cppa.ca.gov/announcements/2024/20241217.html)

### Breach Notification
- [IAPP US State Data Breach Notification Chart](https://iapp.org/resources/article/state-data-breach-notification-chart)
- [NCSL Security Breach Notification Laws](https://www.ncsl.org/technology-and-communication/security-breach-notification-laws)
- [Perkins Coie Breach Notification Chart](https://perkinscoie.com/insights/publication/security-breach-notification-chart)
- [Privacy Rights Clearinghouse: 50-State Survey 2026](https://privacyrights.org/resources-tools/reports/data-breach-notification-laws-50-state-survey-2026-edition)
- [Foley & Lardner State Breach Notification Laws](https://www.foley.com/insights/publications/2025/10/state-data-breach-notification-laws/)

### State-Specific Security
- [MA 201 CMR 17.00](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-residents-of-the-commonwealth)
- [NY SHIELD Act Overview](https://www.alstonprivacy.com/colorado-enacts-expanded-data-privacy-law/)
- [Illinois BIPA](https://en.wikipedia.org/wiki/Biometric_Information_Privacy_Act)
- [Maryland MODPA](https://www.osano.com/articles/maryland-online-data-privacy-act-modpa)

### Encryption & Zero-Knowledge
- [Zero-Knowledge Encryption Guide 2025](https://www.hivenet.com/post/zero-knowledge-encryption-the-ultimate-guide-to-unbreakable-data-security)
- [Zero-Knowledge Compliance 2026](https://securityboulevard.com/2026/01/zero-knowledge-compliance-how-privacy-preserving-verification-is-transforming-regulatory-technology/)

---

*This report is for informational purposes only and does not constitute legal advice. FEED should consult with qualified legal counsel licensed in applicable jurisdictions for binding compliance guidance.*
