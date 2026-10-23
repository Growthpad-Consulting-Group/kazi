-- FEAT-001: Add google_event_id to one_on_ones

ALTER TABLE one_on_ones ADD COLUMN IF NOT EXISTS google_event_id text;
