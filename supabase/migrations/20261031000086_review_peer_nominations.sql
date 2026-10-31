create table if not exists public.review_peer_nominations (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles(id) on delete cascade,
  reviewee_id uuid not null references public.users(id) on delete cascade,
  nominee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.users(id) on delete restrict,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cycle_id, reviewee_id, nominee_id),
  check (reviewee_id <> nominee_id)
);

create index if not exists review_peer_nominations_cycle_status
  on public.review_peer_nominations(cycle_id, status, created_at desc);

alter table public.review_peer_nominations enable row level security;
create policy "anon_no_access_review_peer_nominations"
  on public.review_peer_nominations for all to anon using (false);
grant all on public.review_peer_nominations to service_role;
