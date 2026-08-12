create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.session_type as enum ('individual', 'group');
create type public.slot_status as enum ('open', 'closed', 'cancelled');
create type public.booking_status as enum (
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
);

create table public.handlers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_slots (
  id uuid primary key default gen_random_uuid(),
  handler_id uuid not null references public.handlers(id) on delete restrict,
  session_type public.session_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null,
  status public.slot_status not null default 'open',
  location text,
  public_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_slots_valid_range check (ends_at > starts_at),
  constraint session_slots_valid_capacity check (capacity > 0),
  constraint session_slots_individual_capacity check (
    session_type <> 'individual' or capacity = 1
  ),
  constraint session_slots_no_open_overlap exclude using gist (
    handler_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'open')
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.session_slots(id) on delete restrict,
  telegram_username text,
  telegram_user_id bigint,
  phone text,
  client_name text,
  dog_name text not null check (length(trim(dog_name)) between 1 and 100),
  status public.booking_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_contact_required check (
    nullif(trim(coalesce(telegram_username, '')), '') is not null
    or nullif(trim(coalesce(phone, '')), '') is not null
  )
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null,
  from_status public.booking_status,
  to_status public.booking_status,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index session_slots_public_lookup_idx
  on public.session_slots (starts_at, session_type)
  where status = 'open';
create index bookings_slot_active_idx
  on public.bookings (slot_id)
  where status <> 'cancelled';
create index bookings_status_created_idx
  on public.bookings (status, created_at desc);
create index booking_events_booking_idx
  on public.booking_events (booking_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger handlers_set_updated_at
before update on public.handlers
for each row execute function public.set_updated_at();

create trigger session_slots_set_updated_at
before update on public.session_slots
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and active = true
  );
$$;

create or replace function public.record_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (
      booking_id,
      event_type,
      to_status,
      actor_user_id
    ) values (
      new.id,
      'created',
      new.status,
      (select auth.uid())
    );
  elsif old.status is distinct from new.status then
    insert into public.booking_events (
      booking_id,
      event_type,
      from_status,
      to_status,
      actor_user_id
    ) values (
      new.id,
      'status_changed',
      old.status,
      new.status,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

create trigger bookings_record_event
after insert or update of status on public.bookings
for each row execute function public.record_booking_event();

create or replace function public.get_public_availability(
  p_from timestamptz,
  p_to timestamptz,
  p_session_type public.session_type default null
)
returns table (
  slot_id uuid,
  session_type public.session_type,
  starts_at timestamptz,
  ends_at timestamptz,
  remaining_capacity integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_RANGE';
  end if;

  if p_to - p_from > interval '90 days' then
    raise exception using errcode = '22023', message = 'AVAILABILITY_RANGE_TOO_LARGE';
  end if;

  return query
  select
    slots.id,
    slots.session_type,
    slots.starts_at,
    slots.ends_at,
    (
      slots.capacity - count(bookings.id) filter (
        where bookings.status <> 'cancelled'
      )
    )::integer as remaining_capacity
  from public.session_slots as slots
  left join public.bookings as bookings on bookings.slot_id = slots.id
  where slots.status = 'open'
    and slots.starts_at >= greatest(p_from, now())
    and slots.starts_at < p_to
    and (p_session_type is null or slots.session_type = p_session_type)
  group by slots.id
  having slots.capacity - count(bookings.id) filter (
    where bookings.status <> 'cancelled'
  ) > 0
  order by slots.starts_at;
end;
$$;

create or replace function public.create_public_booking(
  p_slot_id uuid,
  p_telegram_username text,
  p_telegram_user_id bigint,
  p_phone text,
  p_client_name text,
  p_dog_name text
)
returns table (
  booking_id uuid,
  booking_status public.booking_status,
  slot_session_type public.session_type,
  slot_starts_at timestamptz,
  slot_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_slot public.session_slots%rowtype;
  active_booking_count integer;
  normalized_telegram text;
  normalized_phone text;
  normalized_client_name text;
  normalized_dog_name text;
  inserted_booking public.bookings%rowtype;
begin
  normalized_telegram := nullif(
    lower(regexp_replace(trim(coalesce(p_telegram_username, '')), '^@+', '')),
    ''
  );

  normalized_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  if normalized_phone is not null then
    if length(normalized_phone) = 10 then
      normalized_phone := '+7' || normalized_phone;
    elsif length(normalized_phone) = 11 and left(normalized_phone, 1) = '8' then
      normalized_phone := '+7' || right(normalized_phone, 10);
    else
      normalized_phone := '+' || normalized_phone;
    end if;
  end if;

  normalized_client_name := nullif(trim(coalesce(p_client_name, '')), '');
  normalized_dog_name := nullif(trim(coalesce(p_dog_name, '')), '');

  if normalized_telegram is null and normalized_phone is null then
    raise exception using errcode = '22023', message = 'CONTACT_REQUIRED';
  end if;

  if normalized_telegram is not null
    and normalized_telegram !~ '^[a-z][a-z0-9_]{4,31}$' then
    raise exception using errcode = '22023', message = 'INVALID_TELEGRAM_USERNAME';
  end if;

  if normalized_phone is not null
    and normalized_phone !~ '^\+[1-9][0-9]{9,14}$' then
    raise exception using errcode = '22023', message = 'INVALID_PHONE';
  end if;

  if normalized_dog_name is null or length(normalized_dog_name) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_DOG_NAME';
  end if;

  if normalized_client_name is not null and length(normalized_client_name) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_CLIENT_NAME';
  end if;

  select *
  into selected_slot
  from public.session_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SLOT_NOT_FOUND';
  end if;

  if selected_slot.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'SLOT_NOT_OPEN';
  end if;

  if selected_slot.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'SLOT_IN_PAST';
  end if;

  select count(*)::integer
  into active_booking_count
  from public.bookings
  where slot_id = selected_slot.id
    and status <> 'cancelled';

  if active_booking_count >= selected_slot.capacity then
    raise exception using errcode = 'P0001', message = 'SLOT_FULL';
  end if;

  insert into public.bookings (
    slot_id,
    telegram_username,
    telegram_user_id,
    phone,
    client_name,
    dog_name
  ) values (
    selected_slot.id,
    normalized_telegram,
    p_telegram_user_id,
    normalized_phone,
    normalized_client_name,
    normalized_dog_name
  )
  returning * into inserted_booking;

  return query
  select
    inserted_booking.id,
    inserted_booking.status,
    selected_slot.session_type,
    selected_slot.starts_at,
    selected_slot.ends_at;
end;
$$;

alter table public.handlers enable row level security;
alter table public.session_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;
alter table public.booking_events enable row level security;

create policy handlers_admin_all
on public.handlers for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy session_slots_admin_all
on public.session_slots for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy bookings_admin_all
on public.bookings for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy admin_users_read_self
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create policy booking_events_admin_read
on public.booking_events for select to authenticated
using ((select public.is_admin()));

revoke all on table public.handlers from anon;
revoke all on table public.session_slots from anon;
revoke all on table public.bookings from anon;
revoke all on table public.admin_users from anon;
revoke all on table public.booking_events from anon;

grant select, insert, update, delete on table public.handlers to authenticated;
grant select, insert, update, delete on table public.session_slots to authenticated;
grant select, insert, update, delete on table public.bookings to authenticated;
grant select on table public.admin_users to authenticated;
grant select on table public.booking_events to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.get_public_availability(timestamptz, timestamptz, public.session_type) from public;
grant execute on function public.get_public_availability(timestamptz, timestamptz, public.session_type) to anon, authenticated;

revoke all on function public.create_public_booking(uuid, text, bigint, text, text, text) from public;
grant execute on function public.create_public_booking(uuid, text, bigint, text, text, text) to anon, authenticated;
