CREATE TABLE IF NOT EXISTS candidate_interviews (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  integer     NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  booked_by         uuid        NOT NULL REFERENCES users(id),
  interviewer_ids   uuid[]      NOT NULL DEFAULT '{}',
  google_event_id   text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_interviews_candidate_id_idx ON candidate_interviews (candidate_id, scheduled_at);

ALTER TABLE candidate_interviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_interviews TO service_role;
