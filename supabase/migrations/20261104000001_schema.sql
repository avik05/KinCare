-- KinCare schema. Tables follow docs/data-schema.pdf.
create extension if not exists pgcrypto;

create table public.settings (
  id int primary key default 1 check (id = 1),
  no_show_minutes int not null default 30 check (no_show_minutes between 1 and 120),
  replacement_hours int not null default 4,
  membership_fee numeric(10,2) not null default 1999
);
insert into public.settings (id) values (1) on conflict do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'family' check (role in ('family','elder','caregiver','coordinator','admin')),
  full_name text not null default '',
  phone text,
  city text,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  elder_user_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(name) between 2 and 80),
  relation text not null default 'Parent',
  age int check (age between 40 and 120),
  address text not null,
  pin_code text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  care_needs text[] not null default '{}',
  care_tasks text[] not null default array['Morning medicines','Breakfast','Short walk','Lunch'],
  emergency_contact text,
  consent_by uuid not null references public.profiles(id),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.caregivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  initials text generated always as (upper(left(split_part(name,' ',1),1) || left(split_part(name,' ',2),1))) stored,
  phone text,
  pin_code text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  area text,
  years int not null default 0,
  languages text not null default '',
  rate_12 numeric(10,2) not null check (rate_12 > 0),
  rate_24 numeric(10,2) not null check (rate_24 > 0),
  id_checked boolean not null default false,
  police_checked boolean not null default false,
  training_done boolean not null default false,
  verified boolean generated always as (id_checked and police_checked and training_done) stored,
  id_checked_at date, police_checked_at date, training_done_at date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id),
  shift_hours int not null check (shift_hours in (12,24)),
  start_date date not null,
  days int not null check (days >= 14),
  end_date date generated always as (start_date + days - 1) stored,
  day_rate numeric(10,2) not null,
  membership_fee numeric(10,2) not null,
  total_amount numeric(12,2) not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  renewed_from uuid references public.bookings(id) on delete set null,
  rating int check (rating between 1 and 5),
  rating_comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id),
  shift_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','checked_in','completed','missed','reassigned')),
  replacement_of uuid references public.shifts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index shifts_caregiver_idx on public.shifts (caregiver_id, start_at);
create index shifts_parent_idx on public.shifts (parent_id, start_at);
create index shifts_due_idx on public.shifts (status, start_at);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  caregiver_id uuid not null references public.caregivers(id),
  check_in_at timestamptz not null default now(),
  lat double precision, lng double precision, accuracy_m double precision,
  photo_path text,
  tasks jsonb not null default '{}'::jsonb,       -- {"Morning medicines": "2026-11-05T08:20:00Z", ...}
  check_out_at timestamptz
);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  bp_systolic int check (bp_systolic between 60 and 260),
  bp_diastolic int check (bp_diastolic between 30 and 160),
  sugar int check (sugar between 20 and 600),
  recorded_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  type text not null check (type in ('no_show','sos')),
  level text not null default 'coordinator' check (level in ('coordinator','escalated')),
  raised_at timestamptz not null default now(),
  due_by timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  replacement_shift_id uuid references public.shifts(id) on delete set null,
  note text
);
create unique index alerts_one_per_shift on public.alerts (shift_id, type) where shift_id is not null;
create index alerts_open_idx on public.alerts (resolved_at, raised_at);
