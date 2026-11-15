-- v1.1, bug B01 (found in M4 scenario SC05): the same caregiver could be booked by two families for the same dates.
-- A caregiver can now be booked only on days she has no other shift. The check runs inside the database,
-- with a lock per caregiver, so two families pressing Confirm at the same moment cannot both get her.

-- Caregivers who already have a shift on any day of the requested block (ids only; no family's details are exposed).
create or replace function public.caregivers_busy(p_start date, p_days int, p_parent uuid default null)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct s.caregiver_id from public.shifts s
  where s.status in ('scheduled', 'checked_in')
    and s.shift_date between p_start and p_start + greatest(coalesce(p_days, 14), 1) - 1
    and (p_parent is null or s.parent_id <> p_parent)
$$;

create or replace function public.book_care(p_parent uuid, p_caregiver uuid, p_hours int, p_start date, p_days int default 14)
returns uuid language plpgsql security definer set search_path = public as $$
declare cg public.caregivers; bid uuid; rate numeric; fee numeric; i int; d date; clash public.bookings; busy date;
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
  -- B01: one family at a time per caregiver and day
  perform pg_advisory_xact_lock(hashtext(p_caregiver::text));
  select min(s.shift_date) into busy from public.shifts s
   where s.caregiver_id = p_caregiver and s.status in ('scheduled', 'checked_in') and s.parent_id <> p_parent
     and s.shift_date between p_start and p_start + p_days - 1;
  if busy is not null then
    raise exception '% is already booked by another family on %. Choose another caregiver or a later start date.',
      cg.name, to_char(busy, 'FMDD Mon');
  end if;
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

revoke execute on function public.book_care, public.caregivers_busy from public, anon;
grant execute on function public.book_care, public.caregivers_busy to authenticated;
