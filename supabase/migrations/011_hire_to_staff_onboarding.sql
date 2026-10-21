-- Preserve the deliberate handoff from a hired candidate to their Kazi staff account.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS hired_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS candidates_hired_user_id_key
  ON candidates(hired_user_id)
  WHERE hired_user_id IS NOT NULL;
