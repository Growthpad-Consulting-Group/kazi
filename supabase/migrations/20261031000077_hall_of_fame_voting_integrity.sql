-- A voter makes one revisable choice for each award at each voting stage.
-- Keep the most recent legacy choice before applying the stricter policy.
delete from public.hall_of_fame_votes older
using public.hall_of_fame_votes newer
where older.cycle_id = newer.cycle_id
  and older.voter_id = newer.voter_id
  and older.category = newer.category
  and older.stage = newer.stage
  and (older.created_at, older.id) < (newer.created_at, newer.id);

alter table public.hall_of_fame_votes
  drop constraint if exists hall_of_fame_votes_cycle_id_nominee_id_voter_id_category_stage_key;

create unique index if not exists hall_of_fame_votes_one_choice_per_stage_idx
  on public.hall_of_fame_votes (cycle_id, voter_id, category, stage);

alter table public.hall_of_fame_cycles
  add column if not exists team_voting_opens_at date,
  add column if not exists team_voting_closes_at date,
  add column if not exists management_voting_opens_at date,
  add column if not exists management_voting_closes_at date;

alter table public.hall_of_fame_cycles
  drop constraint if exists hall_of_fame_cycles_voting_windows_check;

alter table public.hall_of_fame_cycles
  add constraint hall_of_fame_cycles_voting_windows_check check (
    (team_voting_opens_at is null or team_voting_closes_at is null or team_voting_closes_at >= team_voting_opens_at)
    and (management_voting_opens_at is null or management_voting_closes_at is null or management_voting_closes_at >= management_voting_opens_at)
  );
