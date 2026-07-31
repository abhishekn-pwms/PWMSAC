-- 4001_RLS_Addendum_UpdatePrepAttachments.sql
-- Per the folder's own principle: one single combined RLS file for
-- every table — fold this into 4001_RLS_AllTables.sql directly, not
-- a new file alongside it.
--
-- Same permissive single-user "Universal manage" pattern as every
-- other table in this app, including todo_attachments.

-- ==========================================================================
-- STEP 0: Create the bucket itself
-- ==========================================================================
-- "public" kept false, same reasoning as todo-attachments — access is
-- meant to go through the app (signed URLs + RLS below), not a bare
-- public URL.

insert into storage.buckets (id, name, public)
values ('updateprep-attachments', 'updateprep-attachments', false)
on conflict (id) do nothing;

-- ==========================================================================
-- Add to STEP 1 (Policies)
-- ==========================================================================

drop policy if exists "Universal manage on update_prep_attachments" on update_prep_attachments;
create policy "Universal manage on update_prep_attachments" on update_prep_attachments
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on updateprep-attachments bucket" on storage.objects;
create policy "Universal manage on updateprep-attachments bucket" on storage.objects
    for all to public
    using (bucket_id = 'updateprep-attachments')
    with check (bucket_id = 'updateprep-attachments');

-- ==========================================================================
-- Add to STEP 2 (Enable RLS)
-- ==========================================================================

alter table update_prep_attachments enable row level security;

-- storage.objects already has RLS enabled by default in every
-- Supabase project — no ALTER TABLE needed here, only the policy
-- above.
