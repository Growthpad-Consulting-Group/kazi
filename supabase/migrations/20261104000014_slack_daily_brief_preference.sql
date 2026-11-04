-- Personal daily Kazi brief over Slack is opt-in. Off until the staff member turns it on.
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS slack_daily_brief boolean NOT NULL DEFAULT false;
