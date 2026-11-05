-- Enable the organisation's approved Slack baseline for current and future staff.
-- Personal quiet hours and all other notification preferences remain untouched.
ALTER TABLE public.user_notification_preferences
  ALTER COLUMN slack_enabled SET DEFAULT true,
  ALTER COLUMN slack_daily_brief SET DEFAULT true,
  ALTER COLUMN culture_announcements SET DEFAULT true;

INSERT INTO public.user_notification_preferences (
  user_id,
  slack_enabled,
  slack_delivery,
  slack_daily_brief,
  culture_announcements
)
SELECT
  id,
  true,
  'instant',
  true,
  true
FROM public.users
WHERE is_active = true
ON CONFLICT (user_id) DO UPDATE SET
  slack_enabled = true,
  slack_delivery = 'instant',
  slack_daily_brief = true,
  culture_announcements = true,
  updated_at = now();
