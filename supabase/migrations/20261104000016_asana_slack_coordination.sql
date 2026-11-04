-- Asana and Slack coordination. Both flags default to the conservative choice.

-- A staff member decides whether their manager may see an overdue-task count.
ALTER TABLE public.asana_connections
  ADD COLUMN IF NOT EXISTS share_task_health_with_manager boolean NOT NULL DEFAULT false;

-- Set by an admin when an Asana-to-Slack rule already posts task reminders, so
-- Kazi does not send the same reminder a second time.
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS asana_slack_rules_enabled boolean NOT NULL DEFAULT false;

-- Staff choose whether their name can appear in company culture posts. Off by default.
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS culture_announcements boolean NOT NULL DEFAULT false;
