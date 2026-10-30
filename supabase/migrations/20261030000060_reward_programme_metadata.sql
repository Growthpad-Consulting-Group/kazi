alter table public.reward_catalogue
  add column if not exists reward_type text not null default 'reward'
    check (reward_type in ('reward', 'donation')),
  add column if not exists charity_name text,
  add column if not exists cash_cost_kes integer
    check (cash_cost_kes is null or cash_cost_kes >= 0),
  add constraint reward_catalogue_donation_charity_check
    check (reward_type <> 'donation' or charity_name is not null);
