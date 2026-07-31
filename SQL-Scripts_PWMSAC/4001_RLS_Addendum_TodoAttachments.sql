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
