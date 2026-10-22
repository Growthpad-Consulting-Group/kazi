-- Optional attachments and identity-protected anonymous follow-up.

ALTER TABLE voice_out_reports
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allows_follow_up boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_access_hash text UNIQUE;

CREATE TABLE IF NOT EXISTS voice_out_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES voice_out_reports(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('staff', 'hr')),
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_out_messages_report_created_at ON voice_out_messages (report_id, created_at);

ALTER TABLE voice_out_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_voice_out_messages" ON voice_out_messages FOR ALL TO anon USING (false);
GRANT ALL ON voice_out_messages TO service_role;
