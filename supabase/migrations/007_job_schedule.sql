-- Job visibility window. A job may be published immediately, scheduled for a
-- future time, and optionally closed automatically at a specified time.
ALTER TABLE jobs
  ADD COLUMN published_at timestamptz,
  ADD COLUMN closes_at timestamptz,
  ADD CONSTRAINT jobs_closes_after_publish
    CHECK (closes_at IS NULL OR published_at IS NULL OR closes_at > published_at);

CREATE INDEX jobs_visibility_window_idx ON jobs (status, published_at, closes_at);
