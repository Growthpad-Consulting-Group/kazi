-- ============================================================
-- Departments lookup list (picked from a select instead of free text)
-- jobs.department / users.department stay as text holding the name.
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS departments_name_lower_idx
  ON departments (lower(name));

-- Seed from existing free-text values
INSERT INTO departments (name)
SELECT DISTINCT ON (lower(trim(d))) trim(d)
FROM (
  SELECT department AS d FROM jobs
  UNION
  SELECT department AS d FROM users
) s
WHERE d IS NOT NULL AND trim(d) <> ''
ON CONFLICT DO NOTHING;

-- Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON departments FOR ALL TO anon USING (false);

GRANT ALL ON departments TO service_role;
