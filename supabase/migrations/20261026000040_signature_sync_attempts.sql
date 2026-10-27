-- Counts consecutive failed Gmail syncs. The automatic retry stops once it reaches the cap.
alter table public.signature_assignments add column if not exists gmail_sync_attempts integer not null default 0;
