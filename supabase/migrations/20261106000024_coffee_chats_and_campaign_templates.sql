-- Optional cross-team coffee chats. Staff opt in explicitly; matching and Slack
-- delivery are handled by Kazi's server routes using the service role.
CREATE TABLE IF NOT EXISTS coffee_chat_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  opted_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coffee_chat_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'skipped', 'rematch_requested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a_id <> user_b_id),
  UNIQUE (period_start, user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS coffee_chat_matches_period_idx ON coffee_chat_matches(period_start);
CREATE INDEX IF NOT EXISTS coffee_chat_matches_users_idx ON coffee_chat_matches(user_a_id, user_b_id);
CREATE TRIGGER coffee_chat_matches_updated_at BEFORE UPDATE ON coffee_chat_matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS coffee_chat_repeat_months integer NOT NULL DEFAULT 3
  CHECK (coffee_chat_repeat_months BETWEEN 1 AND 12);

ALTER TABLE coffee_chat_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_chat_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_coffee_chat_preferences" ON coffee_chat_preferences FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_coffee_chat_matches" ON coffee_chat_matches FOR ALL TO anon USING (false);
GRANT ALL ON coffee_chat_preferences, coffee_chat_matches TO service_role;

-- Template metadata remains optional and informational: campaigns created from a
-- starter are still standard recognition_campaigns, with no hidden automation.
ALTER TABLE recognition_campaigns
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS point_rule text,
  ADD COLUMN IF NOT EXISTS slack_copy text;
