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
