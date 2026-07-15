-- 1100_Create_EmploymentHistory.sql
-- One row per employment stint. A future job change closes the current
-- row (sets end_date) and opens a new one — old rows are never
-- overwritten, giving genuine history rather than a single flat
-- profile that loses everything the moment you update it.
--
-- payroll_cycle_start_day / end_day are scoped to THIS employment stint
-- specifically (e.g. 25 / 24), since a future employer could run a
-- completely different cycle — this is not a single global rule.

create table if not exists employment_history (

    employment_id uuid
        primary key
        default gen_random_uuid(),

    employer_name text,
    manager_name text,
    designation text,
    department text,

    band text,
    region text,
    location text,
    site text,
    city text,

    work_email text,
    employee_no text,
    sap_id text,
    windows_login_id text,
    windows_domain text,

    bu text,

    delivery_head text,
    delivery_team text,
    resource_cat text,
    msoffice_cat text,

    asset_details text,
    asset_issue_date date,

    mem_activated boolean,
    record_created_datetime timestamptz,
    active_status integer,
    last_working_day date,

    payroll_cycle_start_day integer,
    payroll_cycle_end_day integer,

    start_date date
        not null,

    end_date date,
    -- null = current employment

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);

create index if not exists
idx_employment_history_dates
on employment_history(start_date, end_date);

grant all on table employment_history to anon;
grant all on table employment_history to authenticated;