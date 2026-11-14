-- CCSA careers pages retain richer public editorial information than the
-- original Hire job model. Keep this company-agnostic so Kazi remains the
-- source of truth without flattening a company's public careers experience.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS public_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.jobs.public_details IS
  'Public company-careers details not represented by core Hire columns, such as openings, languages, timeline, tags and rich editorial sections.';
