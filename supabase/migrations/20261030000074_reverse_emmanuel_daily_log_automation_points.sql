-- Reverse the five daily-log awards (5 × 2) and one five-day streak award (10)
-- issued before these automations were paused. Keep Emmanuel's unrelated 2 points.
do $$
declare
  staff_id uuid;
  reversal_amount integer := 20;
  remaining_balance integer;
begin
  select id into staff_id
  from public.users
  where email = 'emmanuel.eshun@growthpad.net';

  if staff_id is null then
    raise exception 'Could not find Emmanuel Eshun for daily-log point reversal';
  end if;

  update public.reward_wallets
  set balance = greatest(balance - reversal_amount, 0),
      updated_at = now()
  where user_id = staff_id
  returning balance into remaining_balance;

  if remaining_balance is null then
    raise exception 'No reward wallet exists for Emmanuel Eshun';
  end if;

  -- Rebuild the remaining unspent balance as one current lot so the wallet and
  -- lot-based redemption flow remain in sync after this manual reversal.
  update public.reward_point_lots
  set remaining_points = 0,
      expired_at = coalesce(expired_at, now())
  where user_id = staff_id
    and remaining_points > 0;

  if remaining_balance > 0 then
    insert into public.reward_point_lots (
      user_id,
      original_points,
      remaining_points,
      expires_at
    )
    values (
      staff_id,
      remaining_balance,
      remaining_balance,
      now() + interval '12 months'
    );
  end if;

  insert into public.reward_ledger (
    user_id,
    amount,
    reason,
    reference_type
  )
  values (
    staff_id,
    -reversal_amount,
    'Paused daily-log automations — 5 daily-log awards and 1 streak award reversed',
    'automation_reversal'
  );
end;
$$;
