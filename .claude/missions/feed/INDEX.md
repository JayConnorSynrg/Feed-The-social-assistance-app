# FEED Feature-Verification Mission Suite

## Purpose

This suite provides 21 end-to-end verification missions for every user-facing and infrastructure feature in the FEED platform. Each mission file is a self-contained brief that a specialized feed-* agent can execute autonomously.

**How to run a mission:** dispatch the owner `feed-*` agent listed in the table below, passing the mission file as its brief. The agent will execute static wiring checks (5a) then runtime probes (5b) and report PASS/FAIL with file:line evidence.

**Existing verification infrastructure** the missions build on:
- `apps/web/e2e/` — 50 Playwright specs
- `apps/web/src/__tests__/smoke-tests.ts` — static smoke tests
- `feed-smoke-runner` agent — 7-mission static wiring suite
- 18 `feed-*` specialist agents
- `npm run type-check | lint | test:e2e | build`

---

## Mission Index

| # | Mission | Owner agent | Tier | Status |
|---|---------|-------------|------|--------|
| 1 | Auth & Session | feed-auth-debugger | P0 | not-authored |
| 2 | Profiles & Settings | feed-supabase-validator | P1 | not-authored |
| 3 | AI Chat | feed-chat-expert | P0 | not-authored |
| 4 | Resource Map & Geo | feed-map-debugger | P0 | not-authored |
| 5 | Community Feed | feed-realtime-monitor | P0 | not-authored |
| 6 | Messages | feed-messages-expert | P1 | not-authored |
| 7 | Events & Check-ins | feed-programs-expert | P1 | not-authored |
| 8 | Petitions | feed-data-flow-analyzer | P1 | not-authored |
| 9 | Documents & Vault | feed-documents-expert + feed-vault-expert | P0 | not-authored |
| 10 | Forms & Applications | feed-forms-expert | P0 | not-authored |
| 11 | Programs | feed-programs-expert | P1 | not-authored |
| 12 | Safety Alerts | feed-map-debugger | P1 | not-authored |
| 13 | Volunteer Resources | feed-volunteer-expert | P1 | not-authored |
| 14 | Saved Resources | feed-resources-expert | P2 | not-authored |
| 15 | Reviews & Harmony | feed-resources-expert | P2 | not-authored |
| 16 | Notifications | feed-realtime-monitor | P2 | not-authored |
| 17 | Content Moderation | feed-supabase-validator | P1 | not-authored |
| 18 | Dashboard/Analytics | feed-data-flow-analyzer | P1 | not-authored |
| 19 | Admin Resource Discovery | feed-edge-functions-expert + feed-resources-expert | P0 | not-authored |
| 20 | Federation | feed-federation-expert | P2 | not-authored |
| 21 | External Sync 211/HUD/IMLS/SNAP | feed-resources-expert | P2 | not-authored |

---

## Feature Groups

### CORE USER

| # | Mission | Tier |
|---|---------|------|
| 1 | Auth & Session | P0 |
| 2 | Profiles & Settings | P1 |
| 3 | AI Chat | P0 |
| 4 | Resource Map & Geo | P0 |
| 5 | Community Feed | P0 |
| 6 | Messages | P1 |
| 7 | Events & Check-ins | P1 |
| 8 | Petitions | P1 |
| 9 | Documents & Vault | P0 |
| 10 | Forms & Applications | P0 |
| 11 | Programs | P1 |
| 12 | Safety Alerts | P1 |
| 13 | Volunteer Resources | P1 |
| 14 | Saved Resources | P2 |
| 15 | Reviews & Harmony | P2 |
| 16 | Notifications | P2 |

### ADMIN

| # | Mission | Tier |
|---|---------|------|
| 17 | Content Moderation | P1 |
| 18 | Dashboard/Analytics | P1 |
| 19 | Admin Resource Discovery | P0 |

### INFRA

| # | Mission | Tier |
|---|---------|------|
| 20 | Federation | P2 |
| 21 | External Sync 211/HUD/IMLS/SNAP | P2 |

---

## Run Order / Dependency Notes

- **Auth (1) is upstream of nearly all missions.** Run it first; a failing auth probe will cascade false-negatives across every other mission that requires a session.
- **Map & Geo (4) underpins 12 (Safety Alerts), 13 (Volunteer Resources), and 19 (Admin Resource Discovery).** Run 4 before those three.
- **Documents & Vault (9) underpins Forms & Applications (10).** The vault unlock flow is a prerequisite for encrypted form submission.
- **Recommended P0 order:** 1 → 4 → 9 → 3 → 5 → 10 → 19
- **Run P0 missions before P1; run P1 before P2.**
- Federation (20) and External Sync (21) are P2 and can run independently of each other.
