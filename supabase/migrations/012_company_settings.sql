-- Single-row company settings table (enforced by the primary key = 'default')
create table if not exists public.company_settings (
  id                  text primary key default 'default',
  company_name        text,
  logo_url            text,
  website             text,
  industry            text,
  company_size        text,
  country             text,
  timezone            text not null default 'Africa/Nairobi',
  fiscal_year_start   integer not null default 1 check (fiscal_year_start between 1 and 12),
  updated_at          timestamptz not null default now()
);

-- Grant access
grant select, insert, update on public.company_settings to service_role, authenticated, anon;

-- Seed one row so updates always work
insert into public.company_settings (id) values ('default') on conflict do nothing;
