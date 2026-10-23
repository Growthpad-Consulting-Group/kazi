-- Each rule may act once per event and recipient. This keeps scheduled retries
-- and manually triggered runs from duplicating notifications or point awards.
CREATE TABLE IF NOT EXISTS automation_rule_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('send_notification', 'award_points')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, event_key, user_id)
);

CREATE INDEX IF NOT EXISTS automation_rule_executions_event_idx
  ON automation_rule_executions (event_key, created_at DESC);

ALTER TABLE automation_rule_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_automation_rule_executions"
  ON automation_rule_executions FOR ALL TO anon USING (false);
GRANT ALL ON automation_rule_executions TO service_role;
