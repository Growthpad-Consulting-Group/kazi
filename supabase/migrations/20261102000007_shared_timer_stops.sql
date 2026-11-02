-- One row per stopped shared timer. The primary key makes stop idempotent:
-- a retried or concurrent stop for the same timer id reads this row instead
-- of writing a second daily-log entry.
create table if not exists public.shared_timer_stops (
  user_id uuid not null references public.users(id) on delete cascade,
  timer_id uuid not null,
  log_date date not null,
  entry jsonb not null,
  stopped_at timestamptz not null default now(),
  primary key (user_id, timer_id)
);

alter table public.shared_timer_stops enable row level security;

create policy "Staff can read their own timer stops"
  on public.shared_timer_stops for select
  using (auth.uid() = user_id);

grant all on public.shared_timer_stops to service_role;
