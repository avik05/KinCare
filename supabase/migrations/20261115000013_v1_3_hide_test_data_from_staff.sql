-- v1.3, bug B13 (found during T05): while someone is taking the user test at /try, their sample parent,
-- alert and caregivers showed in the coordinator's queue and caregiver list, and were counted in the KPIs
-- (one tester moved visits from 50 to 60 and no-shows from 1 to 2). Staff now never see user-test data;
-- the tester still sees their own sandbox.
create or replace function public.is_test_user(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_uid is not null and exists (select 1 from public.uat_sessions u where u.user_id = p_uid)
$$;
create or replace function public.is_test_parent(p_parent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parents p join public.uat_sessions u on u.user_id = p.family_id where p.id = p_parent)
$$;
revoke execute on function public.is_test_user, public.is_test_parent from public, anon;
grant execute on function public.is_test_user, public.is_test_parent to authenticated;

drop policy if exists alerts_read on public.alerts;
create policy alerts_read on public.alerts for select to authenticated
  using (public.owns_parent(parent_id) or (public.is_staff() and not public.is_test_parent(parent_id)));

drop policy if exists caregivers_read on public.caregivers;
create policy caregivers_read on public.caregivers for select to authenticated
  using ((verified and not public.is_test_caregiver_of_other(created_by))
         or (public.is_staff() and not public.is_test_user(created_by))
         or user_id = auth.uid()
         or exists (select 1 from public.shifts s where s.caregiver_id = caregivers.id and public.owns_parent(s.parent_id)));

create or replace function public.kpis()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; mins int;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Only the Care Operations head can see KPIs'; end if;
  select no_show_minutes into mins from public.settings where id = 1;
  select jsonb_build_object(
    'alert_minutes', (select round(avg(extract(epoch from (a.raised_at - s.start_at))/60)::numeric, 1)
                      from public.alerts a join public.shifts s on s.id = a.shift_id
                      where a.type = 'no_show' and a.raised_at > now() - interval '30 days' and not public.is_test_parent(a.parent_id)),
    'no_show_minutes', mins,
    'no_shows', (select count(*) from public.alerts where type='no_show' and raised_at > now() - interval '30 days' and not public.is_test_parent(parent_id)),
    'replaced_in_time', (select count(*) from public.alerts a join public.shifts r on r.id = a.replacement_shift_id
                         where a.type='no_show' and a.raised_at > now() - interval '30 days' and r.start_at <= a.raised_at + interval '4 hours' and not public.is_test_parent(a.parent_id)),
    'visits_due', (select count(*) from public.shifts where status in ('checked_in','completed') and start_at > now() - interval '30 days' and not public.is_test_parent(parent_id)),
    'visits_full', (select count(*) from public.visits v where v.check_in_at > now() - interval '30 days' and v.photo_path is not null and not public.is_test_parent(v.parent_id)
                    and v.lat is not null and jsonb_typeof(v.tasks) = 'object' and v.tasks <> '{}'::jsonb),
    'families_first_block', (select count(distinct p.family_id) from public.bookings b join public.parents p on p.id=b.parent_id
                             where b.renewed_from is null and b.end_date < (now() at time zone 'Asia/Kolkata')::date and not public.is_test_user(p.family_id)),
    'families_renewed', (select count(distinct p.family_id) from public.bookings b join public.parents p on p.id=b.parent_id
                         where b.renewed_from is not null and not public.is_test_user(p.family_id)),
    'open_alerts', (select count(*) from public.alerts where resolved_at is null and not public.is_test_parent(parent_id)),
    'escalations', (select count(*) from public.alerts where level='escalated' and resolved_at is null and not public.is_test_parent(parent_id))
  ) into r;
  return r;
end $$;
