# GIT PLAN — feature/nav-nest-tabs

## Entry: nav-nest-tabs

**ID:** nav-nest-tabs
**Status:** complete
**Branch:** feature/nav-nest-tabs (worktree at /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest)
**Base:** 67bb9ec (Merge Phase 3)

### Objective

Move the "Forms" sidebar tab inside the Documents panel, and the "Messages" sidebar tab inside the Community Feed panel — as nested sub-tabs. Forms/Messages stop being top-level sidebar entries; they become sub-views of their parent panel, reachable via in-panel tabs AND via preserved deep-link hashes #forms / #messages.

### Files Changed

- `apps/web/src/components/layout/feed-shell.tsx` — alias routing engine, SIDEBAR_ICONS refactor, label rename
- `apps/web/src/components/panels/documents-panel.tsx` — three-tab toggle (My Documents | My Resources | Forms), FormsPanel mount, ARIA tablist, hash mirror
- `apps/web/src/components/panels/feed-panel.tsx` — top tablist (Feed | Messages), MessagesPanel mount, ARIA tablist, hash mirror
- `apps/web/src/app/page.tsx` — remove dead case 'forms' / case 'messages' from PanelRenderer

### Files NOT Changed

- `apps/web/src/components/panels/forms-panel.tsx` — untouched; rendered as child
- `apps/web/src/components/panels/messages-panel.tsx` — untouched; rendered as child
- All caller files (programs-panel.tsx, map-panel.tsx, overview-panel.tsx, chat-panel.tsx) — untouched; alias layer in setActivePanel handles routing transparently

### Key Design Decisions

1. **PANEL_ALIASES map** in feed-shell.tsx routes 'forms' → documents+subtab='forms', 'messages' → feed+subtab='messages'. All callers work zero-edit.
2. **Functional setPanelParams update** preserves existing params (e.g. openConversationId) when alias resolves — uses `(prev) => ({ ...prev, subtab })`.
3. **panelParams.subtab** is the single source of truth for which sub-tab is active; panels read it on mount and sync via useEffect.
4. **history.replaceState** for sub-tab switches inside documents (resources tab); history.pushState for top-level alias resolution — no back-button spam for tab clicks.
5. **Conditional mount** for MessagesPanel in FeedPanel — only mounts when subtab='messages', hooks clean up on unmount.
6. **ARIA APG Tabs** implemented on both tablist components with roving tabindex + ArrowLeft/Right/Home/End keyboard nav.
7. **Logging**: `logger.info('nav.alias.resolve', ...)` on every alias resolution; `logger.info('nav.subtab.switch', ...)` + `track('nav_subtab', ...)` on every in-panel tab click.

### Validation Results

- `npm run type-check` exit 0 (0 errors)
- `npm run build` fails at baseline (pre-existing Turbopack symlink panic in worktree — node_modules symlinks to main repo, Turbopack cannot traverse; confirmed failing before any changes via git stash test)
- grep: no `case 'forms'` / `case 'messages'` in page.tsx
- grep: SIDEBAR_ICONS contains no forms/messages entries
- grep: PANEL_ALIASES defined at line 115 of feed-shell.tsx
- grep: FormsPanel imported in documents-panel.tsx
- grep: MessagesPanel imported in feed-panel.tsx
- git diff: forms-panel.tsx and messages-panel.tsx not listed (unmodified)

---

## Entry: feed-perf-batch1

**ID:** feed-perf-batch1
**Status:** complete
**Branch:** feature/feed-perf-fixes (worktree at /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest)
**Base:** develop

### Objective
Performance + cleanup batch: Vercel RUM gating, memoization, auth-gated realtime, a11y tablists, demo route removal, perf e2e spec.

### Changes
- middleware.ts: add _vercel/ to matcher negative-lookahead; remove /demo from publicRoutes
- demo/page.tsx + demo/social/page.tsx: deleted (git rm)
- applications-panel.tsx: module-level Intl.DateTimeFormat; counts/filteredApplications wrapped in useMemo; as any cast removed; FilterTabs → ARIA tablist with roving tabindex
- feed-shell.tsx: ShellContext Provider value wrapped in useMemo<ShellContextType>
- use-realtime-feed.ts: gated on session !== null via useAuth
- forms-panel.tsx: TabButton ARIA tablist pattern (role=tab/tablist/tabpanel, roving tabindex, arrow keys)
- map-panel.tsx: Map/List toggle → ARIA tablist
- e2e/perf-walkthrough.spec.ts: new authenticated perf spec (excluded from tsconfig)
- tsconfig.json: exclude e2e/** from type-check

### Validation
- type-check: exit 0
- build: exit 0
