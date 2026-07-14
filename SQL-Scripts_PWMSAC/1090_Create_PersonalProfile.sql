-- 1090_Create_PersonalProfile.sql
-- Permanent, employer-independent personal facts. Single row, updated
-- in place — this is who you are, not where you currently work.

create table if not exists personal_profile (

    profile_id uuid
        primary key
        default gen_random_uuid(),

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
