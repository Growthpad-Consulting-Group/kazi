create table if not exists public.shared_active_timers (
  user_id uuid primary key references public.users(id) on delete cascade,
  log_date date not null,
  timer jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_active_timers enable row level security;

create policy "Staff can manage their own shared timer"
  on public.shared_active_timers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on public.shared_active_timers to service_role;
