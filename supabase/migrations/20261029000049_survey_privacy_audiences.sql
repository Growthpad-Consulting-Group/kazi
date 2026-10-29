-- Survey privacy, participation and audience controls.
-- Responses stay anonymous when requested; participation is kept separately
-- so one signed-in staff member can only answer a survey once.

CREATE TABLE IF NOT EXISTS survey_participants (
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS survey_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  audience_type text NOT NULL CHECK (audience_type IN ('staff', 'staff_group', 'department', 'manager_group')),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  staff_group_id uuid REFERENCES staff_groups(id) ON DELETE CASCADE,
  department text,
  manager_id uuid REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT survey_audiences_target CHECK (
    (audience_type = 'staff' AND user_id IS NOT NULL AND staff_group_id IS NULL AND department IS NULL AND manager_id IS NULL) OR
    (audience_type = 'staff_group' AND user_id IS NULL AND staff_group_id IS NOT NULL AND department IS NULL AND manager_id IS NULL) OR
    (audience_type = 'department' AND user_id IS NULL AND staff_group_id IS NULL AND department IS NOT NULL AND manager_id IS NULL) OR
    (audience_type = 'manager_group' AND user_id IS NULL AND staff_group_id IS NULL AND department IS NULL AND manager_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS survey_audiences_target_unique
  ON survey_audiences (survey_id, audience_type, user_id, staff_group_id, department, manager_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS survey_participants_user ON survey_participants (user_id, survey_id);
CREATE INDEX IF NOT EXISTS survey_audiences_survey ON survey_audiences (survey_id);

-- Named historical responses can safely seed the participation ledger. Earlier
-- anonymous answers deliberately contain no identity, so they remain anonymous.
INSERT INTO survey_participants (survey_id, user_id, responded_at)
SELECT survey_id, respondent_id, submitted_at
FROM survey_responses
WHERE respondent_id IS NOT NULL
ON CONFLICT (survey_id, user_id) DO NOTHING;

ALTER TABLE survey_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_survey_participants" ON survey_participants FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_survey_audiences" ON survey_audiences FOR ALL TO anon USING (false);
GRANT ALL ON survey_participants TO service_role;
GRANT ALL ON survey_audiences TO service_role;
