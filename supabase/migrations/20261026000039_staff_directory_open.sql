-- The staff directory is open to every signed-in user, so it no longer needs grants.
delete from public.role_page_access where page_path = '/staff';
