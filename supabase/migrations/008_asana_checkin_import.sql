-- Per-user Asana OAuth connections for optional weekly check-in task imports.
-- Tokens are encrypted by the application before being stored here.

CREATE TABLE IF NOT EXISTS asana_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  asana_user_gid text NOT NULL,
  asana_email text,
  workspace_gid text NOT NULL,
  workspace_name text,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asana_connections_workspace ON asana_connections (workspace_gid);

CREATE TRIGGER asana_connections_updated_at BEFORE UPDATE ON asana_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE asana_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_asana_connections" ON asana_connections FOR ALL TO anon USING (false);
GRANT ALL ON asana_connections TO service_role;
