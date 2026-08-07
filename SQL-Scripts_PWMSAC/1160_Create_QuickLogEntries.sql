-- 1160_Create_QuickLogEntries.sql
-- Quick Log — a free-form scribbler, translating the Notepad ".LOG"
-- habit (open, get a timestamp, type anything, save) into real rows
-- instead of one ever-growing text file. Newest-first in the UI,
-- unlike the original Notepad file which was oldest-first — the app
-- sorts by created_at descending, no schema difference needed for that.
--
-- No foreign keys — this is intentionally a flat, standalone table.
-- "Covers anything" means it shouldn't be tied to a Portfolio/Project/
-- Milestone/Activity the way task_log is.

create table if not exists quicklog_entries (

    entry_id uuid
        primary key
        default gen_random_uuid(),

    entry_text text
        not null,
    -- Stores HTML, not plain text — the rich-text box (bold/italic/
    -- underline/lists, pasted tables, inline base64 images) writes
    -- real markup here. Historical entries migrated from the old
    -- Notepad .LOG file are HTML-escaped plain text, so they render
    -- correctly as literal text alongside newer formatted entries.

    created_at timestamptz
        not null
        default now(),

    created_by text,

    updated_at timestamptz
        not null
        default now(),

    updated_by text
);

create index if not exists
idx_quicklog_entries_created_at
on quicklog_entries(created_at desc);

grant all on table quicklog_entries to anon;
grant all on table quicklog_entries to authenticated;
