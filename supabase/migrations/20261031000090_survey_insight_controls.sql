alter table public.surveys add column if not exists randomize_questions boolean not null default false;
alter table public.surveys add column if not exists follow_up_prompt text;
alter table public.survey_responses add column if not exists department_snapshot text;
