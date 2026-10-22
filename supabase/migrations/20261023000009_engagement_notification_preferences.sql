ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS campaign_updates boolean NOT NULL DEFAULT true;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS side_quest_updates boolean NOT NULL DEFAULT true;
