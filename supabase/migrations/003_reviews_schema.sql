-- ============================================================
-- Kazi Pulse Phase 3: Reviews, Surveys, IDPs, PIPs
-- ============================================================

CREATE TYPE review_cycle AS ENUM ('quarterly', 'biannual', 'annual');
CREATE TYPE review_status AS ENUM ('pending', 'self_review', 'manager_review', 'peer_review', 'completed');
CREATE TYPE review_type AS ENUM ('self', 'manager', 'peer');
CREATE TYPE survey_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE idp_status AS ENUM ('active', 'completed', 'cancelled');

-- ============================================================
-- Performance Review Cycles
-- ============================================================

CREATE TABLE IF NOT EXISTS review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cycle review_cycle NOT NULL DEFAULT 'quarterly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status review_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Individual Performance Reviews (per cycle, per reviewee)
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_type review_type NOT NULL,
  competency_ratings jsonb NOT NULL DEFAULT '[]', -- [{criterion, rating (1-5), comment}]
  overall_rating numeric(3,1),
  strengths text,
  development_areas text,
  ai_draft text, -- AI-generated draft reviewer edits
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, reviewee_id, reviewer_id, review_type)
);

-- ============================================================
-- Pulse / Engagement Surveys
-- ============================================================

CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  questions jsonb NOT NULL DEFAULT '[]', -- [{id, text, type: scale|text}]
  status survey_status NOT NULL DEFAULT 'draft',
  anonymous boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id uuid REFERENCES users(id) ON DELETE SET NULL, -- null if anonymous
  answers jsonb NOT NULL DEFAULT '{}', -- {question_id: value}
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Individual Development Plans (IDPs)
-- ============================================================

CREATE TABLE IF NOT EXISTS idps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  goals text,
  actions jsonb NOT NULL DEFAULT '[]', -- [{text, due_date, done}]
  status idp_status NOT NULL DEFAULT 'active',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Performance Improvement Plans (PIPs)
-- ============================================================

CREATE TABLE IF NOT EXISTS pips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES users(id),
  hr_id uuid REFERENCES users(id),
  concern text NOT NULL,
  expected_outcomes text NOT NULL,
  support_provided text,
  check_in_frequency text,
  actions jsonb NOT NULL DEFAULT '[]', -- [{text, due_date, done}]
  start_date date NOT NULL,
  review_date date,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Updated-at triggers
-- ============================================================

CREATE TRIGGER review_cycles_updated_at BEFORE UPDATE ON review_cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER performance_reviews_updated_at BEFORE UPDATE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER surveys_updated_at BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER idps_updated_at BEFORE UPDATE ON idps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pips_updated_at BEFORE UPDATE ON pips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS performance_reviews_reviewee ON performance_reviews (reviewee_id, cycle_id);
CREATE INDEX IF NOT EXISTS performance_reviews_reviewer ON performance_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS survey_responses_survey ON survey_responses (survey_id);
CREATE INDEX IF NOT EXISTS idps_user ON idps (user_id);
CREATE INDEX IF NOT EXISTS pips_user ON pips (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE idps ENABLE ROW LEVEL SECURITY;
ALTER TABLE pips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_review_cycles" ON review_cycles FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_performance_reviews" ON performance_reviews FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_surveys" ON surveys FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_survey_responses" ON survey_responses FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_idps" ON idps FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_pips" ON pips FOR ALL TO anon USING (false);

-- ============================================================
-- Grants
-- ============================================================

GRANT ALL ON review_cycles TO service_role;
GRANT ALL ON performance_reviews TO service_role;
GRANT ALL ON surveys TO service_role;
GRANT ALL ON survey_responses TO service_role;
GRANT ALL ON idps TO service_role;
GRANT ALL ON pips TO service_role;
