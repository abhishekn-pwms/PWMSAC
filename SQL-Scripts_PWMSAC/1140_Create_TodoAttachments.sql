-- 1140_Create_TodoAttachments.sql
-- One row per uploaded file, many rows per ToDo. Genuinely different
-- cascade behavior from task_log.todo_id (which survives a ToDo delete
-- by nulling out, per explicit confirmation this is already handled
-- correctly today) — attachment files have no value once orphaned from
-- the ToDo they support, so this FK cascades the delete instead.
--
-- storage_path points into the "todo-attachments" Supabase Storage
-- bucket, not this database — deleting this row does NOT automatically
-- delete the underlying file in Storage; the application is
-- responsible for removing both together.

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
    -- original filename, as selected by the user

    storage_path text
        not null,
    -- path within the "todo-attachments" bucket, e.g.
    -- "{todo_id}/{attachment_id}-{file_name}"

    file_size bigint,
    -- bytes, as reported by the browser at upload time

    label text,
    -- optional short user-given name, e.g. "CBA v2 — post feedback"

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
