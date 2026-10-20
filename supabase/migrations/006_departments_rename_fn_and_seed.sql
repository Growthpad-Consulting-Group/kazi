-- ============================================================
-- Atomic department rename + default department seed
-- ============================================================

-- Renames a department and cascades the new name to jobs.department and
-- users.department in ONE transaction (a function body is atomic).
CREATE OR REPLACE FUNCTION rename_department(p_id uuid, p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old   text;
  v_name  text := regexp_replace(trim(p_name), '\s+', ' ', 'g');
BEGIN
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'Department name is required';
  END IF;

  SELECT name INTO v_old FROM departments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM departments WHERE lower(name) = lower(v_name) AND id <> p_id
  ) THEN
    RAISE EXCEPTION 'A department named "%" already exists', v_name;
  END IF;

  UPDATE departments SET name = v_name WHERE id = p_id;
  UPDATE jobs  SET department = v_name WHERE department = v_old;
  UPDATE users SET department = v_name WHERE department = v_old;

  RETURN v_name;
END;
$$;

REVOKE ALL ON FUNCTION rename_department(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rename_department(uuid, text) TO service_role;

-- Default departments (skipped when a name already exists, case-insensitively)
INSERT INTO departments (name)
SELECT v.name
FROM (VALUES
  ('Engineering'), ('Design'), ('Product'), ('Marketing'), ('Sales'),
  ('Finance'), ('HR'), ('Operations'), ('Customer Support'), ('Legal')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE lower(d.name) = lower(v.name));
