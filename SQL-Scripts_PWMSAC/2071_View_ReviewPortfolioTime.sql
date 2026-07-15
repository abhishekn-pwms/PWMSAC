-- 2071_View_ReviewPortfolioTime.sql
-- NOTE: this view only joins task_log -> activity -> milestone. It has
-- no awareness of the newer task_log.todo_id path, so hours logged
-- against a ToDo (most current logging) are miscounted into
-- "Standalone Activities." Left exactly as-is per instruction, matching
-- live behavior precisely rather than silently correcting it here.

drop view if exists vw_review_portfolio_time;

create view vw_review_portfolio_time as

select

    coalesce(p.portfolio_name, 'Standalone Activities') as portfolio_name,

    round(sum(t.minutes_spent) / 60.0, 1) as hours_spent

from task_log t

left join activity a
    on t.activity_id = a.activity_id

left join milestone m
    on a.milestone_id = m.milestone_id

left join project pr
    on m.project_id = pr.project_id

left join portfolio p
    on pr.portfolio_id = p.portfolio_id

group by portfolio_name

order by hours_spent desc;

grant select on vw_review_portfolio_time to anon;
grant select on vw_review_portfolio_time to authenticated;
