create or replace function public.delete_session_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  perform 1
  from public.session_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1
  from public.bookings
  where slot_id = p_slot_id
  for update;

  if exists (
    select 1
    from public.bookings
    where slot_id = p_slot_id
      and status <> 'cancelled'
  ) then
    raise exception 'SLOT_HAS_ACTIVE_BOOKINGS' using errcode = 'P0001';
  end if;

  delete from public.bookings
  where slot_id = p_slot_id;

  delete from public.session_slots
  where id = p_slot_id;
end;
$$;

revoke all on function public.delete_session_slot(uuid) from public;
grant execute on function public.delete_session_slot(uuid) to authenticated;
