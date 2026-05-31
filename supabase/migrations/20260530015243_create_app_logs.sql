-- App-level structured log sink.
-- Rows are inserted server-side via service-role client (bypasses RLS).
-- No anon/authenticated SELECT is granted — queries go through service-role only.
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null,
  event text not null,
  context jsonb,
  request_id text
);

create index if not exists idx_app_logs_event_created on public.app_logs (event, created_at desc);
create index if not exists idx_app_logs_created on public.app_logs (created_at desc);

alter table public.app_logs enable row level security;
-- service_role bypasses RLS for queries; no explicit SELECT policy granted to anon/authenticated.
-- INSERT is also intentionally denied to anon/authenticated — only service_role writes.
