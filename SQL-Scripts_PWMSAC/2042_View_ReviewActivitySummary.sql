-- 2042_View_ReviewActivitySummary.sql

drop view if exists vw_review_activity_summary;

create view vw_review_activity_summary as

select

    count(*) filter (
        where enabled = true
        and status not in ('Completed', 'Cancelled')
    ) as open_activities,

    count(*) filter (
        where enabled = true
        and status = 'In Progress'
    ) as in_progress_activities,

    count(*) filter (
        where enabled = true
        and status = 'Completed'
        and updated_at >= date_trunc('week', current_date)
    ) as completed_activities,

    count(*) filter (
        where enabled = true
        and status not in ('Completed', 'Cancelled')
        and target_date < current_date
    ) as overdue_activities

from activity;

grant select on vw_review_activity_summary to anon;
grant select on vw_review_activity_summary to authenticated;
