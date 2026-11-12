-- Raw peer nominations remain private. A reviewer can optionally publish a
-- concise, anonymised highlight for the team-voting stage.
ALTER TABLE public.wall_of_fame_nominations
  ADD COLUMN IF NOT EXISTS public_highlight text,
  ADD COLUMN IF NOT EXISTS public_highlight_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_highlight_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.wall_of_fame_nominations
  DROP CONSTRAINT IF EXISTS wall_of_fame_nominations_public_highlight_check;
ALTER TABLE public.wall_of_fame_nominations
  ADD CONSTRAINT wall_of_fame_nominations_public_highlight_check
  CHECK (
    public_highlight IS NULL
    OR char_length(trim(public_highlight)) BETWEEN 20 AND 500
  );
