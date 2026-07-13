-- 3120_Seed_HolidayMaster.sql
-- Exact 41-row master from the original HolidayMaster sheet, 2022–2026.
-- The old sheet's "Future Holidays?" completed/future flag is not
-- carried forward as a stored column — it's trivially derivable by
-- comparing holiday_date to today, and storing it would just go stale.

insert into holiday_master (holiday_date, holiday_name, holiday_type, locations) values
('2022-01-01', 'New Year', 'Fixed', 'All India'),
('2022-01-26', 'Republic Day', 'Fixed', 'All India'),
('2022-08-15', 'Independence Day', 'Fixed', 'All India'),
('2022-10-02', 'Mahatama Gandhi Jayanti', 'Fixed', 'All India'),
('2022-03-01', 'Mahashivratri', 'Floating', 'MAH'),
('2022-03-18', 'Holi', 'Floating', 'MAH'),
('2022-08-31', 'Ganesh Chaturthi', 'Floating', 'MAH'),
('2022-10-05', 'Dussera', 'Floating', 'MAH'),
('2022-10-24', 'Diwali', 'Floating', 'MAH'),
('2022-10-26', 'Bhai Dooj', 'Floating', 'MAH'),

('2023-01-01', 'Happy New Year', 'Floating', 'All India'),
('2023-01-26', 'Republic Day', 'Fixed', 'MAH'),
('2023-03-08', 'Holi', 'Floating', 'MAH'),
('2023-03-22', 'Gudi Padva', 'Floating', 'MAH'),
('2023-05-01', 'Maharashtrian New Year', 'Floating', 'MAH'),
('2023-08-15', 'Independence Day', 'Fixed', 'MAH'),
('2023-09-19', 'Ganesh Chaturthi', 'Floating', 'MAH'),
('2023-10-02', 'Mahatma Gandhi Jayanti', 'Fixed', 'MAH'),
('2023-11-13', 'Diwali', 'Floating', 'MAH'),
('2023-12-25', 'Christmas', 'Floating', 'MAH'),

('2024-01-01', 'New Year', 'Fixed', 'MAH'),
('2024-01-26', 'Republic Day', 'Fixed', 'MAH'),
('2024-03-25', 'Holi', 'Fixed', 'MAH'),
('2024-05-01', 'Maharashtra Din', 'Fixed', 'MAH'),
('2024-08-15', 'Independence Day', 'Fixed', 'MAH'),
('2024-10-02', 'Mahatma Gandhi Jayanti', 'Fixed', 'MAH'),
('2024-11-01', 'Diwali', 'Fixed', 'MAH'),
('2024-12-25', 'Christmas', 'Fixed', 'MAH'),

('2025-01-01', 'New Year', 'Fixed', 'All India'),
('2025-03-14', 'Holi', 'Fixed', 'MAH'),
('2025-05-01', 'Maharashtra Din', 'Fixed', 'MAH'),
('2025-08-15', 'Independence Day', 'Fixed', 'All India'),
('2025-08-27', 'Ganesh Chaturthi', 'Fixed', 'MAH'),
('2025-10-02', 'Mahatma Gandhi Jayanti', 'Fixed', 'All India'),
('2025-10-21', 'Diwali', 'Fixed', 'MAH'),
('2025-12-25', 'Christmas Day', 'Fixed', 'All India'),

('2026-01-01', 'New Year', 'Fixed', 'All India'),
('2026-01-26', 'Republic Day', 'Fixed', 'All India'),
('2026-03-03', 'Holi', 'Fixed', 'All India'),
('2026-05-01', 'Maharashtra Din', 'Fixed', 'MAH'),
('2026-09-14', 'Ganesh Chaturthi', 'Fixed', 'MAH'),
('2026-10-02', 'Mahatma Gandhi Jayanti', 'Fixed', 'All India'),
('2026-11-10', 'Diwali', 'Fixed', 'All India'),
('2026-12-25', 'Christmas', 'Fixed', 'All India');
