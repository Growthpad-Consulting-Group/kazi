create table if not exists reward_point_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  original_points integer not null check (original_points > 0),
  remaining_points integer not null check (remaining_points >= 0),
  earned_ledger_id uuid unique references reward_ledger(id) on delete cascade,
  expires_at timestamptz not null,
  expired_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reward_point_lots_expiry_idx
  on reward_point_lots (expires_at)
  where remaining_points > 0 and expired_at is null;

alter table reward_ledger
  add column if not exists expires_at timestamptz,
  add column if not exists expired_at timestamptz;
