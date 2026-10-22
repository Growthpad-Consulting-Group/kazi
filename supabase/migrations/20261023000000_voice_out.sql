-- ============================================================
-- Kazi Pulse: anonymous Voice Out reports
-- ============================================================

CREATE TYPE voice_out_status AS ENUM ('new', 'in_review', 'resolved', 'archived');
CREATE TYPE voice_out_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS voice_out_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL CHECK (topic IN ('workplace', 'wellbeing', 'inclusion', 'leadership', 'other')),
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 20 AND 2000),
  status voice_out_status NOT NULL DEFAULT 'new',
  priority voice_out_priority NOT NULL DEFAULT 'normal',
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  internal_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_out_reports_status_created_at ON voice_out_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_out_reports_owner_id ON voice_out_reports (owner_id);

CREATE TRIGGER voice_out_reports_updated_at BEFORE UPDATE ON voice_out_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE voice_out_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_voice_out_reports" ON voice_out_reports FOR ALL TO anon USING (false);
GRANT ALL ON voice_out_reports TO service_role;
