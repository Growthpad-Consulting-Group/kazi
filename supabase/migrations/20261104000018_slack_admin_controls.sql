-- Administrator control over Slack categories. A category with enabled = false
-- is not sent to anyone; deliveries are still recorded so the reason is visible.
CREATE TABLE IF NOT EXISTS public.slack_category_controls (
  category text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slack_category_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_slack_category_controls"
  ON public.slack_category_controls FOR ALL TO anon USING (false);
GRANT ALL ON public.slack_category_controls TO service_role;
