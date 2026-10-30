create table if not exists public.staff_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  icon text not null default 'solar:medal-ribbon-broken',
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, code)
);

create index if not exists staff_achievements_user_awarded_idx
  on public.staff_achievements (user_id, awarded_at desc);

alter table public.staff_achievements enable row level security;
create policy "anon_no_access_staff_achievements" on public.staff_achievements for all to anon using (false);
grant all on public.staff_achievements to service_role;
