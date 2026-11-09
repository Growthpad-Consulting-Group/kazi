-- A staff member with direct reports needs the existing Manager permission set
-- to act on the check-ins, reviews and 1-on-1s that Kazi assigns to them.
-- Only standard Employees are promoted: specialist and elevated roles retain
-- their explicitly assigned role rather than being silently replaced.
update public.users as manager
set
  role = 'manager',
  updated_at = now()
where manager.role = 'employee'
  and exists (
    select 1
    from public.users as report
    where report.manager_id = manager.id
      and report.is_active = true
  );

-- Keep future reporting assignments aligned with the system role. This does
-- not demote a Manager when their team changes; role changes remain an explicit
-- admin decision.
create or replace function public.promote_direct_report_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active and new.manager_id is not null then
    update public.users
    set
      role = 'manager',
      updated_at = now()
    where id = new.manager_id
      and role = 'employee';
  end if;

  return new;
end;
$$;

drop trigger if exists users_promote_direct_report_manager on public.users;
create trigger users_promote_direct_report_manager
after insert or update of manager_id, is_active on public.users
for each row
execute function public.promote_direct_report_manager();
