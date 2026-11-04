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
