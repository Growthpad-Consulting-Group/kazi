-- Reward inventory, availability and atomic redemption/refund workflow.
alter table public.reward_catalogue
  add column if not exists category text,
  add column if not exists vendor_name text,
  add column if not exists fulfilment_instructions text,
  add column if not exists stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  add column if not exists redemption_limit_per_user integer check (redemption_limit_per_user is null or redemption_limit_per_user > 0),
  add column if not exists available_from timestamptz,
  add column if not exists expires_at timestamptz,
  add constraint reward_catalogue_availability_window check (expires_at is null or available_from is null or expires_at > available_from);

alter table public.reward_redemptions
  add column if not exists refunded_at timestamptz;

create unique index if not exists reward_redemptions_one_active_request_idx
  on public.reward_redemptions (user_id, catalogue_item_id)
  where status in ('pending', 'approved');

create unique index if not exists reward_ledger_redemption_event_once_idx
  on public.reward_ledger (user_id, reference_type, reference_id)
  where reference_type in ('redemption', 'redemption_refund');

create or replace function public.redeem_reward(p_user_id uuid, p_catalogue_item_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  item public.reward_catalogue%rowtype;
  wallet public.reward_wallets%rowtype;
  redemption_id uuid;
  redemption_count integer;
begin
  select * into item from public.reward_catalogue where id = p_catalogue_item_id for update;
  if not found then raise exception 'This reward is unavailable.'; end if;
  if not item.is_active or (item.available_from is not null and item.available_from > now()) or (item.expires_at is not null and item.expires_at <= now()) then
    raise exception 'This reward is unavailable.';
  end if;
  if item.stock_quantity is not null and item.stock_quantity <= 0 then raise exception 'This reward is out of stock.'; end if;

  select * into wallet from public.reward_wallets where user_id = p_user_id for update;
  if not found or wallet.balance < item.points_cost then raise exception 'Insufficient points.'; end if;

  if exists (select 1 from public.reward_redemptions where user_id = p_user_id and catalogue_item_id = item.id and status in ('pending', 'approved')) then
    raise exception 'You already have an active request for this reward.';
  end if;
  if item.redemption_limit_per_user is not null then
    select count(*) into redemption_count from public.reward_redemptions where user_id = p_user_id and catalogue_item_id = item.id and status <> 'rejected';
    if redemption_count >= item.redemption_limit_per_user then raise exception 'You have reached the redemption limit for this reward.'; end if;
  end if;

  insert into public.reward_redemptions (user_id, catalogue_item_id, points_spent) values (p_user_id, item.id, item.points_cost) returning id into redemption_id;
  update public.reward_wallets set balance = balance - item.points_cost, updated_at = now() where user_id = p_user_id;
  if item.stock_quantity is not null then update public.reward_catalogue set stock_quantity = stock_quantity - 1 where id = item.id; end if;
  insert into public.reward_ledger (user_id, amount, reason, reference_type, reference_id, created_by)
  values (p_user_id, -item.points_cost, 'Redeemed: ' || item.name, 'redemption', redemption_id, p_user_id);
  return redemption_id;
end;
$$;

create or replace function public.process_reward_redemption(p_redemption_id uuid, p_status text, p_actor_id uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  redemption public.reward_redemptions%rowtype;
  item public.reward_catalogue%rowtype;
begin
  select * into redemption from public.reward_redemptions where id = p_redemption_id for update;
  if not found then raise exception 'Redemption not found.'; end if;
  if (redemption.status = 'pending' and p_status not in ('approved', 'rejected')) or (redemption.status = 'approved' and p_status not in ('fulfilled', 'rejected')) then
    raise exception 'This redemption cannot move from % to %.', redemption.status, p_status;
  end if;
  select * into item from public.reward_catalogue where id = redemption.catalogue_item_id for update;

  if p_status = 'rejected' then
    update public.reward_wallets set balance = balance + redemption.points_spent, updated_at = now() where user_id = redemption.user_id;
    if item.stock_quantity is not null then update public.reward_catalogue set stock_quantity = stock_quantity + 1 where id = item.id; end if;
    insert into public.reward_ledger (user_id, amount, reason, reference_type, reference_id, created_by)
    values (redemption.user_id, redemption.points_spent, 'Refunded: ' || item.name, 'redemption_refund', redemption.id, p_actor_id);
    update public.reward_redemptions set status = 'rejected', approved_by = p_actor_id, notes = p_notes, refunded_at = now(), fulfilled_at = null where id = redemption.id;
  else
    update public.reward_redemptions set status = p_status, approved_by = p_actor_id, notes = p_notes, fulfilled_at = case when p_status = 'fulfilled' then now() else fulfilled_at end where id = redemption.id;
  end if;
  return jsonb_build_object('user_id', redemption.user_id, 'catalogue_item_id', redemption.catalogue_item_id, 'status', p_status, 'reward_name', item.name);
end;
$$;

revoke all on function public.redeem_reward(uuid, uuid) from public;
revoke all on function public.process_reward_redemption(uuid, text, uuid, text) from public;
grant execute on function public.redeem_reward(uuid, uuid) to service_role;
grant execute on function public.process_reward_redemption(uuid, text, uuid, text) to service_role;
