-- 1040_Create_Activity.sql
-- Legacy entity, retained in the database, removed from UI navigation.

create table if not exists activity (

    activity_id uuid
        primary key
        default gen_random_uuid(),

    milestone_id uuid
        references milestone(milestone_id),

    activity_name text
        not null,

    description text,

    target_date date,

    priority text
        default 'Medium',

    status text
        default 'Open',

    display_order integer
        default 100,

    enabled boolean
        default true,

    created_at timestamptz
        default now(),

    created_by text
        default 'System',

    updated_at timestamptz
        default now(),

    updated_by text
        default 'System'
);

create index if not exists
idx_activity_milestone
on activity(milestone_id);

grant all on table activity to anon;
grant all on table activity to authenticated;
