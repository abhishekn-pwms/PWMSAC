-- 1150_Create_UpdatePrepAttachments.sql
-- (Renumber if 1150 is already taken in your folder — placeholder
-- chosen to sit after 1140_Create_TodoAttachments.sql.)
--
-- Unlike todo_attachments (many files per ToDo), this is genuinely
-- one row per update_prep_history row — a single screenshot of the
-- written update as actually sent, per period+format. The UNIQUE
-- constraint on history_id enforces that at the database level, not
-- just in the app's "replace, not add" upload logic.
--
-- Cascades the same way as todo_attachments: an attachment has no
-- value once orphaned from the history row it documents, so deleting
-- the update_prep_history row deletes this row too.
--
-- storage_path points into the "updateprep-attachments" Supabase
-- Storage bucket, not this database — deleting this row does NOT
-- automatically delete the underlying file in Storage; the
-- application is responsible for removing both together.

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
    -- original filename, as selected by the user

    storage_path text
        not null,
    -- path within the "updateprep-attachments" bucket, e.g.
    -- "{history_id}/{attachment_id}-{file_name}"

    file_size bigint,
    -- bytes, as reported by the browser at upload time

    uploaded_at timestamptz
        not null
        default now(),

    uploaded_by text
);

-- No separate index needed on history_id — the UNIQUE constraint
-- above already creates one, unlike todo_attachments where todo_id
-- is not unique and needs its own explicit index.

grant all on table update_prep_attachments to anon;
grant all on table update_prep_attachments to authenticated;
