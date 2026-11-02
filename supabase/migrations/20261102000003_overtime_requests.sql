-- Outside-hours work is reviewed, never rewarded automatically.
create table if not exists public.staff_work_schedules (
  user_id uuid primary key references public.users(id) on delete cascade,
  timezone text not null default 'Africa/Nairobi',
  workday_start time not null default '08:00',
  workday_end time not null default '17:00',
  working_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  updated_at timestamptz not null default now(),
  check (workday_start < workday_end),
  check (working_days <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null,
  entry_key text not null,
  task text not null,
  start_time time not null,
  end_time time not null,
  outside_minutes integer not null check (outside_minutes > 0),
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  resolution text check (resolution in ('time_off_in_lieu', 'payroll_compensation')),
  manager_note text check (manager_note is null or char_length(manager_note) <= 1000),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date, entry_key)
);

create index if not exists overtime_requests_reviewer_idx
  on public.overtime_requests (status, log_date desc);
create index if not exists overtime_requests_user_idx
  on public.overtime_requests (user_id, log_date desc);

alter table public.staff_work_schedules enable row level security;
alter table public.overtime_requests enable row level security;
revoke all on public.staff_work_schedules, public.overtime_requests from anon, authenticated;
grant all on public.staff_work_schedules, public.overtime_requests to service_role;
