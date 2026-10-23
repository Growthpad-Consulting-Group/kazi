-- Fix staff_groups.created_by FK to reference public.users instead of auth.users
-- Kazi uses a custom users table, not Supabase Auth
ALTER TABLE staff_groups
  DROP CONSTRAINT staff_groups_created_by_fkey;

ALTER TABLE staff_groups
  ADD CONSTRAINT staff_groups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
