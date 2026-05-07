create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  initialized boolean default false
);

create table if not exists public.habit_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  icon text,
  label text,
  sort_order integer,
  created_at timestamptz default now()
);

create table if not exists public.pinned_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text,
  sort_order integer,
  created_at timestamptz default now()
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  slept text,
  woke text,
  goal text,
  tasks jsonb,
  pinned_done jsonb,
  meals jsonb,
  habits jsonb,
  notes text,
  win text,
  tmr text,
  updated_at timestamptz default now(),
  unique (user_id, entry_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists daily_entries_set_updated_at on public.daily_entries;
create trigger daily_entries_set_updated_at
before update on public.daily_entries
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.habit_definitions enable row level security;
alter table public.pinned_tasks enable row level security;
alter table public.daily_entries enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
using (auth.uid() = id);

drop policy if exists "habit_definitions_select_own" on public.habit_definitions;
create policy "habit_definitions_select_own"
on public.habit_definitions
for select
using (auth.uid() = user_id);

drop policy if exists "habit_definitions_insert_own" on public.habit_definitions;
create policy "habit_definitions_insert_own"
on public.habit_definitions
for insert
with check (auth.uid() = user_id);

drop policy if exists "habit_definitions_update_own" on public.habit_definitions;
create policy "habit_definitions_update_own"
on public.habit_definitions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "habit_definitions_delete_own" on public.habit_definitions;
create policy "habit_definitions_delete_own"
on public.habit_definitions
for delete
using (auth.uid() = user_id);

drop policy if exists "pinned_tasks_select_own" on public.pinned_tasks;
create policy "pinned_tasks_select_own"
on public.pinned_tasks
for select
using (auth.uid() = user_id);

drop policy if exists "pinned_tasks_insert_own" on public.pinned_tasks;
create policy "pinned_tasks_insert_own"
on public.pinned_tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "pinned_tasks_update_own" on public.pinned_tasks;
create policy "pinned_tasks_update_own"
on public.pinned_tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "pinned_tasks_delete_own" on public.pinned_tasks;
create policy "pinned_tasks_delete_own"
on public.pinned_tasks
for delete
using (auth.uid() = user_id);

drop policy if exists "daily_entries_select_own" on public.daily_entries;
create policy "daily_entries_select_own"
on public.daily_entries
for select
using (auth.uid() = user_id);

drop policy if exists "daily_entries_insert_own" on public.daily_entries;
create policy "daily_entries_insert_own"
on public.daily_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_entries_update_own" on public.daily_entries;
create policy "daily_entries_update_own"
on public.daily_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_entries_delete_own" on public.daily_entries;
create policy "daily_entries_delete_own"
on public.daily_entries
for delete
using (auth.uid() = user_id);
