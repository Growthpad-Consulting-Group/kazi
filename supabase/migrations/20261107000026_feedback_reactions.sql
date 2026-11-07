-- Lightweight appreciation reactions on public recognition. They are social
-- signals only and deliberately have no link to points or leaderboards.
CREATE TABLE IF NOT EXISTS public.feedback_reactions (
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('❤️', '🎉', '👏', '🔥')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS feedback_reactions_feedback_id_idx
  ON public.feedback_reactions (feedback_id);

ALTER TABLE public.feedback_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_feedback_reactions"
  ON public.feedback_reactions FOR ALL TO anon USING (false);
GRANT ALL ON public.feedback_reactions TO service_role;
