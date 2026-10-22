CREATE TABLE IF NOT EXISTS staff_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  member_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_staff_groups" ON staff_groups FOR ALL TO anon USING (false);
GRANT ALL ON staff_groups TO service_role;
