-- Keeps scheduled privacy retention and the AI screening worker bounded as
-- application history grows. Partial indexes avoid indexing every row.
create index if not exists ai_logs_retention_created_idx
  on public.ai_logs (created_at)
  where created_at is not null;

create index if not exists candidates_unscreened_queue_idx
  on public.candidates (created_at)
  where ai_score is null and (cv_text is not null or cv_parsed is not null);
