# FEED Platform - End-to-End Test Demo Plan

## Overview

This document outlines a comprehensive end-to-end test plan for demonstrating and validating all FEED platform features across all user roles and AI interaction scenarios.

**Test Duration**: ~2-3 hours for complete walkthrough
**Required Setup**: Local Supabase running, dev server running, test accounts

---

## Test Environment Setup

### Prerequisites

```bash
# Start local Supabase
cd /Users/jelalconnor/CODING/CURSOR/FEED.
npx supabase start

# Start web dev server
cd apps/web
npm run dev
```

### Test Accounts Required

| Account | Role | Email | Purpose |
|---------|------|-------|---------|
| Recipient User | `recipient` | test-recipient@feed.local | Standard user testing |
| Agency Staff | `agency` | test-agency@feed.local | Agency features |
| Admin User | `admin` | test-admin@feed.local | Admin/moderation |
| New User | none | test-new@feed.local | Onboarding flow |

### Database Setup for Test Roles

```sql
-- Run in Supabase SQL Editor to set up test roles
UPDATE profiles SET is_admin = true WHERE email = 'test-admin@feed.local';
UPDATE profiles SET is_verified = true WHERE email = 'test-agency@feed.local';
```

---

## Phase 1: New User Onboarding Flow (15 min)

### 1.1 Signup Process

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 1.1.1 | Navigate to `/signup` | Signup form displays | Form visible |
| 1.1.2 | Enter email, password | Validation works | Real-time validation |
| 1.1.3 | Submit signup | Confirmation email sent | Email received |
| 1.1.4 | Click verification link | Redirected to app | Session established |
| 1.1.5 | Google OAuth test | OAuth flow completes | Profile created |

### 1.2 Profile Setup

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 1.2.1 | Navigate to Settings | Profile form shows | Empty fields |
| 1.2.2 | Upload avatar | Image preview shows | Avatar uploaded |
| 1.2.3 | Fill profile fields | Data saves | Profile updated |
| 1.2.4 | Set location | City/state saved | Location persists |

### 1.3 First-Time User Experience

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 1.3.1 | View overview panel | Welcome content shown | Panel renders |
| 1.3.2 | Navigate panels | All panels accessible | No errors |
| 1.3.3 | View empty states | Helpful prompts shown | UX guidance |

---

## Phase 2: Recipient User Journey (45 min)

### 2.1 Feed Interaction

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 2.1.1 | View feed | Posts display | Data loads |
| 2.1.2 | Create post (text) | Post appears in feed | Real-time update |
| 2.1.3 | Create post (image) | Image uploads, post shows | Image visible |
| 2.1.4 | View own profile posts | Posts filter correctly | User posts only |

### 2.2 Resource Discovery (Map)

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 2.2.1 | Open map panel | Map renders | Mapbox loads |
| 2.2.2 | Allow location | Map centers on user | Geolocation works |
| 2.2.3 | View resource markers | Markers display | Clustering works |
| 2.2.4 | Click marker | Resource popup shows | Details visible |
| 2.2.5 | Search resources | Results filter | Search works |
| 2.2.6 | Filter by category | Markers update | Filter works |
| 2.2.7 | Get directions | Maps app opens | Deep link works |
| 2.2.8 | Submit new resource | Form shows | Submission flow |

### 2.3 Form System

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 2.3.1 | Navigate to Forms | Template list shows | Templates load |
| 2.3.2 | Select SNAP form | Form opens | Multi-step form |
| 2.3.3 | Test autofill | Fields populate | Secure profile data |
| 2.3.4 | Fill all sections | Validation works | Field validation |
| 2.3.5 | E-signature | Canvas captures sig | Signature saves |
| 2.3.6 | Submit form | Confirmation shows | Submission created |
| 2.3.7 | View submission | Status shows | Tracking works |
| 2.3.8 | Repeat for Medicaid | Form completes | Second form works |

### 2.4 Application Tracking

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 2.4.1 | Navigate to Applications | List shows | Applications load |
| 2.4.2 | Filter by status | List updates | Filter works |
| 2.4.3 | View application detail | Timeline shows | Status history |
| 2.4.4 | Add note | Note saves | Notes persist |
| 2.4.5 | Set deadline | Deadline saves | Reminder created |

### 2.5 Document Management

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 2.5.1 | Navigate to Documents | Document list shows | Documents load |
| 2.5.2 | Upload PDF | File uploads | Storage works |
| 2.5.3 | Upload image | Image uploads | Type detection |
| 2.5.4 | Categorize document | Category saves | Organization works |
| 2.5.5 | View document | Viewer opens | Preview works |
| 2.5.6 | Download document | File downloads | Download works |
| 2.5.7 | Delete document | Document removed | Deletion works |

### 2.6 Notification System

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 2.6.1 | View notifications | List shows | Notifications load |
| 2.6.2 | Create reminder | Reminder saves | Scheduling works |
| 2.6.3 | Mark as read | Status updates | Read state persists |
| 2.6.4 | Delete notification | Notification removed | Deletion works |

---

## Phase 3: AI Chat System Testing (30 min)

### 3.1 General Chat

| Step | Action | Expected Result | Validation |
|------|--------|-----------------|------------|
| 3.1.1 | Open chat panel | Chat interface shows | UI loads |
| 3.1.2 | Send greeting | AI responds | Streaming works |
| 3.1.3 | Ask about resources | AI suggests flow | Context aware |
| 3.1.4 | Ask about benefits | AI suggests flow | Context aware |

### 3.2 Resource Finder Flow

| Query Subject | Test Input | Expected AI Response |
|---------------|------------|---------------------|
| Food assistance | "I need food today" | Food pantry recommendations |
| Housing | "I'm facing eviction" | Emergency housing resources |
| Healthcare | "I need to see a doctor but have no insurance" | Community health centers, Medicaid info |
| Utilities | "My electricity will be shut off" | LIHEAP, utility assistance programs |
| Employment | "I lost my job" | Unemployment benefits, job programs |
| Family services | "I need childcare help" | Head Start, subsidized childcare |
| Legal aid | "I need legal help for my landlord dispute" | Legal aid services |
| Mental health | "I'm struggling with depression" | Mental health resources, crisis info |

**Full Flow Test:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.2.1 | Select Resource Finder | Flow starts |
| 3.2.2 | Choose category: Food | Next step shows |
| 3.2.3 | Select urgency: Immediate | Location prompt |
| 3.2.4 | Enter zip code: 90210 | AI processes |
| 3.2.5 | Add requirements: "wheelchair accessible" | AI factors in |
| 3.2.6 | View results | 2-3 resources listed with details |

### 3.3 Eligibility Checker Flow

**Test Scenarios:**

| Scenario | Household | Income | Employment | Expected Programs |
|----------|-----------|--------|------------|-------------------|
| Single adult, low income | 1 | $1,000/mo | Part-time | SNAP, Medicaid |
| Family with children | 4 | $2,500/mo | Full-time | SNAP, CHIP, WIC |
| Pregnant woman | 2 | $1,500/mo | Unemployed | Medicaid, WIC, TANF |
| Senior citizen | 1 | $800/mo | Retired | SSI, Medicare Extra Help |
| Disabled adult | 1 | $0 | Disability | SSI/SSDI, Medicaid |
| Student | 1 | $500/mo | Student | Limited SNAP, Medicaid |

**Full Flow Test:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.3.1 | Select Eligibility Checker | Flow starts |
| 3.3.2 | Household size: 4 | Children question |
| 3.3.3 | Children: Yes (2 under 5) | Pregnancy question |
| 3.3.4 | Pregnant: Yes | Income question |
| 3.3.5 | Income: $2,000/mo | Employment question |
| 3.3.6 | Employment: Unemployed | Benefits question |
| 3.3.7 | Current benefits: None | State question |
| 3.3.8 | State: California | AI analyzes |
| 3.3.9 | View results | Lists: SNAP, Medicaid, WIC, CalWORKs, TANF |

### 3.4 Form Help Flow

**Test Scenarios:**

| Form Type | Help Type | Test Question | Expected Guidance |
|-----------|-----------|---------------|-------------------|
| SNAP | Documents needed | "What docs do I need?" | ID, income proof, residence |
| SNAP | Explain terms | "What is 'gross income'?" | Definition + examples |
| SNAP | Section help | "Household composition confusion" | Who to include, relationships |
| Medicaid | General guidance | "Never done this before" | Step-by-step overview |
| Medicaid | Review | "Is my application complete?" | Checklist of requirements |
| TANF | Documents needed | "What paperwork?" | Required documentation |
| Housing | Section help | "Income calculation" | How to calculate, what counts |

**Full Flow Test:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.4.1 | Select Form Help | Flow starts |
| 3.4.2 | Form type: SNAP | Help type question |
| 3.4.3 | Help type: Section help | Section question |
| 3.4.4 | Section: "Income verification" | Specific issue question |
| 3.4.5 | Issue: "I'm self-employed" | Status question |
| 3.4.6 | Status: In progress | AI provides guidance |
| 3.4.7 | View response | Self-employment income docs explained |

### 3.5 Crisis Detection

**CRITICAL: Test with appropriate sensitivity**

| Trigger Phrase | Expected Response |
|----------------|-------------------|
| "I'm having thoughts of suicide" | Crisis banner + 988 + resources |
| "I'm being hurt at home" | DV Hotline + safety resources |
| "I haven't eaten in 3 days" | Emergency food + immediate resources |
| "I'm sleeping in my car" | Emergency shelter + housing resources |
| "I think I need to go to rehab" | SAMHSA + treatment resources |

**Validation:**
- [ ] Crisis keywords trigger immediately
- [ ] All hotline numbers display correctly
- [ ] Regular conversation resumes after acknowledgment

### 3.6 Rate Limiting & Model Fallback

| Test | Action | Expected Result |
|------|--------|-----------------|
| 3.6.1 | Send 21 messages in 1 minute | 21st blocked, retry-after shown |
| 3.6.2 | Wait retry period | Messages resume |
| 3.6.3 | Simulate API failure | Model fallback activates |

---

## Phase 4: Admin/Moderation Testing (15 min)

### 4.1 Access Control

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1.1 | Login as admin | Full access |
| 4.1.2 | Navigate to moderation | Panel accessible |
| 4.1.3 | Login as regular user | Moderation hidden/blocked |

### 4.2 Resource Moderation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.2.1 | View pending resources | Queue shows |
| 4.2.2 | Review resource details | Full info visible |
| 4.2.3 | Approve resource | Status changes, appears on map |
| 4.2.4 | Reject resource | Status changes, removed |
| 4.2.5 | Edit before approval | Changes save |

---

## Phase 5: Mobile/Responsive Testing (15 min)

### 5.1 Responsive Breakpoints

| Viewport | Expected Behavior |
|----------|-------------------|
| 1440px (Desktop) | Full layout, sidebar visible |
| 1024px (Tablet) | Adjusted layout |
| 768px (Small tablet) | Mobile nav appears |
| 375px (Mobile) | Single column, bottom nav |

### 5.2 Mobile-Specific Features

| Feature | Test | Expected Result |
|---------|------|-----------------|
| Touch gestures | Swipe map | Pan works |
| Pull to refresh | Pull down on feed | Feed refreshes |
| Keyboard | Open form field | Keyboard doesn't obscure |
| Signature | Draw signature | Canvas responds to touch |

### 5.3 Capacitor Testing (if simulators available)

```bash
# Build and sync
cd apps/web && npm run build
npx cap sync

# iOS
npx cap run ios

# Android
npx cap run android
```

| Test | iOS | Android |
|------|-----|---------|
| App launches | ✓ | ✓ |
| Auth flow | ✓ | ✓ |
| Geolocation | ✓ | ✓ |
| Camera (avatar) | ✓ | ✓ |
| Deep links | ✓ | ✓ |

---

## Phase 6: Performance & Security Validation (15 min)

### 6.1 Lighthouse Audit

```bash
# Run Lighthouse on production build
npm run build
npm run start

# In Chrome DevTools > Lighthouse
# Test: Performance, Accessibility, Best Practices, SEO
```

**Targets:**
- Performance: >90
- Accessibility: >90
- Best Practices: >90
- SEO: >90

### 6.2 Security Checks

| Check | Method | Expected |
|-------|--------|----------|
| XSS Prevention | Try `<script>` in post | Sanitized |
| SQL Injection | Try `'; DROP TABLE` | Rejected |
| Auth bypass | Access `/settings` logged out | Redirect to login |
| RLS | Query other user's data | Denied |
| API key exposure | Check network tab | No keys visible |
| HTTPS | Check connection | Secure |

### 6.3 Security Headers

```bash
curl -I https://www.sourcetofeed.com
```

**Expected Headers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Local Supabase running
- [ ] Dev server running
- [ ] Test accounts created
- [ ] Test data seeded (resources, posts)
- [ ] Screen recording ready

### Phase Completion

| Phase | Duration | Tester | Status | Notes |
|-------|----------|--------|--------|-------|
| 1. Onboarding | 15 min | | ☐ Pending | |
| 2. Recipient Journey | 45 min | | ☐ Pending | |
| 3. AI Chat System | 30 min | | ☐ Pending | |
| 4. Admin/Moderation | 15 min | | ☐ Pending | |
| 5. Mobile/Responsive | 15 min | | ☐ Pending | |
| 6. Performance/Security | 15 min | | ☐ Pending | |

### Critical Path Tests (Must Pass)

- [ ] User can sign up and log in
- [ ] User can fill and submit SNAP form
- [ ] User can fill and submit Medicaid form
- [ ] AI chat responds to all guided flows
- [ ] Crisis detection triggers correctly
- [ ] Resources display on map
- [ ] Documents upload successfully
- [ ] No API keys exposed in client
- [ ] Lighthouse Performance > 90

---

## AI Query Test Matrix

### Complete Subject Coverage

| Category | Sample Queries | Flow Used |
|----------|---------------|-----------|
| **Food** | "Where can I get free food?", "Food stamps help" | Resource Finder, Eligibility |
| **Housing** | "I'm about to be homeless", "Rent assistance" | Resource Finder, Eligibility |
| **Healthcare** | "I need a doctor", "How to get Medicaid" | Resource Finder, Eligibility, Form Help |
| **Mental Health** | "I'm feeling overwhelmed", "Counseling services" | Resource Finder, Crisis |
| **Employment** | "Lost my job", "Job training programs" | Resource Finder, Eligibility |
| **Childcare** | "Need help with daycare costs" | Resource Finder, Eligibility |
| **Utilities** | "Can't pay electric bill" | Resource Finder, Eligibility |
| **Legal** | "Eviction notice", "Free legal help" | Resource Finder |
| **Benefits** | "What programs qualify for?", "How to apply for SNAP" | Eligibility, Form Help |
| **Crisis** | "Thinking of hurting myself", "Being abused" | Crisis Detection |

### AI Response Quality Criteria

Each AI response should:
- [ ] Be relevant to the query
- [ ] Provide actionable information
- [ ] Include contact details when applicable
- [ ] Be empathetic in tone
- [ ] Not hallucinate resources
- [ ] Defer to human expertise appropriately

---

## Bug Tracking Template

```markdown
## Bug Report: [Title]

**Phase**: [1-6]
**Severity**: [Critical/High/Medium/Low]
**Steps to Reproduce**:
1.
2.
3.

**Expected Result**:
**Actual Result**:
**Screenshots**:
**Browser/Device**:
**Notes**:
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Developer | | | |
| Product Owner | | | |

---

**Document Version**: 1.0.0
**Created**: 2026-01-31
**Last Updated**: 2026-01-31
