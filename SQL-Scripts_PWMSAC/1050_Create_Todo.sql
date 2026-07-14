-- 1050_Create_Todo.sql

create table if not exists todo (

    todo_id uuid primary key
        default gen_random_uuid(),

    -- Legacy hook, retained but NOT NULL. Note: no FK constraint to
    -- activity — that constraint was dropped live at some point and
    -- this file now matches that reality, rather than the old file's
    -- "references activity(activity_id)" which no longer reflects what
    -- actually exists in the database.
    activity_id uuid not null,

    todo_text text not null,

    notes text,

    status text not null
        default 'Open',

    due_date date,

    display_order integer
        default 100,

    enabled boolean
        default true,

    created_at timestamptz
        default now(),

    created_by text,

    updated_at timestamptz
        default now(),

    updated_by text,

    -- The real milestone linkage this app actually runs on. Missing
    -- from every prior version of this file despite being live and
    -- load-bearing since early in the project — added here from the
    -- verified 9002 snapshot, not from memory.
    milestone_id uuid
        references milestone(milestone_id)
);

grant all on table todo to anon;
grant all on table todo to authenticated;
