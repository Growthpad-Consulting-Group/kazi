-- XP is recognition progress only: it is deliberately separate from redeemable reward points.
create table if not exists public.xp_wallets (
  user_id uuid primary key references public.users(id) on delete cascade,
  quarter_start date not null,
  quarterly_balance integer not null default 0 check (quarterly_balance >= 0),
  lifetime_balance integer not null default 0 check (lifetime_balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  reference_type text,
  reference_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, reference_type, reference_id)
);

alter table public.side_quests
  add column if not exists xp_points integer not null default 0 check (xp_points between 0 and 1000);

create index if not exists xp_ledger_user_created_idx on public.xp_ledger (user_id, created_at desc);

create or replace function public.award_quarterly_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_created_by uuid default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_quarter_start date := date_trunc('quarter', current_date)::date;
  v_ledger_id uuid;
begin
  if p_amount <= 0 then return false; end if;
  insert into xp_wallets (user_id, quarter_start, quarterly_balance, lifetime_balance)
  values (p_user_id, v_quarter_start, 0, 0)
  on conflict (user_id) do nothing;

  insert into xp_ledger (user_id, amount, reason, reference_type, reference_id, created_by)
  values (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id, p_created_by)
  on conflict do nothing returning id into v_ledger_id;
  if v_ledger_id is null then return false; end if;

  update xp_wallets
  set
    quarterly_balance = case when quarter_start = v_quarter_start then quarterly_balance + p_amount else p_amount end,
    lifetime_balance = lifetime_balance + p_amount,
    quarter_start = v_quarter_start,
    updated_at = now()
  where user_id = p_user_id;
  return true;
end;
$$;

alter table public.xp_wallets enable row level security;
alter table public.xp_ledger enable row level security;
create policy "anon_no_access_xp_wallets" on public.xp_wallets for all to anon using (false);
create policy "anon_no_access_xp_ledger" on public.xp_ledger for all to anon using (false);
grant all on public.xp_wallets, public.xp_ledger to service_role;
revoke all on function public.award_quarterly_xp(uuid, integer, text, text, uuid, uuid) from public;
grant execute on function public.award_quarterly_xp(uuid, integer, text, text, uuid, uuid) to service_role;
