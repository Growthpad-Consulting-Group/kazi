CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL CHECK (trigger_type IN ('milestone_anniversary','campaign_start','quest_ends_soon','recognition_received')),
  action_type text NOT NULL CHECK (action_type IN ('send_notification','award_points')),
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_automation_rules" ON automation_rules FOR ALL TO anon USING (false);

GRANT ALL ON automation_rules TO service_role;
