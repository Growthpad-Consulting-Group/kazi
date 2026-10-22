CREATE TABLE IF NOT EXISTS recognition_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text NOT NULL DEFAULT '#f05d23',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS value_id uuid REFERENCES recognition_values(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS feedback_value_id ON feedback(value_id);
ALTER TABLE recognition_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_recognition_values" ON recognition_values FOR ALL TO anon USING (false);
GRANT ALL ON recognition_values TO service_role;

INSERT INTO recognition_values (name, description, color) VALUES
  ('Dependability, consistency & honesty', 'Recognising reliable, principled work and follow-through.', '#2563eb'),
  ('Doing good', 'Recognising work that benefits the team, clients, society or the wider world.', '#16a34a'),
  ('Continuous excellence & innovation', 'Recognising better ways of working, quality and bold ideas.', '#f05d23')
ON CONFLICT (name) DO NOTHING;
