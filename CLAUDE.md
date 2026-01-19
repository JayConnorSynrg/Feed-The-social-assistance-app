# FEED Platform - Agent Instructions

## Project Overview
**FEED** is a Mutual Aid Resource Sharing Platform helping people access benefits, community resources, and support services.

- **Tech Stack**: Next.js + Capacitor + Supabase + OpenRouter
- **Development Duration**: 24 weeks (6 phases)
- **Primary Docs**: `/specs/001-feed-platform/`

---

## Ralph Loop Protocol

This project uses **Ralph Loop** for autonomous development. On each session:

### 1. Session Start Protocol
```
1. READ: /specs/001-feed-platform/ralph-loop-checklist.md
2. READ: /specs/001-feed-platform/.phase-state.json
3. IDENTIFY: Current phase and task from frontmatter
4. LOCATE: Task details in checklist
5. EXECUTE: Follow task specifications exactly
```

### 2. Task Execution Protocol
```
FOR each task:
  a. Verify dependencies are complete (marked [x])
  b. Execute implementation per specifications
  c. Run validation commands
  d. Mark complete [x] ONLY if validations pass
  e. Update .phase-state.json
  f. Proceed to next task OR report blocker
```

### 3. Session End Protocol
```
1. UPDATE: ralph-loop-checklist.md with completed tasks
2. UPDATE: .phase-state.json with new state
3. COMMIT: Changes with descriptive message
4. REPORT: Summary of completed work
5. IDENTIFY: Next task for continuation
```

---

## Key File Locations

| File | Purpose |
|------|---------|
| `/specs/001-feed-platform/ralph-loop-checklist.md` | Development checklist (READ FIRST) |
| `/specs/001-feed-platform/.phase-state.json` | Machine state tracking |
| `/.claude/plans/hidden-leaping-pillow.md` | Original implementation plan |
| `/apps/web/` | Next.js web application |
| `/apps/mobile/` | Capacitor mobile app |
| `/packages/` | Shared code packages |
| `/supabase/` | Database migrations and functions |

---

## Critical Rules

### DO
- Always read checklist before starting work
- Update checklist immediately after completing tasks
- Run ALL validation commands before marking complete
- Test on both web AND mobile for relevant tasks
- Commit frequently with clear messages

### DO NOT
- Skip tasks or execute out of order
- Mark tasks complete without running validations
- Edit auto-generated files (types.ts, etc.)
- Expose API keys to client-side code
- Create migrations without RLS policies

---

## Phase Exit Criteria

**Phase transitions require ALL criteria met:**

### Phase 1 → Phase 2
- [ ] `npm run build` passes
- [ ] `npm run type-check` has 0 errors
- [ ] Auth works (email + Google)
- [ ] Feed displays posts
- [ ] iOS/Android simulators run

### Phase 2 → Phase 3
- [ ] Map renders with markers
- [ ] 211 data syncs and displays
- [ ] User can submit resources

### Phase 3 → Phase 4
- [ ] Encryption works correctly
- [ ] Form autofill populates
- [ ] E-signature captures

### Phase 4 → Phase 5
- [ ] AI chat responds
- [ ] Guided flows work
- [ ] No API key exposure

### Phase 5 → Phase 6
- [ ] Dashboard functional
- [ ] Notifications trigger
- [ ] Documents upload/view

### Phase 6 → Launch
- [ ] Lighthouse > 90
- [ ] Security audit passed
- [ ] App stores approved

---

## Supabase Patterns

### Type Generation (ALWAYS run after schema changes)
```bash
npx supabase gen types typescript --local > packages/database/types.ts
```

### Migration Order
1. Extensions (postgis, pg_crypto)
2. Core tables (users, profiles)
3. Dependent tables (posts, resources)
4. Junction tables (follows, submissions)
5. RLS policies (AFTER all tables)

### Query Pattern (Avoid N+1)
```typescript
// CORRECT
const { data } = await supabase
  .from('posts')
  .select('*, user:profiles(id, full_name, avatar_url)')
  .order('created_at', { ascending: false })
  .limit(20);

// WRONG - N+1 queries
for (const post of posts) {
  const user = await supabase.from('profiles').select('*').eq('id', post.user_id);
}
```

---

## Common Commands

```bash
# Development
npm run dev                    # Start web dev server
npx supabase start            # Start local Supabase
npx cap run ios               # Run iOS simulator
npx cap run android           # Run Android emulator

# Validation
npm run build                 # Build for production
npm run type-check            # TypeScript validation
npm run test                  # Run tests
npm run lint                  # Lint check

# Database
npx supabase db diff          # Check schema changes
npx supabase db push          # Push migrations
npx supabase gen types typescript --local > packages/database/types.ts

# Mobile
npx cap sync                  # Sync web build to native
npx cap open ios              # Open Xcode
npx cap open android          # Open Android Studio
```

---

## Self-Prompting Templates

### Continue Development
```
Read the ralph-loop-checklist.md to determine current task.
Current task is {TASK_ID}.
Execute task following specifications.
Update checklist when complete.
Proceed to next task.
```

### Report Progress
```
Session Summary:
- Started at task: {START_TASK}
- Completed tasks: {TASK_LIST}
- Current task: {CURRENT_TASK}
- Blockers: {BLOCKERS_OR_NONE}
- Next action: {NEXT_TASK_DESCRIPTION}
```

---

## Error Prevention Matrix

| Error | Prevention |
|-------|------------|
| Type cascade | Run `supabase gen types` after ANY schema change |
| OAuth redirect mismatch | Triple-check URLs in provider AND Supabase dashboard |
| RLS data leak | Create policy for EVERY table immediately |
| N+1 queries | Always use JOINs in Supabase queries |
| API key exposure | Use Edge Functions for ALL external API calls |
| Mobile breaks | Test on device after EACH feature |

---

## Version
- Checklist Version: 1.0.0
- Last Updated: 2026-01-19
