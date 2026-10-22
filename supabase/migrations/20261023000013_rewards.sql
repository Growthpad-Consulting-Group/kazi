CREATE TABLE IF NOT EXISTS reward_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  catalogue_item_id uuid NOT NULL REFERENCES reward_catalogue(id) ON DELETE RESTRICT,
  points_spent integer NOT NULL CHECK (points_spent > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','fulfilled','rejected')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reward_redemptions_user_idx ON reward_redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_redemptions_status_idx ON reward_redemptions (status, created_at DESC);

ALTER TABLE reward_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_reward_catalogue" ON reward_catalogue FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_reward_redemptions" ON reward_redemptions FOR ALL TO anon USING (false);

GRANT ALL ON reward_catalogue, reward_redemptions TO service_role;
