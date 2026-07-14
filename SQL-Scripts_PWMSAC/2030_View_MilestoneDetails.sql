-- 2030_View_MilestoneDetails.sql

drop view if exists vw_milestone_details;

create view vw_milestone_details as

select

    m.milestone_id,
    m.project_id,
    p.portfolio_id,

    m.milestone_code,
    m.milestone_name,

    p.project_code,
    p.project_name,

    pf.portfolio_name,
    pf.portfolio_type,

    m.description,

    m.start_date,
    m.target_date,

    m.status,
    m.enabled,

    m.created_at,
    m.created_by,

    m.updated_at,
    m.updated_by

from milestone m

inner join project p
    on p.project_id = m.project_id

inner join portfolio pf
    on pf.portfolio_id = p.portfolio_id;

grant select on vw_milestone_details to anon;
grant select on vw_milestone_details to authenticated;
