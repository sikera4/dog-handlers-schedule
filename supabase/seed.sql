insert into public.handlers (id, name, active)
values ('00000000-0000-4000-8000-000000000001', 'Анна, кинолог', true)
on conflict (id) do update set name = excluded.name, active = excluded.active;

insert into public.session_slots (
  handler_id,
  session_type,
  starts_at,
  ends_at,
  capacity,
  location,
  public_notes
)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  case when item.session_hour = 12 then 'group'::public.session_type
       else 'individual'::public.session_type end,
  (day.day_value::date + make_interval(hours => item.session_hour)) at time zone 'Europe/Moscow',
  (day.day_value::date + make_interval(hours => item.session_hour + 1)) at time zone 'Europe/Moscow',
  case when item.session_hour = 12 then 6 else 1 end,
  'Площадка у парка',
  case when item.session_hour = 12 then 'Группа для собак с базовой подготовкой' else null end
from generate_series(current_date + 1, current_date + 28, interval '1 day') as day(day_value)
cross join (values (10), (12), (18)) as item(session_hour)
where extract(isodow from day.day_value) in (2, 4, 6)
on conflict do nothing;
