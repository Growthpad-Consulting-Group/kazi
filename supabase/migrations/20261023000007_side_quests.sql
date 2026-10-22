CREATE TABLE IF NOT EXISTS side_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  brief text NOT NULL,
  completion_criteria text NOT NULL,
  audience_type text NOT NULL DEFAULT 'company' CHECK (audience_type IN ('company', 'department', 'location', 'manager_group', 'staff')),
  audience_filters jsonb NOT NULL DEFAULT '[]',
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'live', 'closed', 'archived')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS side_quest_completions (
  side_quest_id uuid NOT NULL REFERENCES side_quests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (side_quest_id, user_id)
);

CREATE INDEX IF NOT EXISTS side_quests_status_idx ON side_quests (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS side_quest_completions_quest_idx ON side_quest_completions (side_quest_id);

CREATE TRIGGER side_quests_updated_at BEFORE UPDATE ON side_quests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE side_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE side_quest_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_side_quests" ON side_quests FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_side_quest_completions" ON side_quest_completions FOR ALL TO anon USING (false);
GRANT ALL ON side_quests, side_quest_completions TO service_role;
