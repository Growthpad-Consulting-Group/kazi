alter table public.pips add column if not exists employee_acknowledged_at timestamptz;

create table if not exists public.pip_checkins (
  id uuid primary key default gen_random_uuid(),
  pip_id uuid not null references public.pips(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  note text not null check (char_length(trim(note)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists pip_checkins_pip_created on public.pip_checkins(pip_id, created_at desc);
alter table public.pip_checkins enable row level security;
create policy "anon_no_access_pip_checkins" on public.pip_checkins for all to anon using (false);
grant all on public.pip_checkins to service_role;
