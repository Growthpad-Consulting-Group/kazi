create table if not exists public.survey_response_drafts (
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (survey_id, user_id)
);

alter table public.survey_response_drafts enable row level security;
create policy "anon_no_access_survey_response_drafts" on public.survey_response_drafts for all to anon using (false);
grant all on public.survey_response_drafts to service_role;
