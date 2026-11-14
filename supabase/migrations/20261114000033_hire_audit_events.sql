-- Company-scoped audit events for sensitive Kazi Hire actions.
-- Metadata intentionally excludes CV text, email bodies and AI rationale.

CREATE TABLE IF NOT EXISTS hire_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hire_audit_events_company_created_idx
  ON hire_audit_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hire_audit_events_entity_idx
  ON hire_audit_events (entity_type, entity_id, created_at DESC);

ALTER TABLE hire_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hire_audit_events_no_anon_access"
  ON hire_audit_events FOR ALL TO anon USING (false);

GRANT ALL ON hire_audit_events TO service_role;
