-- v1.3: three fixes found in L3 scenario testing on 15 Nov.
--   B08 (SC10) Pressing SOS again while help is already on the way created a second, third... open alert.
--   B09 (SC11) A replacement could be given an arrival time in the past, or after the shift ends.
--   B10 (SC13) A replacement could be a caregiver already booked by another family for the rest of the block.
--   B11 (cosmetic) The alert note showed "08:53 pm" instead of "8:53 pm".
--   Hardening (SC01 passed on v1.2): the alert row is locked, so two coordinators can never both assign.

-- B08: one open SOS per parent. A repeat press within 30 minutes returns the open alert instead of adding another.
create or replace function public.raise_sos()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; aid uuid;
begin
  select id into pid from public.parents where elder_user_id = auth.uid() limit 1;
  if pid is null then raise exception 'No parent profile is linked to this account'; end if;
  perform pg_advisory_xact_lock(hashtext('sos' || pid::text));
  select id into aid from public.alerts
   where parent_id = pid and type = 'sos' and resolved_at is null and raised_at > now() - interval '30 minutes'
   order by raised_at desc limit 1;
  if aid is not null then return aid; end if;
  insert into public.alerts (parent_id, type) values (pid, 'sos') returning id into aid;
  return aid;
end $$;

-- B09, B10, B11
create or replace function public.assign_replacement(p_alert uuid, p_caregiver uuid, p_arrive timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.alerts; s public.shifts; cg public.caregivers; new_id uuid; busy date;
begin
  if not public.is_staff() then raise exception 'Only coordinators can assign replacements'; end if;
  -- B10: lock the alert row, so a second coordinator waits and then finds it already resolved.
  select * into a from public.alerts where id = p_alert for update;
  if not found or a.shift_id is null then raise exception 'This alert has no shift to replace'; end if;
  if a.resolved_at is not null then raise exception 'Another coordinator has already handled this alert'; end if;
  select * into cg from public.caregivers where id = p_caregiver;
  if not found or not cg.verified then raise exception 'Choose a fully verified caregiver'; end if;
  select * into s from public.shifts where id = a.shift_id;
  if cg.id = s.caregiver_id then raise exception 'Choose a different caregiver'; end if;
  -- B09: arrival must be from now (5 minutes' grace) and before the shift ends.
  if p_arrive < now() - interval '5 minutes' then raise exception 'The arrival time has already passed. Choose a later time.'; end if;
  if p_arrive >= s.end_at then raise exception 'The arrival time is after this shift ends. Choose an earlier time.'; end if;
  -- B10: the replacement takes over today and the rest of the block, so she must be free for all of it.
  perform pg_advisory_xact_lock(hashtext(cg.id::text));
  select min(o.shift_date) into busy from public.shifts o
   where o.caregiver_id = cg.id and o.parent_id <> s.parent_id and o.status in ('scheduled', 'checked_in')
     and o.shift_date between s.shift_date
         and coalesce((select max(x.shift_date) from public.shifts x where x.booking_id = s.booking_id), s.shift_date);
  if busy is not null then
    raise exception '% is booked by another family on %. Choose another caregiver.', cg.name, to_char(busy, 'FMDD Mon');
  end if;
  insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at, replacement_of)
  values (s.booking_id, s.parent_id, cg.id, s.shift_date, p_arrive, s.end_at, s.id)
  returning id into new_id;
  update public.shifts set caregiver_id = cg.id
    where booking_id = s.booking_id and status = 'scheduled' and start_at > s.end_at;
  update public.bookings set caregiver_id = cg.id where id = s.booking_id;
  update public.alerts set resolved_at = now(), resolved_by = auth.uid(), replacement_shift_id = new_id,
    note = cg.name || ' assigned, arriving by ' || lower(to_char(p_arrive at time zone 'Asia/Kolkata', 'FMHH12:MI am'))
  where id = a.id;
  return new_id;
end $$;

revoke execute on function public.raise_sos, public.assign_replacement from public, anon;
grant execute on function public.raise_sos, public.assign_replacement to authenticated;
