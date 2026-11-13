-- Optional manager context for a low daily mood signal.
ALTER TABLE public.daily_activity_logs
  ADD COLUMN IF NOT EXISTS mood_note text;
