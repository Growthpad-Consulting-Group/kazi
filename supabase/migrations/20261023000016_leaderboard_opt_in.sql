-- FEAT-006: Leaderboard opt-in column (defensive additions to engagement_notification_preferences)

-- Create the table if it wasn't created by a prior migration
CREATE TABLE IF NOT EXISTS engagement_notification_preferences (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_on_leaderboard boolean DEFAULT true,
  campaign_updates    boolean DEFAULT true,
  side_quest_updates  boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Defensive: add show_on_leaderboard if the table already existed without it
ALTER TABLE engagement_notification_preferences
  ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean DEFAULT true;

-- Defensive: add campaign_updates / side_quest_updates if missing
ALTER TABLE engagement_notification_preferences
  ADD COLUMN IF NOT EXISTS campaign_updates boolean DEFAULT true;
ALTER TABLE engagement_notification_preferences
  ADD COLUMN IF NOT EXISTS side_quest_updates boolean DEFAULT true;

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE engagement_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY IF NOT EXISTS "Users can read own engagement prefs"
  ON engagement_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own row
CREATE POLICY IF NOT EXISTS "Users can insert own engagement prefs"
  ON engagement_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row
CREATE POLICY IF NOT EXISTS "Users can update own engagement prefs"
  ON engagement_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Service-role full access ─────────────────────────────────────────────────
GRANT ALL ON TABLE engagement_notification_preferences TO service_role;
