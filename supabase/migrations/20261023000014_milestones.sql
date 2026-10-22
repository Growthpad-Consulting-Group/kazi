CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('work_anniversary','birthday','onboarding_complete','service_achievement')),
  milestone_date date NOT NULL,
  years_count integer,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS milestones_user_type_date_idx ON milestones (user_id, type, milestone_date);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_milestones" ON milestones FOR ALL TO anon USING (false);

GRANT ALL ON milestones TO service_role;
