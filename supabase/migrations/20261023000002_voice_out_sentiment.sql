ALTER TABLE voice_out_reports
  ADD COLUMN IF NOT EXISTS sentiment text NOT NULL DEFAULT 'neutral'
  CHECK (sentiment IN ('negative', 'neutral', 'positive'));
