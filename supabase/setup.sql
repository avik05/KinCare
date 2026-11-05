-- KinCare database setup. Generated from supabase/migrations by `npm run sql:bundle`. Do not edit by hand.
-- Paste into Supabase > SQL Editor > New query, then Run. Run it once on a new project.

-- ===== 20261104000001_schema.sql =====
-- KinCare schema. Tables follow docs/data-schema.pdf.
create extension if not exists pgcrypto;

create table public.settings (
  id int primary key default 1 check (id = 1),
  no_show_minutes int not null default 30 check (no_show_minutes between 1 and 120),
  replacement_hours int not null default 4,
  membership_fee numeric(10,2) not null default 1999
);
insert into public.settings (id) values (1) on conflict do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'family' check (role in ('family','elder','caregiver','coordinator','admin')),
  full_name text not null default '',
  phone text,
  city text,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  elder_user_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(name) between 2 and 80),
  relation text not null default 'Parent',
  age int check (age between 40 and 120),
  address text not null,
  pin_code text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  care_needs text[] not null default '{}',
  care_tasks text[] not null default array['Morning medicines','Breakfast','Short walk','Lunch'],
  emergency_contact text,
  consent_by uuid not null references public.profiles(id),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.caregivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  initials text generated always as (upper(left(split_part(name,' ',1),1) || left(split_part(name,' ',2),1))) stored,
  phone text,
  pin_code text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  area text,
  years int not null default 0,
  languages text not null default '',
  rate_12 numeric(10,2) not null check (rate_12 > 0),
  rate_24 numeric(10,2) not null check (rate_24 > 0),
  id_checked boolean not null default false,
  police_checked boolean not null default false,
  training_done boolean not null default false,
  verified boolean generated always as (id_checked and police_checked and training_done) stored,
  id_checked_at date, police_checked_at date, training_done_at date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id),
  shift_hours int not null check (shift_hours in (12,24)),
  start_date date not null,
  days int not null check (days >= 14),
  end_date date generated always as (start_date + days - 1) stored,
  day_rate numeric(10,2) not null,
  membership_fee numeric(10,2) not null,
  total_amount numeric(12,2) not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  renewed_from uuid references public.bookings(id) on delete set null,
  rating int check (rating between 1 and 5),
  rating_comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id),
  shift_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','checked_in','completed','missed','reassigned')),
  replacement_of uuid references public.shifts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index shifts_caregiver_idx on public.shifts (caregiver_id, start_at);
create index shifts_parent_idx on public.shifts (parent_id, start_at);
create index shifts_due_idx on public.shifts (status, start_at);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id),
  check_in_at timestamptz not null default now(),
  lat double precision, lng double precision, accuracy_m double precision,
  photo_path text,
  tasks jsonb not null default '{}'::jsonb,       -- {"Morning medicines": "2026-11-05T08:20:00Z", ...}
  check_out_at timestamptz
);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  bp_systolic int check (bp_systolic between 60 and 260),
  bp_diastolic int check (bp_diastolic between 30 and 160),
  sugar int check (sugar between 20 and 600),
  recorded_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  type text not null check (type in ('no_show','sos')),
  level text not null default 'coordinator' check (level in ('coordinator','escalated')),
  raised_at timestamptz not null default now(),
  due_by timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  replacement_shift_id uuid references public.shifts(id) on delete set null,
  note text
);
create unique index alerts_one_per_shift on public.alerts (shift_id, type) where shift_id is not null;
create index alerts_open_idx on public.alerts (resolved_at, raised_at);

-- ===== 20261104000002_functions.sql =====
-- Helpers and the write functions that enforce the business rules.
-- Every function that writes runs as security definer and checks the caller's role itself.

-- ---------- helpers ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and closed_at is null
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('coordinator','admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_caregiver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.caregivers where user_id = auth.uid()
$$;

create or replace function public.owns_parent(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parents where id = p and (family_id = auth.uid() or elder_user_id = auth.uid()))
$$;

-- BR4: a caregiver sees a parent only during a current shift (1 hour before start to 1 hour after end).
create or replace function public.on_shift_now(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shifts s join public.caregivers c on c.id = s.caregiver_id
    where s.parent_id = p and c.user_id = auth.uid()
      and s.status in ('scheduled','checked_in','completed')
      and now() between s.start_at - interval '1 hour' and s.end_at + interval '1 hour')
$$;

create or replace function public.ist_at(d date, t time) returns timestamptz
language sql immutable as $$ select (d + t) at time zone 'Asia/Kolkata' $$;

-- New sign-ups are always families. Staff, caregivers and elders are set up by the team.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'family', coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- FR1: parent profile with consent ----------
create or replace function public.add_parent(
  p_name text, p_relation text, p_age int, p_address text, p_pin text,
  p_needs text[], p_emergency text, p_consent boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if public.my_role() is distinct from 'family' then raise exception 'Only a family account can add a parent'; end if;
  if not coalesce(p_consent,false) then raise exception 'Consent is required before saving a parent profile'; end if;
  insert into public.parents (family_id, name, relation, age, address, pin_code, care_needs, emergency_contact, consent_by, consent_at)
  values (auth.uid(), trim(p_name), coalesce(nullif(trim(p_relation),''),'Parent'), p_age, trim(p_address), trim(p_pin),
          coalesce(p_needs,'{}'), p_emergency, auth.uid(), now())
  returning id into pid;
  return pid;
end $$;

-- ---------- FR2 + BR1 + BR2: booking ----------
create or replace function public.book_care(p_parent uuid, p_caregiver uuid, p_hours int, p_start date, p_days int default 14)
returns uuid language plpgsql security definer set search_path = public as $$
declare cg public.caregivers; bid uuid; rate numeric; fee numeric; i int; d date;
begin
  if public.my_role() is distinct from 'family' or not exists (select 1 from public.parents where id = p_parent and family_id = auth.uid()) then
    raise exception 'You can only book care for your own parent';
  end if;
  if p_hours not in (12,24) then raise exception 'Shifts are 12 or 24 hours'; end if;
  if coalesce(p_days,0) < 14 then raise exception 'Bookings are a minimum of 14 days'; end if;
  if p_start < (now() at time zone 'Asia/Kolkata')::date then raise exception 'Start date cannot be in the past'; end if;
  select * into cg from public.caregivers where id = p_caregiver;
  if not found or not cg.verified then raise exception 'This caregiver is not fully verified yet'; end if;
  rate := case when p_hours = 12 then cg.rate_12 else cg.rate_24 end;
  select membership_fee into fee from public.settings where id = 1;
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, created_by)
  values (p_parent, p_caregiver, p_hours, p_start, p_days, rate, fee, rate * p_days + fee, auth.uid())
  returning id into bid;
  for i in 0 .. p_days - 1 loop
    d := p_start + i;
    insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at)
    values (bid, p_parent, p_caregiver, d, public.ist_at(d,'08:00'), public.ist_at(d,'08:00') + make_interval(hours => p_hours));
  end loop;
  return bid;
end $$;

-- ---------- FR3: check in, tasks, readings, check out ----------
create or replace function public.check_in(p_shift uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_photo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.shifts; vid uuid;
begin
  select * into s from public.shifts where id = p_shift and caregiver_id = public.my_caregiver_id();
  if not found then raise exception 'This is not your shift'; end if;
  if s.status not in ('scheduled') then raise exception 'This shift cannot be checked in (status: %)', s.status; end if;
  if now() < s.start_at - interval '1 hour' then raise exception 'Check-in opens one hour before the shift'; end if;
  if p_photo is null then raise exception 'A photo at the door is required'; end if;
  insert into public.visits (shift_id, parent_id, caregiver_id, lat, lng, accuracy_m, photo_path)
  values (s.id, s.parent_id, s.caregiver_id, p_lat, p_lng, p_accuracy, p_photo)
  returning id into vid;
  update public.shifts set status = 'checked_in' where id = s.id;
  return vid;
end $$;

create or replace function public.set_task(p_visit uuid, p_task text, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.visits v set tasks = case when p_done then tasks || jsonb_build_object(p_task, now()) else tasks - p_task end
  where v.id = p_visit and v.caregiver_id = public.my_caregiver_id() and v.check_out_at is null;
  if not found then raise exception 'You can only update an open visit of your own'; end if;
end $$;

create or replace function public.add_reading(p_visit uuid, p_sys int, p_dia int, p_sugar int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.visits; rid uuid;
begin
  select * into v from public.visits where id = p_visit and caregiver_id = public.my_caregiver_id() and check_out_at is null;
  if not found then raise exception 'You can only add readings during your own open visit'; end if;
  insert into public.readings (visit_id, parent_id, bp_systolic, bp_diastolic, sugar)
  values (v.id, v.parent_id, p_sys, p_dia, p_sugar) returning id into rid;
  return rid;
end $$;

create or replace function public.check_out(p_visit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.visits;
begin
  update public.visits set check_out_at = now()
  where id = p_visit and caregiver_id = public.my_caregiver_id() and check_out_at is null
  returning * into v;
  if not found then raise exception 'You can only check out of your own open visit'; end if;
  update public.shifts set status = 'completed' where id = v.shift_id;
end $$;

-- ---------- FR5 + BR3 + BR5: the no-show check (run by cron every minute, and safe to call any time) ----------
create or replace function public.check_no_shows()
returns int language plpgsql security definer set search_path = public as $$
declare mins int; hrs int; s record; n int := 0;
begin
  select no_show_minutes, replacement_hours into mins, hrs from public.settings where id = 1;
  for s in
    select * from public.shifts
    where status = 'scheduled' and start_at + make_interval(mins => mins) < now() and start_at > now() - interval '1 day'
    for update skip locked
  loop
    update public.shifts set status = 'missed' where id = s.id;
    insert into public.alerts (parent_id, shift_id, type, level, due_by)
    values (s.parent_id, s.id, 'no_show',
            case when s.replacement_of is not null then 'escalated' else 'coordinator' end,
            now() + make_interval(hours => hrs))
    on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- FR6: coordinator assigns a replacement. Today's cover arrives by p_arrive; the rest of the booking moves to the new caregiver.
create or replace function public.assign_replacement(p_alert uuid, p_caregiver uuid, p_arrive timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.alerts; s public.shifts; cg public.caregivers; new_id uuid;
begin
  if not public.is_staff() then raise exception 'Only coordinators can assign replacements'; end if;
  select * into a from public.alerts where id = p_alert and resolved_at is null;
  if not found or a.shift_id is null then raise exception 'This alert is not open or has no shift'; end if;
  select * into cg from public.caregivers where id = p_caregiver;
  if not found or not cg.verified then raise exception 'Choose a fully verified caregiver'; end if;
  select * into s from public.shifts where id = a.shift_id;
  if cg.id = s.caregiver_id then raise exception 'Choose a different caregiver'; end if;
  insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at, replacement_of)
  values (s.booking_id, s.parent_id, cg.id, s.shift_date, p_arrive, s.end_at, s.id)
  returning id into new_id;
  update public.shifts set caregiver_id = cg.id
    where booking_id = s.booking_id and status = 'scheduled' and start_at > s.end_at;
  update public.bookings set caregiver_id = cg.id where id = s.booking_id;
  update public.alerts set resolved_at = now(), resolved_by = auth.uid(), replacement_shift_id = new_id,
    note = cg.name || ' assigned, arriving by ' || to_char(p_arrive at time zone 'Asia/Kolkata', 'HH12:MI am')
  where id = a.id;
  return new_id;
end $$;

-- FR5: SOS from the elder's own screen.
create or replace function public.raise_sos()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; aid uuid;
begin
  select id into pid from public.parents where elder_user_id = auth.uid() limit 1;
  if pid is null then raise exception 'No parent profile is linked to this account'; end if;
  insert into public.alerts (parent_id, type) values (pid, 'sos') returning id into aid;
  return aid;
end $$;

create or replace function public.resolve_alert(p_alert uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only coordinators can resolve alerts'; end if;
  update public.alerts set resolved_at = now(), resolved_by = auth.uid(), note = p_note where id = p_alert and resolved_at is null;
end $$;

-- FR7: coordinator adds and verifies caregivers.
create or replace function public.add_caregiver(p_name text, p_phone text, p_pin text, p_area text, p_years int, p_languages text, p_rate12 numeric, p_rate24 numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.is_staff() then raise exception 'Only coordinators can add caregivers'; end if;
  insert into public.caregivers (name, phone, pin_code, area, years, languages, rate_12, rate_24, created_by)
  values (trim(p_name), p_phone, p_pin, p_area, coalesce(p_years,0), coalesce(p_languages,''), p_rate12, p_rate24, auth.uid())
  returning id into cid;
  return cid;
end $$;

create or replace function public.set_check(p_caregiver uuid, p_check text, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only coordinators can verify caregivers'; end if;
  if p_check = 'id' then update public.caregivers set id_checked = p_done, id_checked_at = case when p_done then current_date end where id = p_caregiver;
  elsif p_check = 'police' then update public.caregivers set police_checked = p_done, police_checked_at = case when p_done then current_date end where id = p_caregiver;
  elsif p_check = 'training' then update public.caregivers set training_done = p_done, training_done_at = case when p_done then current_date end where id = p_caregiver;
  else raise exception 'Unknown check %', p_check; end if;
end $$;

-- FR8: rate and renew or end at the end of a block.
create or replace function public.finish_block(p_booking uuid, p_rating int, p_comment text, p_renew boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.bookings; nb uuid;
begin
  select bk.* into b from public.bookings bk join public.parents p on p.id = bk.parent_id
  where bk.id = p_booking and p.family_id = auth.uid();
  if not found then raise exception 'This is not your booking'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a rating from 1 to 5'; end if;
  update public.bookings set rating = p_rating, rating_comment = p_comment where id = b.id;
  if p_renew then
    nb := public.book_care(b.parent_id, b.caregiver_id, b.shift_hours, greatest(b.end_date + 1, (now() at time zone 'Asia/Kolkata')::date), 14);
    update public.bookings set renewed_from = b.id where id = nb;
  end if;
  return nb;
end $$;

-- Data deletion: closing a family account removes its parents and everything under them.
-- Photos are removed from storage by the app first (Supabase does not allow deleting storage rows from SQL).
create or replace function public.close_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'family' then raise exception 'Only family accounts can be closed here'; end if;
  delete from public.parents where family_id = auth.uid();
  update public.profiles set closed_at = now(), phone = null where id = auth.uid();
end $$;

-- FR9: the four KPIs from section 1 of the BRD, over the last 30 days.
create or replace function public.kpis()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; mins int;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Only the Care Operations head can see KPIs'; end if;
  select no_show_minutes into mins from public.settings where id = 1;
  select jsonb_build_object(
    'alert_minutes', (select round(avg(extract(epoch from (a.raised_at - s.start_at))/60)::numeric, 1)
                      from public.alerts a join public.shifts s on s.id = a.shift_id
                      where a.type = 'no_show' and a.raised_at > now() - interval '30 days'),
    'no_show_minutes', mins,
    'no_shows', (select count(*) from public.alerts where type='no_show' and raised_at > now() - interval '30 days'),
    'replaced_in_time', (select count(*) from public.alerts a join public.shifts r on r.id = a.replacement_shift_id
                         where a.type='no_show' and a.raised_at > now() - interval '30 days' and r.start_at <= a.raised_at + interval '4 hours'),
    'visits_due', (select count(*) from public.shifts where status in ('checked_in','completed') and start_at > now() - interval '30 days'),
    'visits_full', (select count(*) from public.visits v where v.check_in_at > now() - interval '30 days' and v.photo_path is not null
                    and v.lat is not null and jsonb_typeof(v.tasks) = 'object' and v.tasks <> '{}'::jsonb),
    'families_first_block', (select count(distinct p.family_id) from public.bookings b join public.parents p on p.id=b.parent_id
                             where b.renewed_from is null and b.end_date < (now() at time zone 'Asia/Kolkata')::date),
    'families_renewed', (select count(distinct p.family_id) from public.bookings b join public.parents p on p.id=b.parent_id
                         where b.renewed_from is not null),
    'open_alerts', (select count(*) from public.alerts where resolved_at is null),
    'escalations', (select count(*) from public.alerts where level='escalated' and resolved_at is null)
  ) into r;
  return r;
end $$;

create or replace function public.set_no_show_minutes(p_minutes int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Only the Care Operations head can change this'; end if;
  update public.settings set no_show_minutes = p_minutes where id = 1;
end $$;

-- Lock down: only signed-in users may call the functions above; helpers stay internal.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.my_role, public.is_staff, public.my_caregiver_id, public.owns_parent, public.on_shift_now,
  public.add_parent, public.book_care, public.check_in, public.set_task, public.add_reading, public.check_out,
  public.check_no_shows, public.assign_replacement, public.raise_sos, public.resolve_alert, public.add_caregiver,
  public.set_check, public.finish_block, public.close_account, public.kpis, public.set_no_show_minutes, public.ist_at
  to authenticated;

-- ===== 20261104000003_policies.sql =====
-- Row-level security. Reads go through these policies; writes go through the functions in 0002.
alter table public.settings   enable row level security;
alter table public.profiles   enable row level security;
alter table public.parents    enable row level security;
alter table public.caregivers enable row level security;
alter table public.bookings   enable row level security;
alter table public.shifts     enable row level security;
alter table public.visits     enable row level security;
alter table public.readings   enable row level security;
alter table public.alerts     enable row level security;

revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant update (full_name, phone, city) on public.profiles to authenticated;

create policy settings_read on public.settings for select to authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- BR4: a caregiver sees a parent's details only during a current shift.
create policy parents_read on public.parents for select to authenticated
  using (family_id = auth.uid() or elder_user_id = auth.uid() or public.is_staff() or public.on_shift_now(id));

-- BR2: families see only fully verified caregivers, plus whoever is already caring for their parent.
create policy caregivers_read on public.caregivers for select to authenticated
  using (verified or public.is_staff() or user_id = auth.uid()
         or exists (select 1 from public.shifts s where s.caregiver_id = caregivers.id and public.owns_parent(s.parent_id)));

create policy bookings_read on public.bookings for select to authenticated
  using (public.owns_parent(parent_id) or public.is_staff() or caregiver_id = public.my_caregiver_id());

create policy shifts_read on public.shifts for select to authenticated
  using (public.owns_parent(parent_id) or public.is_staff() or caregiver_id = public.my_caregiver_id());

create policy visits_read on public.visits for select to authenticated
  using (public.owns_parent(parent_id) or public.is_staff() or caregiver_id = public.my_caregiver_id());

-- BR4: readings are for the family, staff and the caregiver on shift only.
create policy readings_read on public.readings for select to authenticated
  using (exists (select 1 from public.parents p where p.id = readings.parent_id and p.family_id = auth.uid())
         or public.is_staff() or public.on_shift_now(parent_id));

create policy alerts_read on public.alerts for select to authenticated
  using (public.owns_parent(parent_id) or public.is_staff());

-- ---------- views the app needs that RLS alone can't shape ----------

-- Caregiver: own shifts, with the address and care plan only while the shift is current (BR4).
create or replace function public.caregiver_shifts(p_from date default null)
returns table (shift_id uuid, booking_id uuid, parent_id uuid, parent_name text, shift_date date, start_at timestamptz, end_at timestamptz,
               status text, is_current boolean, address text, pin_code text, care_needs text[], care_tasks text[],
               visit_id uuid, check_in_at timestamptz, check_out_at timestamptz, tasks jsonb, replacement_of uuid)
language sql stable security definer set search_path = public as $$
  select s.id, s.booking_id, s.parent_id, p.name, s.shift_date, s.start_at, s.end_at, s.status,
         now() between s.start_at - interval '1 hour' and s.end_at + interval '1 hour' as is_current,
         case when now() between s.start_at - interval '1 hour' and s.end_at + interval '1 hour' then p.address end,
         p.pin_code,
         case when now() between s.start_at - interval '1 hour' and s.end_at + interval '1 hour' then p.care_needs end,
         case when now() between s.start_at - interval '1 hour' and s.end_at + interval '1 hour' then p.care_tasks end,
         v.id, v.check_in_at, v.check_out_at, v.tasks, s.replacement_of
  from public.shifts s
  join public.parents p on p.id = s.parent_id
  left join public.visits v on v.shift_id = s.id
  where s.caregiver_id = public.my_caregiver_id()
    and s.end_at > coalesce(p_from::timestamptz, now() - interval '1 hour')
    and s.status <> 'reassigned'
  order by s.start_at
  limit 30
$$;

-- Elder: who is coming today, and who to call.
create or replace function public.elder_today()
returns table (parent_id uuid, parent_name text, family_name text, family_phone text,
               caregiver_name text, caregiver_initials text, start_at timestamptz, end_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, f.full_name, f.phone, c.name, c.initials, s.start_at, s.end_at, s.status
  from public.parents p
  join public.profiles f on f.id = p.family_id
  left join lateral (
    select * from public.shifts s
    where s.parent_id = p.id and s.status in ('scheduled','checked_in','completed') and s.end_at > now()
    order by (s.status = 'checked_in') desc, s.start_at limit 1) s on true
  left join public.caregivers c on c.id = s.caregiver_id
  where p.elder_user_id = auth.uid()
  limit 1
$$;

grant execute on function public.caregiver_shifts, public.elder_today to authenticated;

-- ---------- check-in photos ----------
-- Path: <parent_id>/<shift_id>/door.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkins', 'checkins', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy checkins_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'checkins' and exists (
    select 1 from public.shifts s
    where s.id::text = (storage.foldername(name))[2] and s.parent_id::text = (storage.foldername(name))[1]
      and s.caregiver_id = public.my_caregiver_id()));

create policy checkins_read on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and (
    public.is_staff()
    or exists (select 1 from public.parents p where p.id::text = (storage.foldername(objects.name))[1] and p.family_id = auth.uid())
    or exists (select 1 from public.shifts s where s.id::text = (storage.foldername(name))[2] and s.caregiver_id = public.my_caregiver_id())));

create policy checkins_delete_family on storage.objects for delete to authenticated
  using (bucket_id = 'checkins' and exists (
    select 1 from public.parents p where p.id::text = (storage.foldername(objects.name))[1] and p.family_id = auth.uid()));

revoke execute on function public.caregiver_shifts, public.elder_today from public, anon;

-- ===== 20261104000004_cron.sql =====
-- BR3/BR5: check for missed check-ins every minute with pg_cron (available on Supabase's free plan).
-- Wrapped so that setup still succeeds if pg_cron cannot be enabled; the app also calls
-- check_no_shows() every time a screen refreshes, so alerts still fire while someone has the app open.
do $do$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  perform cron.unschedule(jobid) from cron.job where jobname = 'kincare-no-show-check';
  perform cron.schedule('kincare-no-show-check', '* * * * *', 'select public.check_no_shows()');
exception when others then
  raise notice 'pg_cron not enabled (%). Enable it under Database > Extensions, then run this file again.', sqlerrm;
end
$do$;

-- ===== 20261104000005_demo.sql =====
-- Demo accounts and sample data. All names, numbers and addresses are invented.
-- Every demo account uses the password KinCare@2026.
-- reset_demo_data() rebuilds the sample data around today's date. Run it before a demo
-- (the admin can also run it from the Settings screen). Today's shift for Kamala starts
-- 10 minutes after the reset, so check-in and the no-show alert can be shown live.

create or replace function public.demo_user(p_id uuid, p_email text, p_name text, p_role text, p_phone text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not exists (select 1 from auth.users where id = p_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
      crypt('KinCare@2026', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now(),
      '', '', '', '', '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), p_id::text, p_id,
      jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  insert into public.profiles (id, role, full_name, phone) values (p_id, p_role, p_name, p_phone)
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, phone = excluded.phone, closed_at = null;
end $$;

create or replace function public.reset_demo_data()
returns text language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  u_meera uuid := '11111111-0000-4000-8000-000000000001';
  u_arjun uuid := '11111111-0000-4000-8000-000000000002';
  u_farah uuid := '11111111-0000-4000-8000-000000000003';
  u_kamala uuid := '11111111-0000-4000-8000-000000000011';
  u_lakshmi uuid := '11111111-0000-4000-8000-000000000021';
  u_selvi uuid := '11111111-0000-4000-8000-000000000022';
  u_priya uuid := '11111111-0000-4000-8000-000000000023';
  u_ravi uuid := '11111111-0000-4000-8000-000000000031';
  u_nandini uuid := '11111111-0000-4000-8000-000000000041';
  c_lakshmi uuid := '22222222-0000-4000-8000-000000000001';
  c_selvi uuid := '22222222-0000-4000-8000-000000000002';
  c_priya uuid := '22222222-0000-4000-8000-000000000003';
  c_anitha uuid := '22222222-0000-4000-8000-000000000004';
  c_mitali uuid := '22222222-0000-4000-8000-000000000007';
  p_kamala uuid := '33333333-0000-4000-8000-000000000001';
  p_ruma uuid := '33333333-0000-4000-8000-000000000002';
  p_imran uuid := '33333333-0000-4000-8000-000000000003';
  b1 uuid; b2 uuid; b3 uuid; b4 uuid; s record; vid uuid; missed uuid; rep uuid; i int;
begin
  if auth.uid() is not null and public.my_role() is distinct from 'admin' then
    raise exception 'Only the Care Operations head can reset the demo';
  end if;

  perform public.demo_user(u_meera,   'meera@kincare.demo',   'Meera Iyer',   'family',      '+65 8000 0101');
  perform public.demo_user(u_arjun,   'arjun@kincare.demo',   'Arjun Sen',    'family',      '+91 90000 00102');
  perform public.demo_user(u_farah,   'farah@kincare.demo',   'Farah Khan',   'family',      '+91 90000 00103');
  perform public.demo_user(u_kamala,  'kamala@kincare.demo',  'Kamala Iyer',  'elder',       '+91 90000 00111');
  perform public.demo_user(u_lakshmi, 'lakshmi@kincare.demo', 'Lakshmi R.',   'caregiver',   '+91 90000 00121');
  perform public.demo_user(u_selvi,   'selvi@kincare.demo',   'Selvi M.',     'caregiver',   '+91 90000 00122');
  perform public.demo_user(u_priya,   'priya@kincare.demo',   'Priya D.',     'caregiver',   '+91 90000 00123');
  perform public.demo_user(u_ravi,    'ravi@kincare.demo',    'Ravi Kumar',   'coordinator', '+91 90000 00131');
  perform public.demo_user(u_nandini, 'nandini@kincare.demo', 'Nandini Rao',  'admin',       '+91 90000 00141');

  -- clear previous demo records (parents cascade to bookings, shifts, visits, readings, alerts)
  delete from public.parents where family_id in (u_meera, u_arjun, u_farah);

  -- ten caregivers: six in Chennai, four in Kolkata (BRD milestone 5)
  insert into public.caregivers (id, user_id, name, phone, pin_code, area, years, languages, rate_12, rate_24,
                                 id_checked, police_checked, training_done, id_checked_at, police_checked_at, training_done_at)
  values
    (c_lakshmi, u_lakshmi, 'Lakshmi R.', '+91 90000 00121', '600020', 'Adyar',        6, 'Tamil, English',        1100, 1800, true, true, true, today-80, today-73, today-60),
    (c_selvi,   u_selvi,   'Selvi M.',   '+91 90000 00122', '600020', 'Adyar',        4, 'Tamil, Telugu',         1000, 1700, true, true, true, today-90, today-84, today-70),
    (c_priya,   u_priya,   'Priya D.',   '+91 90000 00123', '600041', 'Thiruvanmiyur',8, 'Tamil, Hindi, English', 1200, 1900, true, true, true, today-120,today-110,today-100),
    (c_anitha,  null,      'Anitha K.',  '+91 90000 00124', '600020', 'Adyar',        3, 'Tamil, Malayalam',      1050, 1750, true, false, true, today-2, null, today-1),
    ('22222222-0000-4000-8000-000000000005', null, 'Bhavani S.', '+91 90000 00125', '600041', 'Besant Nagar', 5, 'Tamil, English', 1100, 1800, true, true, true, today-60, today-55, today-50),
    ('22222222-0000-4000-8000-000000000006', null, 'Revathi P.', '+91 90000 00126', '600090', 'Besant Nagar', 2, 'Tamil',          950, 1600, true, true, false, today-10, today-5, null),
    (c_mitali,  null,      'Mitali Das', '+91 90000 00127', '700029', 'Ballygunge',   7, 'Bengali, Hindi, English', 1000, 1650, true, true, true, today-100,today-95, today-90),
    ('22222222-0000-4000-8000-000000000008', null, 'Shampa Roy', '+91 90000 00128', '700029', 'Ballygunge',   5, 'Bengali, English', 950, 1600, true, true, true, today-70, today-65, today-60),
    ('22222222-0000-4000-8000-000000000009', null, 'Rina Pal',   '+91 90000 00129', '700019', 'Gariahat',     3, 'Bengali, Hindi',   900, 1550, true, true, true, today-40, today-35, today-30),
    ('22222222-0000-4000-8000-000000000010', null, 'Tanushree G.', '+91 90000 00130', '700029', 'Ballygunge', 1, 'Bengali',         850, 1500, true, false, false, today-3, null, null)
  on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, phone = excluded.phone, pin_code = excluded.pin_code,
    area = excluded.area, years = excluded.years, languages = excluded.languages, rate_12 = excluded.rate_12, rate_24 = excluded.rate_24,
    id_checked = excluded.id_checked, police_checked = excluded.police_checked, training_done = excluded.training_done,
    id_checked_at = excluded.id_checked_at, police_checked_at = excluded.police_checked_at, training_done_at = excluded.training_done_at;

  -- three families
  insert into public.parents (id, family_id, elder_user_id, name, relation, age, address, pin_code, care_needs, emergency_contact, consent_by, consent_at)
  values
    (p_kamala, u_meera, u_kamala, 'Kamala Iyer', 'Amma', 78, '14, 3rd Main Road, Gandhi Nagar, Adyar, Chennai', '600020',
       array['Medicines','Mobility help','Meals'], 'Mrs. Rao (neighbour), +91 90000 00199', u_meera, now() - interval '30 days'),
    (p_ruma, u_arjun, null, 'Ruma Sen', 'Maa', 74, '22/1 Gariahat Road, Ballygunge, Kolkata', '700029',
       array['Medicines','Meals','Companionship'], 'Mr. Bose (neighbour), +91 90000 00198', u_arjun, now() - interval '25 days'),
    (p_imran, u_farah, null, 'Imran Khan', 'Abbu', 82, '7, Kalakshetra Colony, Thiruvanmiyur, Chennai', '600041',
       array['Medicines','Mobility help','Bathing'], 'Dr. Menon (family doctor), +91 90000 00197', u_farah, now() - interval '15 days');

  -- Kamala: an earlier block with Lakshmi, then the current block (renewed), day 10 of 14 today
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, status, rating, rating_comment, created_by)
  values (p_kamala, c_lakshmi, 12, today-23, 14, 1100, 1999, 1100*14+1999, 'completed', 5, 'Very patient with Amma. Always on time.', u_meera)
  returning id into b1;
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, renewed_from, created_by)
  values (p_kamala, c_lakshmi, 12, today-9, 14, 1100, 1999, 1100*14+1999, b1, u_meera)
  returning id into b2;
  -- Ruma: one finished block in Kolkata, not renewed
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, status, rating, created_by)
  values (p_ruma, c_mitali, 12, today-20, 14, 1000, 1999, 1000*14+1999, 'completed', 4, u_arjun)
  returning id into b3;
  -- Imran: 24-hour care, started with Selvi; Priya took over after a no-show
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, created_by)
  values (p_imran, c_priya, 24, today-12, 14, 1700, 1999, 1700*14+1999, u_farah)
  returning id into b4;

  -- shifts for every booking
  insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at, status)
  select b.id, b.parent_id, b.caregiver_id, d::date, public.ist_at(d::date,'08:00'),
         public.ist_at(d::date,'08:00') + make_interval(hours => b.shift_hours),
         case when d::date < today then 'completed' else 'scheduled' end
  from public.bookings b, generate_series(b.start_date, b.end_date, interval '1 day') d
  where b.id in (b1, b2, b3, b4);

  -- Imran: Selvi did days 0-4, missed day 5 at 08:00; Priya replaced by 10:00 and took the rest
  update public.shifts set caregiver_id = c_selvi where booking_id = b4 and shift_date < today-7;
  update public.shifts set status = 'missed', caregiver_id = c_selvi where booking_id = b4 and shift_date = today-7 returning id into missed;
  insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at, status, replacement_of)
  values (b4, p_imran, c_priya, today-7, public.ist_at(today-7,'10:00'), public.ist_at(today-6,'08:00'), 'completed', missed)
  returning id into rep;
  insert into public.alerts (parent_id, shift_id, type, raised_at, due_by, resolved_at, resolved_by, replacement_shift_id, note)
  values (p_imran, missed, 'no_show', public.ist_at(today-7,'08:30'), public.ist_at(today-7,'12:30'), public.ist_at(today-7,'08:41'),
          u_ravi, rep, 'Priya D. assigned, arriving by 10:00 am');
  -- Imran today: Priya is already checked in on the 24-hour shift
  update public.shifts set status = 'checked_in' where booking_id = b4 and shift_date = today;

  -- Kamala today: starts 10 minutes after the reset so the demo can show check-in or a missed shift live
  update public.shifts set start_at = date_trunc('minute', now()) + interval '10 minutes',
                           end_at = date_trunc('minute', now()) + interval '12 hours 10 minutes'
  where booking_id = b2 and shift_date = today;

  -- visits, tasks and readings for every completed or checked-in shift (photo 'sample' shows the sample door photo)
  for s in select sh.*, p.care_tasks from public.shifts sh join public.parents p on p.id = sh.parent_id
           where sh.booking_id in (b1,b2,b3,b4) and sh.status in ('completed','checked_in') loop
    i := (extract(day from s.shift_date)::int % 7);
    insert into public.visits (shift_id, parent_id, caregiver_id, check_in_at, lat, lng, accuracy_m, photo_path, tasks, check_out_at)
    values (s.id, s.parent_id, s.caregiver_id, s.start_at - make_interval(mins => 6 - i),
            case when s.parent_id = p_ruma then 22.5196 when s.parent_id = p_imran then 12.9830 else 13.0067 end + i * 0.00001,
            case when s.parent_id = p_ruma then 88.3657 when s.parent_id = p_imran then 80.2594 else 80.2571 end,
            12 + i, 'sample',
            jsonb_build_object(s.care_tasks[1], s.start_at + interval '20 minutes', s.care_tasks[2], s.start_at + interval '45 minutes',
                               s.care_tasks[3], s.start_at + interval '2 hours', s.care_tasks[4], s.start_at + interval '5 hours'),
            case when s.status = 'completed' then s.end_at + make_interval(mins => i) end)
    returning id into vid;
    insert into public.readings (visit_id, parent_id, bp_systolic, bp_diastolic, sugar, recorded_at)
    values (vid, s.parent_id, 124 + i * 2, 78 + i, 128 + i * 4, s.start_at + interval '2 hours 30 minutes');
  end loop;

  update public.settings set no_show_minutes = 30 where id = 1;
  return 'Demo data reset for ' || to_char(today, 'DD Mon YYYY') || '. Kamala''s shift starts at '
         || to_char((date_trunc('minute', now()) + interval '10 minutes') at time zone 'Asia/Kolkata', 'HH12:MI am') || '.';
end $$;

revoke execute on function public.demo_user, public.reset_demo_data from public, anon, authenticated;
grant execute on function public.reset_demo_data to authenticated;

select public.reset_demo_data();

-- ===== 20261104000006_fixes.sql =====
-- Fix 1: in the storage policies, "name" inside a subquery on parents referred to parents.name,
-- so families could not open their own check-in photos. Qualify it as objects.name.
drop policy if exists checkins_read on storage.objects;
drop policy if exists checkins_delete_family on storage.objects;
create policy checkins_read on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and (
    public.is_staff()
    or exists (select 1 from public.parents p where p.id::text = (storage.foldername(objects.name))[1] and p.family_id = auth.uid())
    or exists (select 1 from public.shifts s where s.id::text = (storage.foldername(objects.name))[2] and s.caregiver_id = public.my_caregiver_id())));
create policy checkins_delete_family on storage.objects for delete to authenticated
  using (bucket_id = 'checkins' and exists (
    select 1 from public.parents p where p.id::text = (storage.foldername(objects.name))[1] and p.family_id = auth.uid()));

-- Fix 2 (BR1, one booking per address at a time): refuse a booking that overlaps an active one for the same parent.
create or replace function public.book_care(p_parent uuid, p_caregiver uuid, p_hours int, p_start date, p_days int default 14)
returns uuid language plpgsql security definer set search_path = public as $$
declare cg public.caregivers; bid uuid; rate numeric; fee numeric; i int; d date; clash public.bookings;
begin
  if public.my_role() is distinct from 'family' or not exists (select 1 from public.parents where id = p_parent and family_id = auth.uid()) then
    raise exception 'You can only book care for your own parent';
  end if;
  if p_hours not in (12,24) then raise exception 'Shifts are 12 or 24 hours'; end if;
  if coalesce(p_days,0) < 14 then raise exception 'Bookings are a minimum of 14 days'; end if;
  if p_start < (now() at time zone 'Asia/Kolkata')::date then raise exception 'Start date cannot be in the past'; end if;
  select * into clash from public.bookings
   where parent_id = p_parent and status = 'active' and start_date <= p_start + p_days - 1 and end_date >= p_start
   order by end_date desc limit 1;
  if found then
    raise exception 'Care is already booked until %. Choose a start date from % or renew the current block.',
      to_char(clash.end_date, 'FMDD Mon'), to_char(clash.end_date + 1, 'FMDD Mon');
  end if;
  select * into cg from public.caregivers where id = p_caregiver;
  if not found or not cg.verified then raise exception 'This caregiver is not fully verified yet'; end if;
  rate := case when p_hours = 12 then cg.rate_12 else cg.rate_24 end;
  select membership_fee into fee from public.settings where id = 1;
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, created_by)
  values (p_parent, p_caregiver, p_hours, p_start, p_days, rate, fee, rate * p_days + fee, auth.uid())
  returning id into bid;
  for i in 0 .. p_days - 1 loop
    d := p_start + i;
    insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at)
    values (bid, p_parent, p_caregiver, d, public.ist_at(d,'08:00'), public.ist_at(d,'08:00') + make_interval(hours => p_hours));
  end loop;
  return bid;
end $$;

-- finish_block renews from the day after the block ends, so it does not clash with itself.
create or replace function public.finish_block(p_booking uuid, p_rating int, p_comment text, p_renew boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.bookings; nb uuid;
begin
  select bk.* into b from public.bookings bk join public.parents p on p.id = bk.parent_id
  where bk.id = p_booking and p.family_id = auth.uid();
  if not found then raise exception 'This is not your booking'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a rating from 1 to 5'; end if;
  update public.bookings set rating = p_rating, rating_comment = p_comment,
    status = case when end_date < (now() at time zone 'Asia/Kolkata')::date then 'completed' else status end
  where id = b.id;
  if p_renew then
    if exists (select 1 from public.bookings where renewed_from = b.id) then raise exception 'This block has already been renewed'; end if;
    nb := public.book_care(b.parent_id, b.caregiver_id, b.shift_hours, greatest(b.end_date + 1, (now() at time zone 'Asia/Kolkata')::date), 14);
    update public.bookings set renewed_from = b.id where id = nb;
  end if;
  return nb;
end $$;

revoke execute on function public.book_care, public.finish_block from public, anon;
grant execute on function public.book_care, public.finish_block to authenticated;

-- ===== 20261105000007_demo_link.sql =====
-- One-tap demo reset for presentations: https://kincare-glim.vercel.app/demo
-- Anyone with the link can call it, which is acceptable because it only touches the invented demo accounts,
-- whose password is already shown on the sign-in page. A 15-second cooldown stops repeated taps.

alter table public.settings add column if not exists demo_reset_at timestamptz;

create or replace function public.reset_demo(p_minutes int default 30)
returns text language plpgsql security definer set search_path = public as $$
declare last timestamptz; msg text;
begin
  if p_minutes is null or p_minutes not in (2, 5, 10, 30) then
    raise exception 'The missed check-in alert can be 2, 5, 10 or 30 minutes';
  end if;
  select demo_reset_at into last from public.settings where id = 1 for update;
  if last is not null and last > now() - interval '15 seconds' then
    raise exception 'The demo was reset a few seconds ago. Wait a moment and try again.';
  end if;

  msg := public.reset_demo_data();

  -- caregivers that demo staff added during a rehearsal, as long as nothing real points at them
  delete from public.caregivers c
  where c.created_by in ('11111111-0000-4000-8000-000000000031', '11111111-0000-4000-8000-000000000041')
    and c.id::text not like '22222222-0000-4000-8000-%'
    and not exists (select 1 from public.shifts s where s.caregiver_id = c.id)
    and not exists (select 1 from public.bookings b where b.caregiver_id = c.id)
    and not exists (select 1 from public.visits v where v.caregiver_id = c.id);

  update public.settings set no_show_minutes = p_minutes, demo_reset_at = now() where id = 1;
  return msg;
end $$;

revoke execute on function public.reset_demo(int) from public;
grant execute on function public.reset_demo(int) to anon, authenticated;

-- ===== 20261105000008_callbacks.sql =====
-- "Request a call" from the landing page. A visitor leaves a name and phone number; the request lands on
-- the coordinator's Call requests page, where they record the call. Only staff can read the requests.

create table if not exists public.callbacks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  phone text not null check (phone ~ '^\+?[0-9]{10,13}$'),
  city text not null check (city in ('Chennai', 'Kolkata', 'Other')),
  note text check (note is null or length(note) <= 300),
  status text not null default 'new' check (status in ('new', 'called', 'closed')),
  outcome text check (outcome is null or length(outcome) <= 300),
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists callbacks_status_idx on public.callbacks (status, created_at);

alter table public.callbacks enable row level security;
revoke all on public.callbacks from anon, authenticated;
grant select on public.callbacks to authenticated;
drop policy if exists callbacks_staff_read on public.callbacks;
create policy callbacks_staff_read on public.callbacks for select to authenticated using (public.is_staff());

create or replace function public.request_callback(p_name text, p_phone text, p_city text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
begin
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your name.'; end if;
  if ph !~ '^\+?[0-9]{10,13}$' then raise exception 'Enter a 10-digit mobile number, or include the country code.'; end if;
  if p_city not in ('Chennai', 'Kolkata', 'Other') then raise exception 'Choose where your parent lives.'; end if;
  if exists (select 1 from public.callbacks where phone = ph and created_at > now() - interval '30 minutes') then
    return 'already';
  end if;
  if (select count(*) from public.callbacks where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'We are receiving a lot of requests. Try again in a few minutes.';
  end if;
  insert into public.callbacks (name, phone, city, note) values (trim(p_name), ph, p_city, nullif(trim(coalesce(p_note, '')), ''));
  return 'ok';
end $$;

create or replace function public.set_callback(p_id uuid, p_status text, p_outcome text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only coordinators can update call requests'; end if;
  if p_status not in ('new', 'called', 'closed') then raise exception 'Unknown status'; end if;
  update public.callbacks set status = p_status, outcome = coalesce(nullif(trim(coalesce(p_outcome, '')), ''), outcome),
    handled_by = case when p_status = 'new' then null else auth.uid() end,
    handled_at = case when p_status = 'new' then null else now() end
  where id = p_id;
  if not found then raise exception 'This call request no longer exists'; end if;
end $$;

revoke execute on function public.request_callback(text, text, text, text), public.set_callback(uuid, text, text) from public;
grant execute on function public.request_callback(text, text, text, text) to anon, authenticated;
grant execute on function public.set_callback(uuid, text, text) to authenticated;
