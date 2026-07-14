-- 1030_Create_Milestone.sql

create table if not exists milestone (

    milestone_id uuid
        primary key
        default gen_random_uuid(),

    project_id uuid
        not null
        references project(project_id),

    milestone_code text
        not null,

    milestone_name text
        not null,

    description text,

    start_date date,

    target_date date,

    status text
        not null
        default 'Not Started',

    display_order integer
        not null
        default 100,

    enabled boolean
        not null
        default true,

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
        default 'System'
);

create unique index if not exists
uq_milestone_code
on milestone(milestone_code);

create unique index if not exists
uq_milestone_name_per_project
on milestone(project_id, milestone_name);

create index if not exists
idx_milestone_project
on milestone(project_id);

create index if not exists
idx_milestone_enabled
on milestone(enabled);

create index if not exists
idx_milestone_status
on milestone(status);

grant all on table milestone to anon;
grant all on table milestone to authenticated;
