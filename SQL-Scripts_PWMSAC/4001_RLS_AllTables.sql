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


