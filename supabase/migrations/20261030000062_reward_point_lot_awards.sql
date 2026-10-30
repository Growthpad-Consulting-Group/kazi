-- Preserve all current balances as a fair 12-month transition lot.
insert into reward_point_lots (user_id, original_points, remaining_points, expires_at)
select user_id, balance, balance, now() + interval '12 months'
from reward_wallets
where balance > 0
  and not exists (select 1 from reward_point_lots lots where lots.user_id = reward_wallets.user_id);

create or replace function award_reward_points(
  p_user_id uuid, p_amount integer, p_reason text,
  p_reference_type text default null, p_reference_id uuid default null,
  p_created_by uuid default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_ledger_id uuid;
begin
  insert into reward_wallets (user_id, balance) values (p_user_id, 0)
  on conflict (user_id) do nothing;
  insert into reward_ledger (user_id, amount, reason, reference_type, reference_id, created_by, expires_at)
  values (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id, p_created_by, now() + interval '12 months')
  on conflict do nothing returning id into v_ledger_id;
  if v_ledger_id is null then return false; end if;
  insert into reward_point_lots (user_id, original_points, remaining_points, earned_ledger_id, expires_at)
  values (p_user_id, p_amount, p_amount, v_ledger_id, now() + interval '12 months');
  update reward_wallets set balance = balance + p_amount, updated_at = now() where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function award_reward_points(uuid, integer, text, text, uuid, uuid) from public;
grant execute on function award_reward_points(uuid, integer, text, text, uuid, uuid) to service_role;
