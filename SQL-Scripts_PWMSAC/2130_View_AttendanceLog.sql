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
