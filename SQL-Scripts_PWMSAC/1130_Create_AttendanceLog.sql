-- 1130_Create_AttendanceLog.sql
-- One row per day, log_date itself as the primary key — duplicate
-- entries for the same day are impossible by construction, not by
-- application-level checking.
--
-- Regenerated from the verified live 9002 snapshot, not patched.
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
        default true,
    -- renamed from the old SAMAY flag — same purpose, tracks the
    -- current HRIS system (Oracle), not SAMAY specifically. Defaults
    -- true since it rarely fires in practice — the app always sends
    -- an explicit value (checkbox state, or hardcoded true for bulk
    -- weekend fill); this default only matters as a fallback for
    -- anything inserted outside the app's own code paths.

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
