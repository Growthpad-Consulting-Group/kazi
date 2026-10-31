alter table public.review_cycles
  add column if not exists self_review_due_date date,
  add column if not exists manager_review_due_date date,
  add column if not exists peer_review_due_date date;

alter table public.review_cycles
  drop constraint if exists review_cycles_stage_deadline_order;
alter table public.review_cycles
  add constraint review_cycles_stage_deadline_order check (
    (self_review_due_date is null or self_review_due_date >= start_date)
    and (manager_review_due_date is null or manager_review_due_date >= coalesce(self_review_due_date, start_date))
    and (peer_review_due_date is null or peer_review_due_date >= coalesce(manager_review_due_date, self_review_due_date, start_date))
    and (peer_review_due_date is null or peer_review_due_date <= end_date)
  );
