alter table public.reward_point_lots
  add column if not exists expiry_notice_sent_at timestamptz;
