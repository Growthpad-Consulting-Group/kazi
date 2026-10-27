-- Set when an admin or HR gives someone a temporary password. Cleared when they choose their own.
alter table public.users add column if not exists must_change_password boolean not null default false;
