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
