# GIT_PLAN.md
## Purpose
Tracks all git operations to ensure GATE 8 compliance. All git ops must be pre-registered here before execution by the SYNRG orchestrator.

## Entry Format
Each entry is a YAML block:
```yaml
id: <kebab-case-action-id>
status: pending | in_progress | complete | superseded
type: commit | branch | merge | push | tag
description: <what this does>
branch: <branch name>
files: [<list of files>]
created_at: <ISO timestamp>
completed_at: <ISO timestamp or null>
```

## Next Action
next_action_id: phase3-observability-resilience

## Log

```yaml
id: phase3-observability-resilience
status: in_progress
type: branch
description: "Phase 3 — withMetric optimization-logging seed (logger+track, normalize duration_ms) + instrument map RPC & chat TTFB (close prod-blind) + vault-context safety-valve + Programs default-state select desync fix + programs error/console cleanup. node:test smokes; tsc+build gated."
branch: feature/phase3-observability-resilience
base: develop
remote: origin
created_at: 2026-05-29T11:00:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase2
status: complete
type: merge
description: "Merge feature/phase2-programs-tiles-fab to develop (--no-ff) + push — ships 2A state normalization, 2B tile address+distance, 2C map-only FAB. Validated: tsc 0, build pass, node:test 13/13."
branch: develop
remote: origin
created_at: 2026-05-29T10:30:00.000Z
completed_at: 2026-05-29T10:30:00.000Z
```

```yaml
id: phase2-programs-tiles-fab
status: complete
type: branch
description: "Phase 2 — 2A state normalization (us-states.ts util + dedup 3x US_STATES + normalize read/write paths, fixes empty Programs + state default), 2B resource-tile address+distance, 2C volunteer FAB map-only bottom-right. node:test smokes; tsc+build gated."
branch: feature/phase2-programs-tiles-fab
base: develop
remote: origin
created_at: 2026-05-29T10:05:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase1
status: complete
type: merge
description: "Merge feature/map-fix-observability-phase1 to develop (--no-ff) and push to origin — ships Phase 1 live via Vercel auto-deploy"
branch: develop
remote: origin
created_at: 2026-05-29T09:10:00.000Z
completed_at: 2026-05-29T09:10:00.000Z
```

```yaml
id: phase1-map-fix-observability
status: complete
type: branch
description: "Phase 1 feature branch — resources abortSignal+finally-guard fix, observability (Vercel RUM + logger wiring + global-error), MapPanel next/dynamic (-548KB), safe dead-code deletion (dashboard/, test-data/, supabase/index.ts). Demo routes EXCLUDED per user."
branch: feature/map-fix-observability-phase1
base: develop
remote: origin
files:
  - apps/web/src/hooks/use-viewport-resources.ts
  - apps/web/src/hooks/use-realtime-feed.ts
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/global-error.tsx
  - apps/web/src/app/page.tsx
  - apps/web/package.json
  - apps/web/src/components/dashboard/ (DELETE)
  - apps/web/src/lib/test-data/ (DELETE)
  - apps/web/src/lib/supabase/index.ts (DELETE)
created_at: 2026-05-29T09:00:00.000Z
completed_at: null
```

```yaml
id: push-develop-map-singleton-fix
status: complete
type: push
description: Push develop to origin — ships a5f662f (Supabase singleton fix) to trigger Vercel redeploy
branch: develop
remote: origin
created_at: 2026-05-29T08:35:00.000Z
completed_at: 2026-05-29T08:35:00.000Z
```

```yaml
id: commit-map-singleton-fix
status: complete
type: commit
description: Singleton browser Supabase client — stops infinite refetch loop that left map "Loading resources..." spinner stuck on
branch: develop
files:
  - apps/web/src/lib/supabase/client.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T08:30:00.000Z
completed_at: 2026-05-29T08:30:00.000Z
```

```yaml
id: push-develop-001
status: superseded
type: push
description: Push develop to origin after vercel.json fix — all session work (fleet agents, structured logging, vercel build fix)
branch: develop
remote: origin
scope: "All session work: fleet agents, structured logging, vercel.json fix"
created_at: 2026-05-28T00:00:00.000Z
completed_at: null
```

```yaml
id: fleet-agents-and-fixes
status: in_progress
type: commit
description: Add 10 fleet agents, fix panels/index.tsx exports, reconcile checklist Phase 1/2 marks, add Phase 8 stub
branch: feature/fleet-agents-and-fixes
files:
  - apps/web/src/components/panels/index.tsx
  - specs/001-feed-platform/ralph-loop-checklist.md
  - .claude/agents/feed-api-debugger.md
  - .claude/agents/feed-auth-debugger.md
  - .claude/agents/feed-data-flow-analyzer.md
  - .claude/agents/feed-documents-expert.md
  - .claude/agents/feed-forms-expert.md
  - .claude/agents/feed-map-debugger.md
  - .claude/agents/feed-realtime-monitor.md
  - .claude/agents/feed-smoke-runner.md
  - .claude/agents/feed-supabase-validator.md
  - .claude/agents/feed-vault-expert.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-28T00:00:00.000Z
completed_at: null
```
