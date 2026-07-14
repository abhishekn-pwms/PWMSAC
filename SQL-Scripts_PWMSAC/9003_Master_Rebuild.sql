-- 9003_Master_Rebuild.sql
-- Full from-scratch rebuild — every table, view, seed row, and RLS
-- policy in one file, in correct dependency order. Generated directly
-- from the files verified against the live 9002 snapshot on 2026-07-12,
-- not hand-assembled from memory. Regenerate this file fresh each time
-- a new 9002 scan is run, rather than hand-patching it.
--
-- Run this top-to-bottom on a genuinely empty database to stand up a
-- complete copy of PWMS AC's schema. Load your data export separately
-- afterward (this file has no real data in it beyond the one ToDo seed
-- row).

-- ==========================================================================
-- SOURCE: 1010_Create_Portfolio.sql
-- ==========================================================================
-- 1010_Create_Portfolio.sql

create table if not exists portfolio (

    portfolio_id uuid
        primary key
        default gen_random_uuid(),

    portfolio_name text
        not null,

    portfolio_type text
        not null,

    description text,

    enabled boolean
        not null
        default true,

    display_order integer
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
        default 'System'
);

create unique index if not exists
uq_portfolio_name
on portfolio(portfolio_name);

create index if not exists
idx_portfolio_name
on portfolio(portfolio_name);

create index if not exists
idx_portfolio_enabled
on portfolio(enabled);

grant all on table portfolio to anon;
grant all on table portfolio to authenticated;


-- ==========================================================================
-- SOURCE: 1020_Create_Project.sql
-- ==========================================================================
-- 1020_Create_Project.sql

create table if not exists project (

    project_id uuid
        primary key
        default gen_random_uuid(),

    portfolio_id uuid
        not null
        references portfolio(portfolio_id),

    project_code text
        not null,

    project_name text
        not null,

    description text,

    display_order integer
        not null
        default 100,

    -- KNOWN BROKEN DEFAULT — reproduced exactly as it exists live, not
    -- fixed. Confirmed dormant: every project row today has a clean
    -- status value, meaning every insert always sets status explicitly
    -- and this default has never actually fired. Left unfixed
    -- intentionally per instruction; revisit as its own conversation
    -- later rather than silently correcting it here.
    status text
        default '''Not Started''::text'::text,

    enabled boolean
        not null
        default true,

    start_date date,

    target_date date,

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
uq_project_code
on project(project_code);

create unique index if not exists
uq_project_name_per_portfolio
on project(portfolio_id, project_name);

create index if not exists
idx_project_portfolio
on project(portfolio_id);

create index if not exists
idx_project_enabled
on project(enabled);

grant all on table project to anon;
grant all on table project to authenticated;


-- ==========================================================================
-- SOURCE: 1030_Create_Milestone.sql
-- ==========================================================================
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


-- ==========================================================================
-- SOURCE: 1040_Create_Activity.sql
-- ==========================================================================
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


-- ==========================================================================
-- SOURCE: 1050_Create_Todo.sql
-- ==========================================================================
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


-- ==========================================================================
-- SOURCE: 1060_Create_TaskLog.sql
-- ==========================================================================
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


-- ==========================================================================
-- SOURCE: 1070_Create_UpdatePrepSettings.sql
-- ==========================================================================
-- 1070_Create_UpdatePrepSettings.sql
-- Generic key/value store for the Update Prep page — style instructions,
-- templates, attachment mode, recency, all per format, plus shared
-- spoken style. One row per setting_key.

create table if not exists update_prep_settings (
    setting_key text primary key,
    setting_value text,
    updated_at timestamptz not null default now()
);

grant all on table update_prep_settings to anon;
grant all on table update_prep_settings to authenticated;


-- ==========================================================================
-- SOURCE: 1080_Create_UpdatePrepHistory.sql
-- ==========================================================================
-- 1080_Create_UpdatePrepHistory.sql
-- Append-only log, one row per period per format. Written and spoken
-- content share the same row for a given format+period, updated in
-- place as each half gets saved.

create table if not exists update_prep_history (
    history_id uuid primary key default gen_random_uuid(),
    format text not null,                  -- 'manager' or 'csaio'
    period_from date not null,
    period_to date not null,
    generated_prompt text,
    finished_update text,
    spoken_prompt text,
    finished_spoken text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists
idx_update_prep_history_format_date
on update_prep_history (format, period_to desc);

grant all on table update_prep_history to anon;
grant all on table update_prep_history to authenticated;


-- ==========================================================================
-- SOURCE: 2030_View_MilestoneDetails.sql
-- ==========================================================================
-- 2030_View_MilestoneDetails.sql

drop view if exists vw_milestone_details;

create view vw_milestone_details as

select

    m.milestone_id,
    m.project_id,
    p.portfolio_id,

    m.milestone_code,
    m.milestone_name,

    p.project_code,
    p.project_name,

    pf.portfolio_name,
    pf.portfolio_type,

    m.description,

    m.start_date,
    m.target_date,

    m.status,
    m.enabled,

    m.created_at,
    m.created_by,

    m.updated_at,
    m.updated_by

from milestone m

inner join project p
    on p.project_id = m.project_id

inner join portfolio pf
    on pf.portfolio_id = p.portfolio_id;

grant select on vw_milestone_details to anon;
grant select on vw_milestone_details to authenticated;


-- ==========================================================================
-- SOURCE: 2040_View_ActivityDetails.sql
-- ==========================================================================
-- 2040_View_ActivityDetails.sql

drop view if exists vw_activity_details;

create view vw_activity_details as

select

    a.activity_id,
    a.activity_name,
    a.description,
    a.target_date,
    a.priority,
    a.status,
    a.display_order,
    a.enabled,

    a.created_at,
    a.created_by,

    a.updated_at,
    a.updated_by,

    a.milestone_id,

    m.milestone_name,

    m.project_id,
    m.project_name,

    m.portfolio_id,
    m.portfolio_name

from activity a

left join vw_milestone_details m
    on m.milestone_id = a.milestone_id;

grant select on vw_activity_details to anon;
grant select on vw_activity_details to authenticated;


-- ==========================================================================
-- SOURCE: 2041_View_ReviewOpenActivities.sql
-- ==========================================================================
-- 2041_View_ReviewOpenActivities.sql

drop view if exists vw_review_open_activities;

create view vw_review_open_activities as

select

    activity_id,
    activity_name,
    status,
    target_date,
    portfolio_name,
    project_name,
    milestone_name,
    enabled

from vw_activity_details

where
    enabled = true
    and status not in ('Completed', 'Cancelled');

grant select on vw_review_open_activities to anon;
grant select on vw_review_open_activities to authenticated;


-- ==========================================================================
-- SOURCE: 2042_View_ReviewActivitySummary.sql
-- ==========================================================================
-- 2042_View_ReviewActivitySummary.sql

drop view if exists vw_review_activity_summary;

create view vw_review_activity_summary as

select

    count(*) filter (
        where enabled = true
        and status not in ('Completed', 'Cancelled')
    ) as open_activities,

    count(*) filter (
        where enabled = true
        and status = 'In Progress'
    ) as in_progress_activities,

    count(*) filter (
        where enabled = true
        and status = 'Completed'
        and updated_at >= date_trunc('week', current_date)
    ) as completed_activities,

    count(*) filter (
        where enabled = true
        and status not in ('Completed', 'Cancelled')
        and target_date < current_date
    ) as overdue_activities

from activity;

grant select on vw_review_activity_summary to anon;
grant select on vw_review_activity_summary to authenticated;


-- ==========================================================================
-- SOURCE: 2050_View_Todo.sql
-- ==========================================================================
-- 2050_View_Todo.sql

drop view if exists vw_todo;

create view vw_todo as

select

    t.todo_id,
    t.todo_text,
    t.notes,
    t.status,
    t.due_date,
    t.display_order,
    t.enabled,

    t.created_at,
    t.created_by,

    t.updated_at,
    t.updated_by,

    t.milestone_id,

    m.milestone_name,

    p.project_id,
    p.project_name,

    pf.portfolio_id,
    pf.portfolio_name

from todo t

left join milestone m
    on t.milestone_id = m.milestone_id

left join project p
    on m.project_id = p.project_id

left join portfolio pf
    on p.portfolio_id = pf.portfolio_id

where t.enabled = true;

grant all on table vw_todo to anon;
grant all on table vw_todo to authenticated;


-- ==========================================================================
-- SOURCE: 2060_View_TaskLogDetails.sql
-- ==========================================================================
-- 2060_View_TaskLogDetails.sql

drop view if exists vw_task_log_details;

create view vw_task_log_details as

select

    tl.task_log_id,
    tl.task_date,
    tl.task_description,
    tl.minutes_spent,
    tl.start_time,
    tl.end_time,
    tl.display_order,

    tl.created_at,
    tl.created_by,

    tl.updated_at,
    tl.updated_by,

    tl.todo_id,
    t.todo_text,

    tl.activity_id,
    a.activity_name,

    m.milestone_id,
    m.milestone_name,

    p.project_id,
    p.project_name

from task_log tl

left join todo t
    on tl.todo_id = t.todo_id

left join activity a
    on tl.activity_id = a.activity_id

left join milestone m
    on coalesce(t.milestone_id, a.milestone_id) = m.milestone_id

left join project p
    on m.project_id = p.project_id;

grant select on vw_task_log_details to anon;
grant select on vw_task_log_details to authenticated;


-- ==========================================================================
-- SOURCE: 2061_View_ReviewRecentLogs.sql
-- ==========================================================================
-- 2061_View_ReviewRecentLogs.sql

drop view if exists vw_review_recent_logs;

create view vw_review_recent_logs as

select *
from vw_task_log_details
order by task_date desc, start_time desc;

grant select on vw_review_recent_logs to anon;
grant select on vw_review_recent_logs to authenticated;


-- ==========================================================================
-- SOURCE: 2062_View_ReviewTimeSummary.sql
-- ==========================================================================
-- 2062_View_ReviewTimeSummary.sql

drop view if exists vw_review_time_summary;

create view vw_review_time_summary as

select

    coalesce(
        sum(
            case
                when task_date = current_date
                then minutes_spent
                else 0
            end
        ),
        0
    ) as today_minutes,

    coalesce(
        sum(
            case
                when task_date >= date_trunc('week', current_date)::date
                then minutes_spent
                else 0
            end
        ),
        0
    ) as week_minutes,

    coalesce(
        sum(
            case
                when task_date >= date_trunc('month', current_date)::date
                then minutes_spent
                else 0
            end
        ),
        0
    ) as month_minutes

from task_log;

grant select on vw_review_time_summary to anon;
grant select on vw_review_time_summary to authenticated;


-- ==========================================================================
-- SOURCE: 2071_View_ReviewPortfolioTime.sql
-- ==========================================================================
-- 2071_View_ReviewPortfolioTime.sql
-- NOTE: this view only joins task_log -> activity -> milestone. It has
-- no awareness of the newer task_log.todo_id path, so hours logged
-- against a ToDo (most current logging) are miscounted into
-- "Standalone Activities." Left exactly as-is per instruction, matching
-- live behavior precisely rather than silently correcting it here.

drop view if exists vw_review_portfolio_time;

create view vw_review_portfolio_time as

select

    coalesce(p.portfolio_name, 'Standalone Activities') as portfolio_name,

    round(sum(t.minutes_spent) / 60.0, 1) as hours_spent

from task_log t

left join activity a
    on t.activity_id = a.activity_id

left join milestone m
    on a.milestone_id = m.milestone_id

left join project pr
    on m.project_id = pr.project_id

left join portfolio p
    on pr.portfolio_id = p.portfolio_id

group by portfolio_name

order by hours_spent desc;

grant select on vw_review_portfolio_time to anon;
grant select on vw_review_portfolio_time to authenticated;


-- ==========================================================================
-- SOURCE: 3050_Seed_Todo.sql
-- ==========================================================================
-- 3050_Seed_Todo.sql
-- Only seed script that currently exists. The rest are a deliberate,
-- deferred one-time activity: once data export is complete, all seed
-- scripts get regenerated from real exported data instead.

insert into todo (

    activity_id,
    todo_text,
    due_date,
    created_by,
    updated_by

)

select

    activity_id,
    'Test ToDo',
    current_date,
    'system',
    'system'

from activity

limit 1;


-- ==========================================================================
-- SOURCE: 4001_RLS_AllTables.sql
-- ==========================================================================
-- 4001_RLS_AllTables.sql
-- Single combined RLS step for every table — deliberately separate from
-- schema/data so a from-scratch rebuild can create tables and load seed
-- data before security is switched on, rather than fighting RLS while
-- seeding.
--
-- DROP POLICY IF EXISTS before each CREATE POLICY — Postgres has no
-- CREATE POLICY IF NOT EXISTS, so without this guard, re-running this
-- file a second time (e.g. after a partial rebuild) would error out on
-- "policy already exists" and halt partway through.

-- ==========================================================================
-- STEP 1: Policies (permissive single-user pattern, same for every table)
-- ==========================================================================

drop policy if exists "Universal manage on portfolio" on portfolio;
create policy "Universal manage on portfolio" on portfolio
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on project" on project;
create policy "Universal manage on project" on project
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on milestone" on milestone;
create policy "Universal manage on milestone" on milestone
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on activity" on activity;
create policy "Universal manage on activity" on activity
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on todo" on todo;
create policy "Universal manage on todo" on todo
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on task_log" on task_log;
create policy "Universal manage on task_log" on task_log
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on update_prep_settings" on update_prep_settings;
create policy "Universal manage on update_prep_settings" on update_prep_settings
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on update_prep_history" on update_prep_history;
create policy "Universal manage on update_prep_history" on update_prep_history
    for all to public using (true) with check (true);

-- ==========================================================================
-- STEP 2: Enable RLS (the security wall itself)
-- ==========================================================================

alter table portfolio enable row level security;
alter table project enable row level security;
alter table milestone enable row level security;
alter table activity enable row level security;
alter table todo enable row level security;
alter table task_log enable row level security;
alter table update_prep_settings enable row level security;
alter table update_prep_history enable row level security;


