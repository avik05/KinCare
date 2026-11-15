-- v1.1, bug B03 (found while testing B01): the sample caregivers made for one user-test session were listed to every family.
-- A caregiver created for a test session is now visible only to that tester (and to staff).
create or replace function public.is_test_caregiver_of_other(p_created_by uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_created_by is not null and p_created_by <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and exists (select 1 from public.uat_sessions u where u.user_id = p_created_by)
$$;
revoke execute on function public.is_test_caregiver_of_other from public, anon;
grant execute on function public.is_test_caregiver_of_other to authenticated;

drop policy if exists caregivers_read on public.caregivers;
create policy caregivers_read on public.caregivers for select to authenticated
  using ((verified and not public.is_test_caregiver_of_other(created_by))
         or public.is_staff() or user_id = auth.uid()
         or exists (select 1 from public.shifts s where s.caregiver_id = caregivers.id and public.owns_parent(s.parent_id)));
