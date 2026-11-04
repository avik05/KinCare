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
