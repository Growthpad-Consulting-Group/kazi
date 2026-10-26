CREATE TABLE IF NOT EXISTS hall_of_fame_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Growthpad Hall of Fame',
  month date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  opens_at date,
  closes_at date,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month)
);

CREATE TABLE IF NOT EXISTS hall_of_fame_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES hall_of_fame_cycles(id) ON DELETE CASCADE,
  nominator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'wow' CHECK (category = 'wow'),
  impact_statement text NOT NULL CHECK (char_length(trim(impact_statement)) BETWEEN 20 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, nominator_id, nominee_id, category)
);

-- A staff member may self-nominate only once per award cycle, even as more categories are added.
CREATE UNIQUE INDEX IF NOT EXISTS hall_of_fame_one_self_nomination_per_cycle
  ON hall_of_fame_nominations (cycle_id, nominator_id)
  WHERE nominator_id = nominee_id;

CREATE INDEX IF NOT EXISTS hall_of_fame_nominations_cycle_nominee
  ON hall_of_fame_nominations (cycle_id, nominee_id);

CREATE TRIGGER hall_of_fame_cycles_updated_at
  BEFORE UPDATE ON hall_of_fame_cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE hall_of_fame_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_of_fame_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_hall_of_fame_cycles" ON hall_of_fame_cycles FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_hall_of_fame_nominations" ON hall_of_fame_nominations FOR ALL TO anon USING (false);
GRANT ALL ON hall_of_fame_cycles TO service_role;
GRANT ALL ON hall_of_fame_nominations TO service_role;
