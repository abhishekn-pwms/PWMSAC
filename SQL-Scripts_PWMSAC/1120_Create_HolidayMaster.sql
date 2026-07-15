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
