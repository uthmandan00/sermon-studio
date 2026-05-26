-- Sermon Studio cloud sync schema.
-- Run this in the Supabase SQL Editor for the project that should store Sermon Studio data.

create extension if not exists pgcrypto;

create table if not exists public.sermon_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null default 'primary',
  data jsonb not null default '{}'::jsonb,
  pushed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

alter table public.sermon_workspaces enable row level security;

drop policy if exists "Users can read their sermon workspace." on public.sermon_workspaces;
drop policy if exists "Users can create their sermon workspace." on public.sermon_workspaces;
drop policy if exists "Users can update their sermon workspace." on public.sermon_workspaces;
drop policy if exists "Users can delete their sermon workspace." on public.sermon_workspaces;

create policy "Users can read their sermon workspace."
on public.sermon_workspaces
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their sermon workspace."
on public.sermon_workspaces
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their sermon workspace."
on public.sermon_workspaces
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their sermon workspace."
on public.sermon_workspaces
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.sermon_workspaces to authenticated;
