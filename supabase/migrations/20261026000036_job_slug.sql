ALTER TABLE jobs ADD COLUMN IF NOT EXISTS slug text;

UPDATE jobs
SET slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'))
  || '-' || left(id::text, 8)
WHERE slug IS NULL;

ALTER TABLE jobs ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_slug_key ON jobs (slug);

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS cover_message text;
