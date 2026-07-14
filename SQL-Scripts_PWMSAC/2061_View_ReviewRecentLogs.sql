-- 2061_View_ReviewRecentLogs.sql

drop view if exists vw_review_recent_logs;

create view vw_review_recent_logs as

select *
from vw_task_log_details
order by task_date desc, start_time desc;

grant select on vw_review_recent_logs to anon;
grant select on vw_review_recent_logs to authenticated;
