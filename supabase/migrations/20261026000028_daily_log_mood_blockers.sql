ALTER TABLE daily_activity_logs
  ADD COLUMN IF NOT EXISTS mood smallint CHECK (mood BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS blockers text;
