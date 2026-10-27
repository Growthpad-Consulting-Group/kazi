-- role_page_access was created without the table grants the service role needs, so the
-- session lookup failed with "permission denied". Grant the service role what it uses and
-- revoke every privilege from the public-facing roles, since RLS does not stop TRUNCATE.
revoke all on public.role_page_access from anon, authenticated;
grant select, insert, update, delete on public.role_page_access to service_role;
