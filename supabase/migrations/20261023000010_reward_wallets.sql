CREATE TABLE IF NOT EXISTS reward_wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_ledger_user_created_idx ON reward_ledger (user_id, created_at DESC);
ALTER TABLE reward_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_reward_wallets" ON reward_wallets FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_reward_ledger" ON reward_ledger FOR ALL TO anon USING (false);
GRANT ALL ON reward_wallets, reward_ledger TO service_role;
