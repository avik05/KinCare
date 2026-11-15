-- Milestone 4, Layer 4: self-guided user acceptance test at /try.
-- Each tester signs in anonymously and gets a private sandbox family (a parent, 14 days of care, past visits,
-- today's missed visit and its replacement) at a pin code of their own, so testers never see each other's data.
-- Task times, answers and ratings are stored against an anonymous code (P1, P2 ...). No names, phones or emails.

-- Anonymous users have no email: give their profile a name instead of failing the not-null rule.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'family', coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Guest'))
  on conflict (id) do nothing;
  return new;
end $$;

create table if not exists public.uat_sessions (
  id uuid primary key default gen_random_uuid(),
  n int not null,
  code text not null unique,
  user_id uuid,
  pin_code text not null,
  profile jsonb not null default '{}'::jsonb,
  expected jsonb not null default '{}'::jsonb,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  rating_ease int check (rating_ease between 1 and 5),
  rating_useful int check (rating_useful between 1 and 5),
  would_use text check (would_use in ('Yes','Maybe','No')),
  pay text,
  comment text check (char_length(comment) <= 600),
  finished_at timestamptz,
  cleaned_at timestamptz
);

create table if not exists public.uat_events (
  id bigserial primary key,
  session_id uuid not null references public.uat_sessions(id) on delete cascade,
  task int not null check (task between 1 and 3),
  event text not null check (event in ('start','done','skip')),
  answer text check (char_length(answer) <= 300),
  at timestamptz not null default now()
);

alter table public.uat_sessions enable row level security;
alter table public.uat_events enable row level security;
drop policy if exists uat_sessions_staff on public.uat_sessions;
create policy uat_sessions_staff on public.uat_sessions for select using (public.is_staff());
drop policy if exists uat_events_staff on public.uat_events;
create policy uat_events_staff on public.uat_events for select using (public.is_staff());

-- Removes a tester's sandbox: their parents (cascades to bookings, shifts, visits, readings, alerts) and caregivers.
create or replace function public.uat_clear(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.parents where family_id = p_user;
  delete from public.caregivers where created_by = p_user;
end $$;

create or replace function public.uat_start(p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ses public.uat_sessions;
  nn int; pin text; pid uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; bid uuid;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  st timestamptz; missed uuid; rep uuid; vid uuid; s record; i int; rep_in timestamptz;
begin
  if uid is null then raise exception 'Sign-in failed. Reload the page and try again.'; end if;
  select * into ses from public.uat_sessions where user_id = uid;
  if found then
    return jsonb_build_object('code', ses.code, 'pin', ses.pin_code, 'expected', ses.expected);
  end if;
  if (select count(*) from public.uat_sessions where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many tests have started in the last hour. Try again later.';
  end if;

  perform pg_advisory_xact_lock(424242);
  select coalesce(max(n), 0) + 1 into nn from public.uat_sessions;
  pin := '6001' || lpad((nn % 100)::text, 2, '0');
  update public.profiles set role = 'family', full_name = 'Test family ' || nn, city = 'Singapore', phone = null where id = uid;

  -- caregivers only this tester sees (their own pin code); one is not fully verified, so it stays hidden (BR2)
  insert into public.caregivers (name, pin_code, area, years, languages, rate_12, rate_24, id_checked, police_checked, training_done,
                                 id_checked_at, police_checked_at, training_done_at, created_by)
  values ('Kavya N.', pin, 'Thiruvanmiyur', 5, 'Tamil, English', 1100, 1800, true, true, true, today-60, today-55, today-50, uid) returning id into c1;
  insert into public.caregivers (name, pin_code, area, years, languages, rate_12, rate_24, id_checked, police_checked, training_done,
                                 id_checked_at, police_checked_at, training_done_at, created_by)
  values ('Deepa R.', pin, 'Thiruvanmiyur', 7, 'Tamil, Hindi, English', 1200, 1900, true, true, true, today-90, today-80, today-70, uid) returning id into c2;
  insert into public.caregivers (name, pin_code, area, years, languages, rate_12, rate_24, id_checked, police_checked, training_done,
                                 id_checked_at, police_checked_at, training_done_at, created_by)
  values ('Sunita P.', pin, 'Besant Nagar', 4, 'Tamil, Telugu', 1000, 1700, true, true, true, today-40, today-35, today-30, uid) returning id into c3;
  insert into public.caregivers (name, pin_code, area, years, languages, rate_12, rate_24, id_checked, police_checked, training_done,
                                 id_checked_at, police_checked_at, training_done_at, created_by)
  values ('Meena V.', pin, 'Besant Nagar', 2, 'Tamil', 950, 1600, true, false, true, today-3, null, today-2, uid) returning id into c4;

  insert into public.parents (family_id, name, relation, age, address, pin_code, care_needs, emergency_contact, consent_by, consent_at)
  values (uid, 'Lalitha Rao', 'Amma', 76, '9, 2nd Cross Street, Kalakshetra Colony, Thiruvanmiyur, Chennai', pin,
          array['Medicines','Mobility help','Meals'], 'Mrs. Pillai (neighbour), +91 90000 00196', uid, now() - interval '12 days')
  returning id into pid;

  -- 14-day block with Kavya: day 10 today
  insert into public.bookings (parent_id, caregiver_id, shift_hours, start_date, days, day_rate, membership_fee, total_amount, created_by)
  values (pid, c1, 12, today - 9, 14, 1100, 1999, 1100 * 14 + 1999, uid) returning id into bid;
  insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at, status)
  select bid, pid, c1, d::date, public.ist_at(d::date, '08:00'), public.ist_at(d::date, '08:00') + interval '12 hours',
         case when d::date < today then 'completed' else 'scheduled' end
  from generate_series(today - 9, today + 4, interval '1 day') d;

  -- past visits; yesterday's is fixed so task 2 has one right answer: check-in 8:04 am, BP 132/86
  for s in select sh.*, p.care_tasks from public.shifts sh join public.parents p on p.id = sh.parent_id
           where sh.booking_id = bid and sh.status = 'completed' loop
    i := case when s.shift_date = today - 1 then 4 else (extract(day from s.shift_date)::int % 7) - 3 end;
    insert into public.visits (shift_id, parent_id, caregiver_id, check_in_at, lat, lng, accuracy_m, photo_path, tasks, check_out_at)
    values (s.id, pid, c1, s.start_at + make_interval(mins => i), 12.9830, 80.2594, 10 + abs(i), 'sample',
            jsonb_build_object(s.care_tasks[1], s.start_at + interval '20 minutes', s.care_tasks[2], s.start_at + interval '45 minutes',
                               s.care_tasks[3], s.start_at + interval '2 hours', s.care_tasks[4], s.start_at + interval '5 hours'),
            s.end_at + interval '3 minutes')
    returning id into vid;
    insert into public.readings (visit_id, parent_id, bp_systolic, bp_diastolic, sugar, recorded_at)
    values (vid, pid,
            case when s.shift_date = today - 1 then 132 else 124 + abs(i) * 2 end,
            case when s.shift_date = today - 1 then 86 else 78 + abs(i) end,
            case when s.shift_date = today - 1 then 146 else 128 + abs(i) * 4 end,
            s.start_at + interval '2 hours 30 minutes');
  end loop;

  -- today: Kavya's shift started three hours ago and she did not come; Deepa replaced her (FR5, FR6)
  st := date_trunc('hour', now()) - interval '3 hours';
  update public.shifts set start_at = st, end_at = st + interval '12 hours', status = 'missed'
  where booking_id = bid and shift_date = today returning id into missed;
  rep_in := st + interval '1 hour 52 minutes';
  insert into public.shifts (booking_id, parent_id, caregiver_id, shift_date, start_at, end_at, status, replacement_of)
  values (bid, pid, c2, today, st + interval '2 hours', st + interval '12 hours', 'checked_in', missed) returning id into rep;
  insert into public.visits (shift_id, parent_id, caregiver_id, check_in_at, lat, lng, accuracy_m, photo_path, tasks)
  values (rep, pid, c2, rep_in, 12.9831, 80.2595, 11, 'sample', '{}'::jsonb);
  update public.shifts set caregiver_id = c2 where booking_id = bid and shift_date > today;
  insert into public.alerts (parent_id, shift_id, type, raised_at, due_by, resolved_at, replacement_shift_id, note)
  values (pid, missed, 'no_show', st + interval '30 minutes', st + interval '4 hours 30 minutes', st + interval '41 minutes', rep,
          'Deepa R. assigned, arriving by ' || to_char((st + interval '2 hours') at time zone 'Asia/Kolkata', 'FMHH12:MI am'));

  insert into public.uat_sessions (n, code, user_id, pin_code, profile, expected)
  values (nn, 'P' || nn, uid, pin, coalesce(p_profile, '{}'::jsonb),
          jsonb_build_object('t2_time', '8:04', 't2_bp', '132/86',
                             't3_name', 'Deepa', 't3_time', to_char(rep_in at time zone 'Asia/Kolkata', 'FMHH12:MI')))
  returning * into ses;
  return jsonb_build_object('code', ses.code, 'pin', pin, 'expected', ses.expected);
end $$;

create or replace function public.uat_log(p_task int, p_event text, p_answer text default null)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from public.uat_sessions where user_id = auth.uid() and finished_at is null;
  if sid is null then raise exception 'No test in progress'; end if;
  insert into public.uat_events (session_id, task, event, answer) values (sid, p_task, p_event, left(p_answer, 300));
end $$;

create or replace function public.uat_finish(p_ease int, p_useful int, p_would text, p_pay text, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update public.uat_sessions set rating_ease = p_ease, rating_useful = p_useful, would_use = p_would, pay = left(p_pay, 80),
         comment = left(nullif(trim(p_comment), ''), 600), finished_at = now(), cleaned_at = now(), user_id = null
  where user_id = uid and finished_at is null;
  if not found then raise exception 'No test in progress'; end if;
  perform public.uat_clear(uid);
  begin
    delete from auth.users where id = uid and coalesce(is_anonymous, false);
  exception when others then null;  -- the sandbox is already gone; the empty guest login is harmless
  end;
end $$;

-- Hourly: remove sandboxes of tests left unfinished for more than 3 hours (the timings already logged are kept).
create or replace function public.uat_cleanup()
returns int language plpgsql security definer set search_path = public as $$
declare r record; k int := 0;
begin
  for r in select id, user_id from public.uat_sessions where cleaned_at is null and created_at < now() - interval '3 hours' loop
    if r.user_id is not null then
      perform public.uat_clear(r.user_id);
      begin
        delete from auth.users where id = r.user_id and coalesce(is_anonymous, false);
      exception when others then null;
      end;
    end if;
    update public.uat_sessions set cleaned_at = now(), user_id = null where id = r.id;
    k := k + 1;
  end loop;
  return k;
end $$;

do $$ begin
  perform cron.unschedule('kincare-uat-cleanup');
exception when others then null;
end $$;
select cron.schedule('kincare-uat-cleanup', '17 * * * *', 'select public.uat_cleanup()');

revoke execute on function public.uat_clear, public.uat_cleanup from public, anon, authenticated;
revoke execute on function public.uat_start, public.uat_log, public.uat_finish from public, anon;
grant execute on function public.uat_start, public.uat_log, public.uat_finish to authenticated;
