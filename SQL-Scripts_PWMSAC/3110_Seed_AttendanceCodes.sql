-- 3110_Seed_AttendanceCodes.sql
-- Exact 10-row master from the original AttendanceCodes sheet.

insert into attendance_codes (code, attendance_type, remarks, hr_type) values
('P', 'Present', 'Present', 'Presence'),
('WFH', 'Work From Home', 'Work From Home', 'Presence'),
('LWD-RES', 'Present', 'Last Working Day - Resigned', 'Presence'),
('OFF', 'Week-Off', 'Weekly-Off', 'WeekOff'),
('H', 'Holiday', 'Fixed Holiday', 'Holiday'),
('FH', 'Holiday', 'Floating Holiday', 'Holiday'),
('PL', 'Privilege Leave', 'Privileged Leave', 'Leave'),
('CL', 'Casual Leave', 'Casual Leave', 'Leave'),
('LP', 'UnPaid Leave', 'Loss Of Pay', 'Leave'),
('SUPL', 'Special UnPaid Leave', 'Special UnPaid Leave', 'Leave');
