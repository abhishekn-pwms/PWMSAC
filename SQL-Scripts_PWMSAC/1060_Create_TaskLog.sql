-- 1060_Create_TaskLog.sql

create table if not exists task_log (

    task_log_id uuid
        primary key
        default gen_random_uuid(),

    -- Legacy hook, nullable, no FK constraint (dropped live to allow
    -- ToDo-only logging once task_log.todo_id became the primary path).
    activity_id uuid,

    task_date date
        not null
        default current_date,

    task_description text
        not null,

    minutes_spent integer
        not null
        default 0,

    start_time time,

    end_time time,

    display_order integer
        not null
        default 100,

    created_at timestamptz
        not null
        default now(),

    created_by text
        not null
        default 'System',

    updated_at timestamptz
        not null
        default now(),

    updated_by text
        not null
        default 'System',

    -- The real ToDo linkage this app actually runs on. Missing from
    -- every prior version of this file despite being live and
    -- load-bearing since early in the project — added here from the
    -- verified 9002 snapshot, not from memory.
    todo_id uuid
        references todo(todo_id)
);

create index if not exists
idx_task_log_activity
on task_log(activity_id);

create index if not exists
idx_task_log_date
on task_log(task_date);

grant all on table task_log to anon;
grant all on table task_log to authenticated;
