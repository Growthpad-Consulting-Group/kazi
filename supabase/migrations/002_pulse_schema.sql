-- ============================================================
-- Kazi Pulse: Performance Management Schema
-- ============================================================

-- Enums
-- ============================================================

CREATE TYPE goal_status AS ENUM ('not_started', 'in_progress', 'at_risk', 'completed', 'cancelled');
CREATE TYPE goal_level AS ENUM ('company', 'team', 'individual');
CREATE TYPE feedback_visibility AS ENUM ('public', 'private');
CREATE TYPE checkin_status AS ENUM ('draft', 'submitted', 'reviewed');

-- ============================================================
-- Manager relationships (employee → manager)
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date date;

-- ============================================================
-- Weekly Check-ins
-- ============================================================

CREATE TABLE IF NOT EXISTS checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL, -- Monday of the check-in week
  wins text,
  priorities text,
  blockers text,
  mood int CHECK (mood BETWEEN 1 AND 5),
  status checkin_status NOT NULL DEFAULT 'draft',
  manager_comment text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  ai_summary text, -- AI-generated summary for manager
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

-- ============================================================
-- Goals / OKRs
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  level goal_level NOT NULL DEFAULT 'individual',
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL, -- null = company-level
  parent_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  status goal_status NOT NULL DEFAULT 'not_started',
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  due_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 1-on-1s
-- ============================================================

CREATE TABLE IF NOT EXISTS one_on_ones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  agenda text, -- shared editable text
  notes text,  -- post-meeting notes
  action_items jsonb NOT NULL DEFAULT '[]', -- [{text, done, carried_from}]
  ai_talking_points text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Feedback & Recognition
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  visibility feedback_visibility NOT NULL DEFAULT 'public', -- public = kudos/shoutout; private = personal feedback
  emoji text, -- optional for kudos (e.g. 🔥 💪 ⭐)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Updated-at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER checkins_updated_at BEFORE UPDATE ON checkins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER one_on_ones_updated_at BEFORE UPDATE ON one_on_ones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS checkins_user_week ON checkins (user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS checkins_status ON checkins (status);
CREATE INDEX IF NOT EXISTS goals_owner ON goals (owner_id);
CREATE INDEX IF NOT EXISTS goals_parent ON goals (parent_id);
CREATE INDEX IF NOT EXISTS one_on_ones_manager ON one_on_ones (manager_id);
CREATE INDEX IF NOT EXISTS one_on_ones_report ON one_on_ones (report_id);
CREATE INDEX IF NOT EXISTS feedback_to_user ON feedback (to_user_id);
CREATE INDEX IF NOT EXISTS feedback_from_user ON feedback (from_user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_on_ones ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anon: no access
CREATE POLICY "anon_no_access_checkins" ON checkins FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_goals" ON goals FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_one_on_ones" ON one_on_ones FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_feedback" ON feedback FOR ALL TO anon USING (false);

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON checkins TO service_role;
GRANT ALL ON goals TO service_role;
GRANT ALL ON one_on_ones TO service_role;
GRANT ALL ON feedback TO service_role;
