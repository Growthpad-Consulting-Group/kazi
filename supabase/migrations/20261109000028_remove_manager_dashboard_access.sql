-- Pulse is the manager workspace. The broader dashboard remains available to
-- operations roles and to people explicitly granted read-only admin access.
delete from public.role_page_access
where role = 'manager'
  and page_path = '/dashboard';
