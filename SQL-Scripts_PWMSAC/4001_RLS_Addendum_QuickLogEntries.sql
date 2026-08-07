-- 4001_RLS_Addendum_QuickLogEntries.sql
-- Per the folder's own principle: fold this into 4001_RLS_AllTables.sql
-- directly, not a new file alongside it.

-- ==========================================================================
-- Add to STEP 1 (Policies)
-- ==========================================================================

drop policy if exists "Universal manage on quicklog_entries" on quicklog_entries;
create policy "Universal manage on quicklog_entries" on quicklog_entries
    for all to public using (true) with check (true);

-- ==========================================================================
-- Add to STEP 2 (Enable RLS)
-- ==========================================================================

alter table quicklog_entries enable row level security;
