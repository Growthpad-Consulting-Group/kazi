-- "Remind me later" snoozes from Slack buttons. The reminder is re-checked when it
-- is due, so a snooze never sends something that has already been completed.
CREATE TABLE IF NOT EXISTS public.slack_reminder_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('review_acknowledgement', 'checkin_review')),
  target_id text NOT NULL,
  remind_after timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, target_id)
);

CREATE INDEX IF NOT EXISTS slack_reminder_snoozes_due_idx
  ON public.slack_reminder_snoozes (remind_after)
  WHERE sent_at IS NULL;

ALTER TABLE public.slack_reminder_snoozes ENABLE ROW LEVEL SECURITY;
