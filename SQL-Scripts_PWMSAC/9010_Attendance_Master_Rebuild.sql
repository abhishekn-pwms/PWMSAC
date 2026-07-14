-- 9010_Attendance_Master_Rebuild.sql
-- Full from-scratch rebuild for the 5 attendance-related tables, their
-- 3 views, and RLS — in one file, correct dependency order. Generated
-- by literal concatenation of the actual verified source files, not
-- retyped, so it can't drift from them. Regenerate fresh from those
-- files if any of them change, rather than hand-patching this one.
--
-- Companion to 9003_Master_Rebuild.sql (the original 8 PWMS tables) —
-- this covers only the 5 attendance tables added afterward. Run this
-- AFTER 9003 if standing up a truly empty database from nothing, since
-- attendance_log references attendance_codes, and both are independent
-- of the original 8 tables.
--
-- Seed data (3090-3130) is NOT included here — those exist for
-- populating a brand-new empty database, not for replacing an
-- existing, already-populated one. Run them separately if that's
-- actually what you need.

-- ==========================================================================
-- SOURCE: 1090_Create_PersonalProfile.sql
-- ==========================================================================
-- 1090_Create_PersonalProfile.sql
-- Permanent, employer-independent personal facts. Single row, updated
-- in place — this is who you are, not where you currently work.

create table if not exists personal_profile (

    profile_id uuid
        primary key
        default gen_random_uuid(),

    short_name text,
    first_name text,
    middle_name text,
    last_name text,
    full_name text,

    dob date,
    gender text,

    personal_email text,
    qualification text,

    mobile_primary text,
    mobile_secondary text,

    res_address_1 text,
    res_address_2 text,
    res_pin text,
    res_city text,
    res_state text,

    total_experience_years numeric,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);

grant all on table personal_profile to anon;
grant all on table personal_profile to authenticated;


-- ==========================================================================
-- SOURCE: 1100_Create_EmploymentHistory.sql
-- ==========================================================================
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


-- ==========================================================================
-- SOURCE: 1110_Create_AttendanceCodes.sql
-- ==========================================================================
-- 1110_Create_AttendanceCodes.sql
-- The current, evolving master list of codes. Free to grow when you
-- change employers — new codes get added, old ones are never deleted,
-- since historical attendance_log rows freeze their own description
-- and hr_type at the moment they're logged and never re-read this
-- table afterward.

create table if not exists attendance_codes (

    code text
        primary key,

    attendance_type text
        not null,
    -- e.g. "Present", "Privilege Leave", "UnPaid Leave"

    remarks text,

    hr_type text
        not null,
    -- one of: Presence, Leave, WeekOff, Holiday

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);

grant all on table attendance_codes to anon;
grant all on table attendance_codes to authenticated;


-- ==========================================================================
-- SOURCE: 1120_Create_HolidayMaster.sql
-- ==========================================================================
-- 1120_Create_HolidayMaster.sql

create table if not exists holiday_master (

    holiday_id uuid
        primary key
        default gen_random_uuid(),

    holiday_date date
        not null,

    holiday_name text
        not null,

    holiday_type text
        not null,
    -- Fixed or Floating

    locations text,
    -- e.g. "All India", "MAH" — kept as informational metadata

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);

create unique index if not exists
uq_holiday_master_date
on holiday_master(holiday_date);

grant all on table holiday_master to anon;
grant all on table holiday_master to authenticated;


-- ==========================================================================
-- SOURCE: 1130_Create_AttendanceLog.sql
-- ==========================================================================
-- 1130_Create_AttendanceLog.sql
-- One row per day, log_date itself as the primary key — duplicate
-- entries for the same day are impossible by construction, not by
-- application-level checking.
--
-- Three text fields serve three different, deliberately separate jobs:
--   reason           — yours, freely editable any time
--   description      — frozen copy of attendance_codes.attendance_type
--                       at the moment this was logged, never re-read
--                       or recalculated afterward
--   hr_type_frozen   — frozen copy of attendance_codes.hr_type,
--                       same reasoning
-- Both frozen fields exist so a future redefinition of what a code
-- means can never silently rewrite what an old entry meant when it
-- was actually logged.

create table if not exists attendance_log (

    log_date date
        primary key,

    code text
        not null
        references attendance_codes(code),

    reason text,

    description text,
    -- frozen at insert, not a live join

    hr_type_frozen text,
    -- frozen at insert, not a live join

    oracle_updated boolean
        default false,
    -- renamed from the old SAMAY flag — same purpose, tracks the
    -- current HRIS system (Oracle), not SAMAY specifically

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);

create index if not exists
idx_attendance_log_code
on attendance_log(code);

grant all on table attendance_log to anon;
grant all on table attendance_log to authenticated;


-- ==========================================================================
-- SOURCE: 2100_View_CurrentEmployment.sql
-- ==========================================================================
-- 2100_View_CurrentEmployment.sql
-- Convenience view — "give me my current job" without every page
-- needing to repeat the end_date IS NULL filter itself.

drop view if exists vw_current_employment;

create view vw_current_employment as

select *
from employment_history
where end_date is null
order by start_date desc
limit 1;

grant select on vw_current_employment to anon;
grant select on vw_current_employment to authenticated;


-- ==========================================================================
-- SOURCE: 2130_View_AttendanceLog.sql
-- ==========================================================================
-- 2130_View_AttendanceLog.sql
-- Plain ordered passthrough — kept consistent with the rest of the app's
-- convention of always reading through a view, even for a 1:1 relationship.

drop view if exists vw_attendance_log;

create view vw_attendance_log as

select *
from attendance_log
order by log_date desc;

grant select on vw_attendance_log to anon;
grant select on vw_attendance_log to authenticated;


-- ==========================================================================
-- SOURCE: 2131_View_PayrollMonth.sql
-- ==========================================================================
-- 2131_View_PayrollMonth.sql
-- Cross-table report, not flavored by a single table — matches an
-- attendance_log row to whichever employment_history stint was active
-- on that date, then computes the payroll month/year using THAT
-- stint's own cycle days (not a single global rule), since a future
-- employer could run a different cycle entirely.
--
-- Rarely used — mainly relevant around a Last Working Day. Left as its
-- own separate view rather than folded into the everyday attendance
-- pages, per instruction.

drop view if exists vw_payroll_month;

create view vw_payroll_month as

select

    al.log_date,
    al.code,
    al.description,
    al.hr_type_frozen,

    eh.employer_name,
    eh.payroll_cycle_start_day,
    eh.payroll_cycle_end_day,

    case
        when extract(day from al.log_date) >= eh.payroll_cycle_start_day
        then case
                when extract(month from al.log_date) = 12 then 1
                else extract(month from al.log_date) + 1
             end
        else extract(month from al.log_date)
    end as payroll_month,

    case
        when extract(day from al.log_date) >= eh.payroll_cycle_start_day
             and extract(month from al.log_date) = 12
        then extract(year from al.log_date) + 1
        else extract(year from al.log_date)
    end as payroll_year

from attendance_log al

left join employment_history eh
    on al.log_date >= eh.start_date
    and (eh.end_date is null or al.log_date <= eh.end_date);

grant select on vw_payroll_month to anon;
grant select on vw_payroll_month to authenticated;


-- ==========================================================================
-- SOURCE: 4001_RLS_Addendum_Attendance.sql
-- ==========================================================================
-- APPEND THIS INTO YOUR EXISTING 4001_RLS_AllTables.sql
-- Per the folder's own principle: one single combined RLS file for
-- every table, edited in place — not a new 4002 file.

-- ==========================================================================
-- Add to STEP 1 (Policies)
-- ==========================================================================

drop policy if exists "Universal manage on personal_profile" on personal_profile;
create policy "Universal manage on personal_profile" on personal_profile
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on employment_history" on employment_history;
create policy "Universal manage on employment_history" on employment_history
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on attendance_codes" on attendance_codes;
create policy "Universal manage on attendance_codes" on attendance_codes
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on holiday_master" on holiday_master;
create policy "Universal manage on holiday_master" on holiday_master
    for all to public using (true) with check (true);

drop policy if exists "Universal manage on attendance_log" on attendance_log;
create policy "Universal manage on attendance_log" on attendance_log
    for all to public using (true) with check (true);

-- ==========================================================================
-- Add to STEP 2 (Enable RLS)
-- ==========================================================================

alter table personal_profile enable row level security;
alter table employment_history enable row level security;
alter table attendance_codes enable row level security;
alter table holiday_master enable row level security;
alter table attendance_log enable row level security;


