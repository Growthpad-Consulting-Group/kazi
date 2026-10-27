-- Read-only access to admin screens. Grants the screens, never the ability to change anything.
alter table public.user_permissions drop constraint if exists user_permissions_permission_check;
alter table public.user_permissions add constraint user_permissions_permission_check
  check (permission in ('manage_side_quests', 'manage_recognition_campaigns', 'view_admin_screens'));
