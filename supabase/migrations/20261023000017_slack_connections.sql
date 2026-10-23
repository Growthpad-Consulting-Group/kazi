-- FEAT-001: Slack incoming webhook integration

CREATE TABLE IF NOT EXISTS slack_connections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url  text        NOT NULL,
  channel_name text        NOT NULL,
  created_by   uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER slack_connections_updated_at
  BEFORE UPDATE ON slack_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

-- Anon has no access
CREATE POLICY "anon_no_access_slack_connections"
  ON slack_connections FOR ALL TO anon USING (false);

-- Service role has full access
GRANT ALL ON slack_connections TO service_role;
