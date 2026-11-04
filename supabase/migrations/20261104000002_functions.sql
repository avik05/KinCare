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
