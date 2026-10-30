-- Existing work-output quests must be submitted with evidence and approved;
-- self-confirmation is reserved for a future explicitly low-stakes quest type.
update public.side_quests
set completion_mode = 'evidence_required'
where completion_mode = 'self_confirm';

-- Remove Emmanuel's test Side Quest completion and only the rewards tied to it.
-- Other reward history remains untouched.
do $$
declare
  v_user_id uuid;
  v_reward_points integer := 0;
  v_xp_points integer := 0;
begin
  select id into v_user_id
  from public.users
  where lower(email) = 'emmanuel.eshun@growthpad.net'
  limit 1;

  if v_user_id is null then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_reward_points
  from public.reward_ledger
  where user_id = v_user_id
    and reference_type = 'side_quest_completion'
    and reference_id in (
      select id from public.side_quest_completions where user_id = v_user_id
    );

  select coalesce(sum(amount), 0) into v_xp_points
  from public.xp_ledger
  where user_id = v_user_id
    and reference_type = 'side_quest_completion'
    and reference_id in (
      select id from public.side_quest_completions where user_id = v_user_id
    );

  delete from public.reward_ledger
  where user_id = v_user_id
    and reference_type = 'side_quest_completion'
    and reference_id in (
      select id from public.side_quest_completions where user_id = v_user_id
    );

  delete from public.xp_ledger
  where user_id = v_user_id
    and reference_type = 'side_quest_completion'
    and reference_id in (
      select id from public.side_quest_completions where user_id = v_user_id
    );

  update public.reward_wallets
  set balance = greatest(0, balance - v_reward_points), updated_at = now()
  where user_id = v_user_id;

  update public.xp_wallets
  set quarterly_balance = greatest(0, quarterly_balance - v_xp_points),
      lifetime_balance = greatest(0, lifetime_balance - v_xp_points),
      updated_at = now()
  where user_id = v_user_id;

  delete from public.side_quest_completions where user_id = v_user_id;
end $$;
