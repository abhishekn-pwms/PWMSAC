-- APPEND THIS INTO YOUR EXISTING 4001_RLS_AllTables.sql
-- Per the folder's own principle: one single combined RLS file for
-- every table, edited in place — not a new 4002 file.

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
-- Add to STEP 2 (Enable RLS)
-- ==========================================================================

alter table personal_profile enable row level security;
alter table employment_history enable row level security;
alter table attendance_codes enable row level security;
alter table holiday_master enable row level security;
alter table attendance_log enable row level security;
