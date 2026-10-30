-- Clear Emmanuel's remaining legacy balance at the administrator's request.
do $$
declare
  staff_id uuid;
  current_balance integer;
begin
  select id into staff_id
  from public.users
  where email = 'emmanuel.eshun@growthpad.net';

  if staff_id is null then
    raise exception 'Could not find Emmanuel Eshun for reward balance clearance';
  end if;

  select balance into current_balance
  from public.reward_wallets
  where user_id = staff_id
  for update;

  if current_balance is null then
    raise exception 'No reward wallet exists for Emmanuel Eshun';
  end if;

  if current_balance > 0 then
    update public.reward_wallets
    set balance = 0,
        updated_at = now()
    where user_id = staff_id;

    update public.reward_point_lots
    set remaining_points = 0,
        expired_at = coalesce(expired_at, now())
    where user_id = staff_id
      and remaining_points > 0;

    insert into public.reward_ledger (
      user_id,
      amount,
      reason,
      reference_type
    )
    values (
      staff_id,
      -current_balance,
      'Remaining historical reward balance cleared by administrator',
      'manual_balance_clearance'
    );
  end if;
end;
$$;
