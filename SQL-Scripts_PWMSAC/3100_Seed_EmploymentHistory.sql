-- 3100_Seed_EmploymentHistory.sql
-- One open row (end_date NULL), exact EMPMaster values as they stood in
-- the original Excel. You've flagged several of these as stale
-- (Manager, work email, etc.) — this seeds them exactly as-is per your
-- instruction, for you to correct in place later rather than guessing
-- at current values here.

insert into employment_history (
    employer_name, manager_name, designation, department,
    band, region, location, site, city,
    work_email, employee_no, sap_id, windows_login_id, windows_domain,
    bu,
    delivery_head, delivery_team, resource_cat, msoffice_cat,
    asset_details, asset_issue_date,
    mem_activated, record_created_datetime, active_status, last_working_day,
    payroll_cycle_start_day, payroll_cycle_end_day,
    start_date, end_date
) values (
    'Startek', 'Aakash Shripat', 'Associate Vice President', 'Digital Solutions',
    'Band 2 (AVP Level)', 'Mumbai', 'Kurla', 'Mumbai Corporate', 'Mumbai',
    'abhishek.nandrajog@startek.com', '80507527', '80507527', 'abhishek.nandrajog', 'startek.com',
    'IBU',
    'Sidharth Mukherjee', 'Digital', 'Shared', 'E3',
    'Laptop: SR. NO.:  || ASSET TAG:  || DELL LATITUDE 3420', '2022-05-30',
    true, '2022-05-30 00:00:00+00', 1, null,
    25, 24,
    '2022-05-30', null
);