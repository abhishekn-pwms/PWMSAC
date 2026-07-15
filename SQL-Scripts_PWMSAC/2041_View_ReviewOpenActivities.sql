-- 2041_View_ReviewOpenActivities.sql

drop view if exists vw_review_open_activities;

create view vw_review_open_activities as

select

    activity_id,
    activity_name,
    status,
    target_date,
    portfolio_name,
    project_name,
    milestone_name,
    enabled

from vw_activity_details

where
    enabled = true
    and status not in ('Completed', 'Cancelled');

grant select on vw_review_open_activities to anon;
grant select on vw_review_open_activities to authenticated;
