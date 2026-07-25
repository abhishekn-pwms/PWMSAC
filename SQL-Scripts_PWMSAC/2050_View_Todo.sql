-- 2050_View_Todo.sql

drop view if exists vw_todo;

create view vw_todo as

select

    t.todo_id,
    t.todo_text,
    t.notes,
    t.status,
    t.due_date,
    t.display_order,
    t.enabled,

    t.created_at,
    t.created_by,

    t.updated_at,
    t.updated_by,

    t.milestone_id,

    m.milestone_name,

    p.project_id,
    p.project_name,

    pf.portfolio_id,
    pf.portfolio_name

from todo t

left join milestone m
    on t.milestone_id = m.milestone_id

left join project p
    on m.project_id = p.project_id

left join portfolio pf
    on p.portfolio_id = pf.portfolio_id

where t.enabled = true;

grant all on table vw_todo to anon;
grant all on table vw_todo to authenticated;
