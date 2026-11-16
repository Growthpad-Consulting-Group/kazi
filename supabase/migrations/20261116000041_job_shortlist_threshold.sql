-- Per-job score a candidate must reach to be suggested for shortlisting.
-- Existing jobs keep the previous fixed threshold of 65.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS shortlist_threshold smallint NOT NULL DEFAULT 65
  CHECK (shortlist_threshold BETWEEN 0 AND 100);
