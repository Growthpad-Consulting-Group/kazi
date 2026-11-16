-- Records whether a candidate's shortlist flag came from AI screening or from
-- a recruiter's manual override. AI screening must never overwrite a manual
-- decision. Existing rows default to 'ai', which matches their current flag.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS shortlist_source text NOT NULL DEFAULT 'ai'
  CHECK (shortlist_source IN ('ai', 'manual'));
