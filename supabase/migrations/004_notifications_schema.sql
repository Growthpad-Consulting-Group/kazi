-- ============================================================
-- In-app notifications (header bell)
-- One row per recipient user; events fan out at insert time.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON notifications FOR ALL TO anon USING (false);

-- Grants (service_role used server-side only)
GRANT ALL ON notifications TO service_role;
