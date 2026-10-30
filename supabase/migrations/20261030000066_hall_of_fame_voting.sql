alter table public.hall_of_fame_cycles
  drop constraint if exists hall_of_fame_cycles_status_check;
alter table public.hall_of_fame_cycles
  add constraint hall_of_fame_cycles_status_check
  check (status in ('draft', 'open', 'team_voting', 'management_voting', 'published', 'closed'));

create table if not exists hall_of_fame_votes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references hall_of_fame_cycles(id) on delete cascade,
  nominee_id uuid not null references users(id) on delete cascade,
  voter_id uuid not null references users(id) on delete cascade,
  category text not null check (category in ('wow', 'mvp')),
  score integer not null check (score between 1 and 10),
  stage text not null check (stage in ('team', 'management')),
  created_at timestamptz not null default now(),
  unique (cycle_id, nominee_id, voter_id, category, stage)
);

create table if not exists hall_of_fame_winners (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references hall_of_fame_cycles(id) on delete cascade,
  nominee_id uuid not null references users(id) on delete restrict,
  category text not null check (category in ('wow', 'mvp')),
  team_score numeric(5,2),
  management_score numeric(5,2),
  prize_status text not null default 'pending' check (prize_status in ('pending', 'ordered', 'delivered')),
  prize_notes text,
  published_at timestamptz,
  unique (cycle_id, category)
);

alter table public.hall_of_fame_votes enable row level security;
alter table public.hall_of_fame_winners enable row level security;
create policy "anon_no_access_hall_of_fame_votes" on hall_of_fame_votes for all to anon using (false);
create policy "anon_no_access_hall_of_fame_winners" on hall_of_fame_winners for all to anon using (false);
grant all on hall_of_fame_votes, hall_of_fame_winners to service_role;
