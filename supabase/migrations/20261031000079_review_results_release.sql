alter table public.review_cycles
  add column if not exists results_released_at timestamptz;

alter table public.performance_reviews
  add column if not exists employee_acknowledged_at timestamptz,
  add column if not exists employee_response text;

alter table public.performance_review_audit_logs
  drop constraint if exists performance_review_audit_logs_action_check;
alter table public.performance_review_audit_logs
  add constraint performance_review_audit_logs_action_check check (action in (
    'cycle_created', 'stage_changed', 'review_saved', 'review_submitted',
    'peer_assigned', 'peer_removed', 'results_released', 'employee_acknowledged'
  ));
