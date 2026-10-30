create or replace function expire_reward_points()
returns table(user_id uuid, expired_points integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with expired as (
    update reward_point_lots
    set expired_at = now(), remaining_points = 0
    where expires_at <= now() and expired_at is null and remaining_points > 0
    returning reward_point_lots.user_id, reward_point_lots.remaining_points
  ), totals as (
    select expired.user_id, sum(expired.remaining_points)::integer as points from expired group by expired.user_id
  ), wallets as (
    update reward_wallets wallet set balance = greatest(wallet.balance - totals.points, 0), updated_at = now()
    from totals where wallet.user_id = totals.user_id returning wallet.user_id
  )
  insert into reward_ledger (user_id, amount, reason, reference_type)
  select totals.user_id, -totals.points, 'Reward points expired after 12 months', 'points_expiry' from totals
  returning reward_ledger.user_id, (-reward_ledger.amount)::integer;
end;
$$;
revoke all on function expire_reward_points() from public;
grant execute on function expire_reward_points() to service_role;
