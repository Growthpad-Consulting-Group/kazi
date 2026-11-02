-- Lets the timer API look up the active timer by its client-generated id,
-- which is also the idempotency key for stop. Written on every timer change.
alter table public.shared_active_timers
  add column if not exists timer_id uuid;

create index if not exists shared_active_timers_timer_id_idx
  on public.shared_active_timers (timer_id);
