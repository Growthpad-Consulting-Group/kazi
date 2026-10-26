ALTER TABLE pips ADD COLUMN IF NOT EXISTS outcome text CHECK (outcome IN ('successful', 'unsuccessful'));
ALTER TABLE pips ADD COLUMN IF NOT EXISTS resolution_notes text;
