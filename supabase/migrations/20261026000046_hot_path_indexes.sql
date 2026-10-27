-- Indexes for the lookups the hot paths run on every request.
create index if not exists reward_ledger_created_idx on public.reward_ledger (created_at desc);
create index if not exists users_manager_idx on public.users (manager_id);
create index if not exists automation_rules_trigger_active_idx on public.automation_rules (trigger_type) where is_active;
create index if not exists signature_assignments_template_idx on public.signature_assignments (template_id);
create index if not exists signature_assignments_error_idx on public.signature_assignments (gmail_sync_status) where gmail_sync_status = 'error';
