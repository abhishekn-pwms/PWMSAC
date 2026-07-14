-- 3090_Seed_PersonalProfile.sql
-- Real values from the original Excel EMPMaster sheet.

insert into personal_profile (
    first_name, middle_name, last_name, full_name,
    dob, gender,
    personal_email, qualification,
    mobile_primary, mobile_secondary,
    res_address_1, res_address_2, res_pin, res_city, res_state,
    total_experience_years
) values (
    'Abhishek', 'Ratan', 'Nandrajog', 'Abhishek Ratan Nandrajog',
    '1980-09-18', 'Male',
    'abhishek.nandrajog@gmail.com', 'Master of Science (Computer Science)',
    '9820021120', '9029004771',
    'E/204, Trishul Ganga,', 'Sindhi Society, Chembur.', '400071', 'Mumbai', 'Maharashtra',
    19
);
