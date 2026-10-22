CREATE TABLE IF NOT EXISTS recognition_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  goal text,
  audience_type text NOT NULL DEFAULT 'company' CHECK (audience_type IN ('company', 'department', 'location', 'manager_group', 'staff')),
  audience_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  value_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_at date,
  ends_at date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'live', 'paused', 'completed', 'archived')),
  visual_color text NOT NULL DEFAULT '#f05d23',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER recognition_campaigns_updated_at BEFORE UPDATE ON recognition_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS recognition_campaigns_status ON recognition_campaigns(status);
ALTER TABLE recognition_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_recognition_campaigns" ON recognition_campaigns FOR ALL TO anon USING (false);
GRANT ALL ON recognition_campaigns TO service_role;
