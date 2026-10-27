-- Two triggers for daily logging: a day logged with real time, and a run of consecutive logged days.
alter table public.automation_rules drop constraint if exists automation_rules_trigger_type_check;
alter table public.automation_rules add constraint automation_rules_trigger_type_check
  check (trigger_type in ('milestone_anniversary', 'campaign_start', 'quest_ends_soon', 'recognition_received', 'daily_log_logged', 'daily_log_streak'));
