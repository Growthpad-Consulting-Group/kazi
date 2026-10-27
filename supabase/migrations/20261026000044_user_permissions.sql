-- Permissions granted to one person on top of their role. Only the service role reads and writes these.
create table if not exists public.user_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission text not null check (permission in ('manage_side_quests', 'manage_recognition_campaigns')),
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

alter table public.user_permissions enable row level security;
revoke all on public.user_permissions from anon, authenticated;
grant select, insert, update, delete on public.user_permissions to service_role;
