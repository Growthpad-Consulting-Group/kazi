create table if not exists public.review_competency_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  scope text not null default 'company' check (scope in ('company', 'department', 'role')),
  scope_value text,
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array'),
  is_active boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'company' and scope_value is null) or (scope <> 'company' and scope_value is not null))
);

create trigger review_competency_templates_updated_at before update on public.review_competency_templates
  for each row execute function public.set_updated_at();

alter table public.review_cycles
  add column if not exists competency_template_id uuid references public.review_competency_templates(id) on delete set null,
  add column if not exists competency_template jsonb;

alter table public.review_competency_templates enable row level security;
create policy "anon_no_access_review_competency_templates" on public.review_competency_templates for all to anon using (false);
grant all on public.review_competency_templates to service_role;
