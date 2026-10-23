-- FEAT-001: Google Calendar OAuth integration

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  access_token_ciphertext text        NOT NULL,
  refresh_token_ciphertext text       NOT NULL,
  token_expiry            timestamptz,
  calendar_id             text        NOT NULL DEFAULT 'primary',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Users can read/write only their own row
CREATE POLICY "users_own_google_calendar_connections"
  ON google_calendar_connections FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Anon has no access
CREATE POLICY "anon_no_access_google_calendar_connections"
  ON google_calendar_connections FOR ALL TO anon USING (false);

-- Service role has full access
GRANT ALL ON google_calendar_connections TO service_role;
