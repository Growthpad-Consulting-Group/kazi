alter table public.side_quest_completions
  add column if not exists evidence_file_url text;
