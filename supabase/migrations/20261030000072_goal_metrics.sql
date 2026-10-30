-- Optional measurable outcomes for goals. Existing manual progress remains valid.
alter table public.goals
  add column if not exists target_value numeric,
  add column if not exists current_value numeric,
  add column if not exists target_unit text;

alter table public.goals
  drop constraint if exists goals_metric_values_check;

alter table public.goals
  add constraint goals_metric_values_check
  check (
    (target_value is null and current_value is null and target_unit is null)
    or (target_value is not null and target_value > 0)
  );
