-- Preserve accountability when an HR case is handed to another authorised owner.
CREATE TABLE IF NOT EXISTS public.voice_out_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.voice_out_reports(id) ON DELETE CASCADE,
  from_owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  to_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  note text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_out_handoffs_note_length CHECK (note IS NULL OR char_length(note) <= 1000)
);

CREATE INDEX IF NOT EXISTS voice_out_handoffs_report_created_at
  ON public.voice_out_handoffs (report_id, created_at DESC);

ALTER TABLE public.voice_out_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_voice_out_handoffs"
  ON public.voice_out_handoffs FOR ALL TO anon USING (false);
GRANT ALL ON public.voice_out_handoffs TO service_role;

CREATE OR REPLACE FUNCTION public.handoff_voice_out_report(
  p_report_id uuid,
  p_to_owner_id uuid,
  p_created_by uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_from_owner_id
  FROM public.voice_out_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voice Out report not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_to_owner_id
      AND is_active = true
      AND role IN ('admin', 'hr')
  ) THEN
    RAISE EXCEPTION 'Case owner must be an active HR or admin user';
  END IF;

  IF v_from_owner_id IS NOT DISTINCT FROM p_to_owner_id THEN
    RETURN;
  END IF;

  UPDATE public.voice_out_reports
  SET owner_id = p_to_owner_id
  WHERE id = p_report_id;

  INSERT INTO public.voice_out_handoffs (
    report_id, from_owner_id, to_owner_id, note, created_by
  ) VALUES (
    p_report_id, v_from_owner_id, p_to_owner_id, nullif(trim(p_note), ''), p_created_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handoff_voice_out_report(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handoff_voice_out_report(uuid, uuid, uuid, text) TO service_role;
