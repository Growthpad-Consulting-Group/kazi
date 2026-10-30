alter table side_quests
  add column if not exists completion_mode text not null default 'self_confirm';

do $$ begin
  alter table side_quests
    add constraint side_quests_completion_mode_check
    check (completion_mode in ('self_confirm', 'evidence_required', 'manager_approval'));
exception when duplicate_object then null;
end $$;

alter table side_quest_completions
  add column if not exists status text not null default 'approved',
  add column if not exists evidence_note text,
  add column if not exists evidence_url text,
  add column if not exists reviewed_by uuid references users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$ begin
  alter table side_quest_completions
    add constraint side_quest_completions_status_check
    check (status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

create index if not exists side_quest_completions_pending_idx
  on side_quest_completions (side_quest_id, status, completed_at);

create unique index if not exists reward_ledger_side_quest_completion_once_idx
  on reward_ledger (user_id, reference_type, reference_id)
  where reference_type = 'side_quest_completion';

create or replace function award_reward_points(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_created_by uuid default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  did_award boolean := false;
  inserted_rows integer := 0;
begin
  insert into reward_wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  insert into reward_ledger (user_id, amount, reason, reference_type, reference_id, created_by)
  values (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id, p_created_by)
  on conflict do nothing;
  get diagnostics inserted_rows = row_count;
  did_award := inserted_rows > 0;

  if did_award then
    update reward_wallets
      set balance = balance + p_amount, updated_at = now()
      where user_id = p_user_id;
  end if;
  return did_award;
end;
$$;

revoke all on function award_reward_points(uuid, integer, text, text, uuid, uuid) from public;
grant execute on function award_reward_points(uuid, integer, text, text, uuid, uuid) to service_role;
