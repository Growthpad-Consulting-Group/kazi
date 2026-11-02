insert into public.staff_work_schedules (user_id, timezone, workday_start, workday_end)
select id, 'Africa/Accra', '08:00', '17:00'
from public.users
where lower(email) = 'emmanuel.eshun@growthpad.net'
on conflict (user_id) do update
set timezone = excluded.timezone,
    workday_start = excluded.workday_start,
    workday_end = excluded.workday_end,
    updated_at = now();
