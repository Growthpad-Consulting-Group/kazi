-- Public recognition may celebrate several staff members while preserving the
-- original feedback.to_user_id as the primary recipient for backwards compatibility.
CREATE TABLE IF NOT EXISTS feedback_recipients (
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS feedback_recipients_user_id_idx ON feedback_recipients (user_id);

INSERT INTO feedback_recipients (feedback_id, user_id)
SELECT id, to_user_id FROM feedback
ON CONFLICT (feedback_id, user_id) DO NOTHING;

ALTER TABLE feedback_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_feedback_recipients" ON feedback_recipients FOR ALL TO anon USING (false);
GRANT ALL ON feedback_recipients TO service_role;
