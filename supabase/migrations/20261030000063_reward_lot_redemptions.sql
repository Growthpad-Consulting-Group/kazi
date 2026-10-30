create or replace function redeem_reward(p_user_id uuid, p_catalogue_item_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare item reward_catalogue%rowtype; wallet reward_wallets%rowtype; redemption_id uuid; remaining integer; lot record; take_points integer; redemption_count integer;
begin
  select * into item from reward_catalogue where id = p_catalogue_item_id for update;
  if not found or not item.is_active or (item.available_from is not null and item.available_from > now()) or (item.expires_at is not null and item.expires_at <= now()) then raise exception 'This reward is unavailable.'; end if;
  if item.stock_quantity is not null and item.stock_quantity <= 0 then raise exception 'This reward is out of stock.'; end if;
  select * into wallet from reward_wallets where user_id = p_user_id for update;
  if not found or wallet.balance < item.points_cost then raise exception 'Insufficient points.'; end if;
  if exists (select 1 from reward_redemptions where user_id=p_user_id and catalogue_item_id=item.id and status in ('pending','approved')) then raise exception 'You already have an active request for this reward.'; end if;
  if item.redemption_limit_per_user is not null then
    select count(*) into redemption_count from reward_redemptions where user_id=p_user_id and catalogue_item_id=item.id and status <> 'rejected';
    if redemption_count >= item.redemption_limit_per_user then raise exception 'You have reached the redemption limit for this reward.'; end if;
  end if;
  remaining := item.points_cost;
  for lot in select id, remaining_points from reward_point_lots where user_id=p_user_id and remaining_points > 0 and expired_at is null and expires_at > now() order by expires_at, created_at for update loop
    take_points := least(remaining, lot.remaining_points);
    update reward_point_lots set remaining_points = remaining_points - take_points where id = lot.id;
    remaining := remaining - take_points;
    exit when remaining = 0;
  end loop;
  if remaining > 0 then raise exception 'Some points have expired. Refresh your balance and try again.'; end if;
  insert into reward_redemptions (user_id, catalogue_item_id, points_spent) values (p_user_id,item.id,item.points_cost) returning id into redemption_id;
  update reward_wallets set balance=balance-item.points_cost, updated_at=now() where user_id=p_user_id;
  if item.stock_quantity is not null then update reward_catalogue set stock_quantity=stock_quantity-1 where id=item.id; end if;
  insert into reward_ledger (user_id,amount,reason,reference_type,reference_id,created_by) values (p_user_id,-item.points_cost,'Redeemed: '||item.name,'redemption',redemption_id,p_user_id);
  return redemption_id;
end;
$$;
