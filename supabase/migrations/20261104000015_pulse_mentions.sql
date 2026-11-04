CREATE TABLE IF NOT EXISTS public.pulse_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mentioned_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, recipient_user_id, body_hash)
);

CREATE INDEX IF NOT EXISTS pulse_mentions_recipient_created
  ON public.pulse_mentions (recipient_user_id, created_at DESC);

ALTER TABLE public.pulse_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_pulse_mentions"
  ON public.pulse_mentions FOR ALL TO anon USING (false);
GRANT ALL ON public.pulse_mentions TO service_role;
