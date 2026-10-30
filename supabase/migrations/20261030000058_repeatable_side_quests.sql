alter table public.side_quests
  add column if not exists repeat_frequency text not null default 'once'
    check (repeat_frequency in ('once', 'weekly', 'monthly')),
  add column if not exists max_completions_per_period integer not null default 1
    check (max_completions_per_period between 1 and 52),
  add column if not exists approver_id uuid references public.users(id) on delete set null;

alter table public.side_quest_completions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists period_key date not null default date '1970-01-01',
  add column if not exists completion_sequence integer not null default 1
    check (completion_sequence > 0);

alter table public.side_quest_completions
  drop constraint if exists side_quest_completions_pkey;

alter table public.side_quest_completions
  alter column id set not null,
  add primary key (id);

create unique index if not exists side_quest_completion_period_idx
  on public.side_quest_completions (side_quest_id, user_id, period_key, completion_sequence);

create index if not exists side_quests_approver_idx
  on public.side_quests (approver_id)
  where approver_id is not null;
