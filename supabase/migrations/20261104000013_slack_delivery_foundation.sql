-- Preference-aware, idempotent Slack delivery. Slack is never a system of record.
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS slack_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_delivery text NOT NULL DEFAULT 'instant'
    CHECK (slack_delivery IN ('instant', 'digest')),
  ADD COLUMN IF NOT EXISTS slack_quiet_start time,
  ADD COLUMN IF NOT EXISTS slack_quiet_end time,
  ADD COLUMN IF NOT EXISTS slack_timezone text NOT NULL DEFAULT 'Africa/Nairobi';

CREATE TABLE IF NOT EXISTS public.slack_member_links (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  slack_member_id text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER slack_member_links_updated_at
  BEFORE UPDATE ON public.slack_member_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.slack_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  category text NOT NULL,
  destination text,
  status text NOT NULL CHECK (status IN ('pending', 'delivered', 'suppressed', 'failed')),
  slack_timestamp text,
  error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slack_notification_deliveries_recipient_created
  ON public.slack_notification_deliveries (recipient_user_id, created_at DESC);

ALTER TABLE public.slack_member_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_slack_member_links"
  ON public.slack_member_links FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_slack_notification_deliveries"
  ON public.slack_notification_deliveries FOR ALL TO anon USING (false);
GRANT ALL ON public.slack_member_links TO service_role;
GRANT ALL ON public.slack_notification_deliveries TO service_role;
