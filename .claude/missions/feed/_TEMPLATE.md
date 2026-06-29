# MISSION <N> — <Feature>   | owner: feed-<agent> | tier: P0|P1|P2
> One-line: what user-observable capability this mission proves works.

## 1. Backend surface
- RPCs: <name(args)> — purpose — SECDEF? — file anchor
- Edge functions: <name> — purpose — browser-invoked|cron|webhook — file anchor
- Tables: <name> — purpose — RLS? realtime? — file anchor

## 2. User-facing surfaces + interaction points
- <Panel/AdminTab> (file) — interaction points: <buttons/inputs/actions>

## 3. Backend→Surface binding map
- <surface element/action> → <exact rpc/edge-fn/table call> (hook file:line)

## 4. Dependencies
- upstream (this feature needs): <features/secrets/infra>
- downstream (depend on this): <features>

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] <check> → expected: <signal>
### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] <probe> → expected: <signal>  (note any cost/prod-write + cleanup)

## 6. PASS criteria + residuals
- PASS when: <conditions>
- Known residuals: <list or none>
