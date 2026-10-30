CREATE TABLE IF NOT EXISTS recurring_work_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  client text,
  category text NOT NULL CHECK (category IN ('Meetings', 'Hiring', 'Reporting', 'Projects', 'Admin', 'Other')),
  minutes integer NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekdays', 'weekly', 'custom')),
  weekdays smallint[] NOT NULL DEFAULT '{}'::smallint[] CHECK (weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_work_templates_user_active_idx
  ON recurring_work_templates (user_id, is_active, created_at DESC);

ALTER TABLE recurring_work_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_work_templates TO service_role;
