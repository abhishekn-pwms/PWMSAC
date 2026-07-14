-- 2060_View_TaskLogDetails.sql

drop view if exists vw_task_log_details;

create view vw_task_log_details as

select

    tl.task_log_id,
    tl.task_date,
    tl.task_description,
    tl.minutes_spent,
    tl.start_time,
    tl.end_time,
    tl.display_order,

    tl.created_at,
    tl.created_by,

    tl.updated_at,
    tl.updated_by,

    tl.todo_id,
    t.todo_text,

    tl.activity_id,
    a.activity_name,

    m.milestone_id,
    m.milestone_name,

    p.project_id,
    p.project_name

from task_log tl

left join todo t
    on tl.todo_id = t.todo_id

left join activity a
    on tl.activity_id = a.activity_id

left join milestone m
    on coalesce(t.milestone_id, a.milestone_id) = m.milestone_id

left join project p
    on m.project_id = p.project_id;

grant select on vw_task_log_details to anon;
grant select on vw_task_log_details to authenticated;
