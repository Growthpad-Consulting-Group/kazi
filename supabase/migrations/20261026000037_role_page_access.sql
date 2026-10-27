-- Per-role page access. Admin is always granted every page in code, so it has no rows here.
-- Each row grants one role access to one page path (matched by path segment).
create table if not exists public.role_page_access (
  role text not null check (role in ('hr', 'manager', 'hiring_manager', 'interviewer', 'employee')),
  page_path text not null,
  created_at timestamptz not null default now(),
  primary key (role, page_path)
);

alter table public.role_page_access enable row level security;

-- Seed: reproduces the access that was previously hard-coded in ROUTE_PERMISSIONS.
insert into public.role_page_access (role, page_path) values
  ('hr', '/dashboard'),
  ('hr', '/staff'),
  ('hr', '/hire'),
  ('hr', '/pulse/analytics'),
  ('hr', '/pulse/engagement-calendar'),
  ('hr', '/signatures/templates'),
  ('hr', '/signatures/staff'),
  ('hr', '/signatures/campaigns'),
  ('hr', '/signatures/domains'),
  ('hr', '/settings/overview'),
  ('hr', '/settings/departments'),
  ('hr', '/settings/staff-groups'),
  ('hr', '/settings/automations'),
  ('hr', '/settings/exports'),
  ('hr', '/settings/data-retention'),
  ('manager', '/dashboard'),
  ('manager', '/staff'),
  ('manager', '/pulse/analytics'),
  ('manager', '/pulse/engagement-calendar'),
  ('hiring_manager', '/hire'),
  ('interviewer', '/hire')
on conflict do nothing;
