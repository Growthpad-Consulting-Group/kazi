-- Manager actions on daily logs: acknowledging a day, and short notes the employee can read.
alter table public.daily_activity_logs
  add column if not exists acknowledged_by uuid references public.users(id) on delete set null,
  add column if not exists acknowledged_at timestamptz;

create table if not exists public.daily_log_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null,
  author_id uuid references public.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists daily_log_comments_user_date_idx on public.daily_log_comments (user_id, log_date);

alter table public.daily_log_comments enable row level security;

-- Only the service role reads and writes these, so revoke everything from the public-facing roles.
revoke all on public.daily_log_comments from anon, authenticated;
grant select, insert, delete on public.daily_log_comments to service_role;
