-- 2040_View_ActivityDetails.sql

drop view if exists vw_activity_details;

create view vw_activity_details as

select

    a.activity_id,
    a.activity_name,
    a.description,
    a.target_date,
    a.priority,
    a.status,
    a.display_order,
    a.enabled,

    a.created_at,
    a.created_by,

    a.updated_at,
    a.updated_by,

    a.milestone_id,

    m.milestone_name,

    m.project_id,
    m.project_name,

    m.portfolio_id,
    m.portfolio_name

from activity a

left join vw_milestone_details m
    on m.milestone_id = a.milestone_id;

grant select on vw_activity_details to anon;
grant select on vw_activity_details to authenticated;
