-- User notification preferences
create table if not exists public.user_notification_preferences (
  user_id              uuid primary key references public.users(id) on delete cascade,
  checkin_reminders    boolean not null default true,
  checkin_submitted    boolean not null default true,
  goal_due_soon        boolean not null default true,
  goal_completed       boolean not null default true,
  review_cycle_started boolean not null default true,
  review_submitted     boolean not null default true,
  one_on_one_scheduled boolean not null default true,
  one_on_one_reminder  boolean not null default true,
  survey_published     boolean not null default true,
  system_announcements boolean not null default true,
  updated_at           timestamptz not null default now()
);

-- System-wide key/value settings (AI provider config, etc.)
create table if not exists public.system_settings (
  key        text primary key,
  ai_provider text,
  ai_model    text,
  ai_api_key  text,
  updated_at  timestamptz not null default now()
);
