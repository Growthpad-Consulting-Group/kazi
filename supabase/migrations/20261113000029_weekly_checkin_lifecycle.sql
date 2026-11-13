-- Weekly check-in lifecycle metadata
-- Daily activity may be shared after Friday close without inventing a
-- reflection. These timestamps keep the scheduled worker idempotent and make
-- the source of an automatic submission clear to staff and managers.

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS daily_evidence_shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS monday_reflection_reminded_at timestamptz;

CREATE INDEX IF NOT EXISTS checkins_pending_reflection_lifecycle_idx
  ON public.checkins (week_start, status)
  WHERE status = 'draft';
