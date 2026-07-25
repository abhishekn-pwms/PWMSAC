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
