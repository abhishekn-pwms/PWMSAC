-- Setup_PwmsPrev_AttachmentTablesAndBuckets.sql
-- Run this against pwms_prev directly (NOT the live project) before
-- using Push to pwms_prev with the new attachment-file copying.
-- pwms_prev is a fully separate Supabase project, so it has neither
-- of these two tables nor either Storage bucket yet, even though
-- they've existed on live for a while.

-- ==========================================================================
-- TABLES — same shape as live's 1140_Create_TodoAttachments.sql and
-- 1150/1151_..._UpdatePrepAttachments.sql
-- ==========================================================================

create table if not exists todo_attachments (

    attachment_id uuid
        primary key
        default gen_random_uuid(),

    todo_id uuid
        not null
        references todo(todo_id)
        on delete cascade,

    file_name text
        not null,

    storage_path text
        not null,

    file_size bigint,

    label text,

    uploaded_at timestamptz
        not null
        default now(),

    uploaded_by text
);

create index if not exists
idx_todo_attachments_todo
on todo_attachments(todo_id);

grant all on table todo_attachments to anon;
grant all on table todo_attachments to authenticated;


create table if not exists update_prep_attachments (

    attachment_id uuid
        primary key
        default gen_random_uuid(),

    history_id uuid
        not null
        unique
        references update_prep_history(history_id)
        on delete cascade,

    file_name text
        not null,

    storage_path text
        not null,

    file_size bigint,

    label text,

    uploaded_at timestamptz
        not null
        default now(),

    uploaded_by text
);

grant all on table update_prep_attachments to anon;
grant all on table update_prep_attachments to authenticated;

-- ==========================================================================
-- BUCKETS — same names as live, so storage_path values copied over by
-- Push to pwms_prev resolve correctly
-- ==========================================================================

insert into storage.buckets (id, name, public)
values ('todo-attachments', 'todo-attachments', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('updateprep-attachments', 'updateprep-attachments', false)
on conflict (id) do nothing;

-- ==========================================================================
-- RLS — same permissive single-user "Universal manage" pattern as
-- every other table in this app, on both projects
-- ==========================================================================

drop policy if exists "Universal manage on todo_attachments" on todo_attachments;
create policy "Universal manage on todo_attachments" on todo_attachments
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on update_prep_attachments" on update_prep_attachments;
create policy "Universal manage on update_prep_attachments" on update_prep_attachments
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on todo-attachments bucket" on storage.objects;
create policy "Universal manage on todo-attachments bucket" on storage.objects
    for all to public
    using (bucket_id = 'todo-attachments')
    with check (bucket_id = 'todo-attachments');

drop policy if exists "Universal manage on updateprep-attachments bucket" on storage.objects;
create policy "Universal manage on updateprep-attachments bucket" on storage.objects
    for all to public
    using (bucket_id = 'updateprep-attachments')
    with check (bucket_id = 'updateprep-attachments');

alter table todo_attachments enable row level security;
alter table update_prep_attachments enable row level security;

-- storage.objects already has RLS enabled by default — no ALTER
-- TABLE needed there, only the two policies above.
