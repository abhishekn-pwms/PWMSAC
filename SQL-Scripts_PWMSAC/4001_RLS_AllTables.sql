-- 4001_RLS_AllTables.sql
-- Single combined RLS step for every table — deliberately separate from
-- schema/data so a from-scratch rebuild can create tables and load seed
-- data before security is switched on, rather than fighting RLS while
-- seeding.
--
-- DROP POLICY IF EXISTS before each CREATE POLICY — Postgres has no
-- CREATE POLICY IF NOT EXISTS, so without this guard, re-running this
-- file a second time (e.g. after a partial rebuild) would error out on
-- "policy already exists" and halt partway through.

-- ==========================================================================
-- STEP 1: Policies (permissive single-user pattern, same for every table)
-- ==========================================================================

drop policy if exists "Universal manage on portfolio" on portfolio;
create policy "Universal manage on portfolio" on portfolio
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on project" on project;
create policy "Universal manage on project" on project
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on milestone" on milestone;
create policy "Universal manage on milestone" on milestone
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on activity" on activity;
create policy "Universal manage on activity" on activity
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on todo" on todo;
create policy "Universal manage on todo" on todo
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on task_log" on task_log;
create policy "Universal manage on task_log" on task_log
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on update_prep_settings" on update_prep_settings;
create policy "Universal manage on update_prep_settings" on update_prep_settings
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on update_prep_history" on update_prep_history;
create policy "Universal manage on update_prep_history" on update_prep_history
    for all to public using (true) with check (true);

-- ==========================================================================
-- STEP 2: Enable RLS (the security wall itself)
-- ==========================================================================

alter table portfolio enable row level security;
alter table project enable row level security;
alter table milestone enable row level security;
alter table activity enable row level security;
alter table todo enable row level security;
alter table task_log enable row level security;
alter table update_prep_settings enable row level security;
alter table update_prep_history enable row level security;


-- ==========================================================================
-- ATTENDANCE MODULE
-- ==========================================================================

-- Same pattern as above — permissive policy first, then RLS enabled,
-- for each of the 5 attendance tables.

-- ==========================================================================
-- Add to STEP 1 (Policies)
-- ==========================================================================

drop policy if exists "Universal manage on personal_profile" on personal_profile;
create policy "Universal manage on personal_profile" on personal_profile
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on employment_history" on employment_history;
create policy "Universal manage on employment_history" on employment_history
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on attendance_codes" on attendance_codes;
create policy "Universal manage on attendance_codes" on attendance_codes
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on holiday_master" on holiday_master;
create policy "Universal manage on holiday_master" on holiday_master
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on attendance_log" on attendance_log;
create policy "Universal manage on attendance_log" on attendance_log
    for all to public using (true) with check (true);

-- ==========================================================================
-- STEP 2 (Enable RLS), continued
-- ==========================================================================

alter table personal_profile enable row level security;
alter table employment_history enable row level security;
alter table attendance_codes enable row level security;
alter table holiday_master enable row level security;
alter table attendance_log enable row level security;


-- 4001_RLS_Addendum_TodoAttachments.sql
-- Per the folder's own principle: one single combined RLS file for
-- every table — fold this into 4001_RLS_AllTables.sql directly, not a
-- new 4002 file.
--
-- Storage RLS works differently from a normal table: policies live on
-- storage.objects, scoped by bucket_id, rather than on the bucket
-- itself. Same permissive single-user "Universal manage" pattern as
-- every other table in this app — this isn't a multi-tenant product,
-- so there's no real per-row security being enforced anywhere else
-- either.

-- ==========================================================================
-- STEP 0: Create the bucket itself
-- ==========================================================================
-- Equivalent to clicking "New Bucket" in the Storage UI — kept as SQL
-- so the whole setup stays in this folder rather than requiring a
-- separate manual dashboard step. "public" here means anyone with the
-- direct file URL can view it without auth — kept false, since access
-- is meant to go through the app (and RLS below), not a bare public URL.

insert into storage.buckets (id, name, public)
values ('todo-attachments', 'todo-attachments', false)
on conflict (id) do nothing;

-- ==========================================================================
-- Add to STEP 1 (Policies)
-- ==========================================================================

drop policy if exists "Universal manage on todo_attachments" on todo_attachments;
create policy "Universal manage on todo_attachments" on todo_attachments
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on todo-attachments bucket" on storage.objects;
create policy "Universal manage on todo-attachments bucket" on storage.objects
    for all to public
    using (bucket_id = 'todo-attachments')
    with check (bucket_id = 'todo-attachments');

-- ==========================================================================
-- Add to STEP 2 (Enable RLS)
-- ==========================================================================

alter table todo_attachments enable row level security;

-- storage.objects already has RLS enabled by default in every Supabase
-- project — no ALTER TABLE needed here, only the policy above.


