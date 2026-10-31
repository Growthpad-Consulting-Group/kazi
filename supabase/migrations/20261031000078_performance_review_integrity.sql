create table if not exists public.performance_review_audit_logs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles(id) on delete cascade,
  review_id uuid references public.performance_reviews(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete restrict,
  action text not null check (action in ('cycle_created', 'stage_changed', 'review_saved', 'review_submitted', 'peer_assigned', 'peer_removed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists performance_review_audit_cycle_created
  on public.performance_review_audit_logs (cycle_id, created_at desc);

alter table public.performance_review_audit_logs enable row level security;
create policy "anon_no_access_performance_review_audit_logs"
  on public.performance_review_audit_logs for all to anon using (false);
grant all on public.performance_review_audit_logs to service_role;
