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
