-- "Request a call" from the landing page. A visitor leaves a name and phone number; the request lands on
-- the coordinator's Call requests page, where they record the call. Only staff can read the requests.

create table if not exists public.callbacks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  phone text not null check (phone ~ '^\+?[0-9]{10,13}$'),
  city text not null check (city in ('Chennai', 'Kolkata', 'Other')),
  note text check (note is null or length(note) <= 300),
  status text not null default 'new' check (status in ('new', 'called', 'closed')),
  outcome text check (outcome is null or length(outcome) <= 300),
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists callbacks_status_idx on public.callbacks (status, created_at);

alter table public.callbacks enable row level security;
revoke all on public.callbacks from anon, authenticated;
grant select on public.callbacks to authenticated;
drop policy if exists callbacks_staff_read on public.callbacks;
create policy callbacks_staff_read on public.callbacks for select to authenticated using (public.is_staff());

create or replace function public.request_callback(p_name text, p_phone text, p_city text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g');
begin
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your name.'; end if;
  if ph !~ '^\+?[0-9]{10,13}$' then raise exception 'Enter a 10-digit mobile number, or include the country code.'; end if;
  if p_city not in ('Chennai', 'Kolkata', 'Other') then raise exception 'Choose where your parent lives.'; end if;
  if exists (select 1 from public.callbacks where phone = ph and created_at > now() - interval '30 minutes') then
    return 'already';
  end if;
  if (select count(*) from public.callbacks where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'We are receiving a lot of requests. Try again in a few minutes.';
  end if;
  insert into public.callbacks (name, phone, city, note) values (trim(p_name), ph, p_city, nullif(trim(coalesce(p_note, '')), ''));
  return 'ok';
end $$;

create or replace function public.set_callback(p_id uuid, p_status text, p_outcome text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Only coordinators can update call requests'; end if;
  if p_status not in ('new', 'called', 'closed') then raise exception 'Unknown status'; end if;
  update public.callbacks set status = p_status, outcome = coalesce(nullif(trim(coalesce(p_outcome, '')), ''), outcome),
    handled_by = case when p_status = 'new' then null else auth.uid() end,
    handled_at = case when p_status = 'new' then null else now() end
  where id = p_id;
  if not found then raise exception 'This call request no longer exists'; end if;
end $$;

revoke execute on function public.request_callback(text, text, text, text), public.set_callback(uuid, text, text) from public;
grant execute on function public.request_callback(text, text, text, text) to anon, authenticated;
grant execute on function public.set_callback(uuid, text, text) to authenticated;
