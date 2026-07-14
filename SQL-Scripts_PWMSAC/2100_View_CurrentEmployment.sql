-- 2100_View_CurrentEmployment.sql
-- Convenience view — "give me my current job" without every page
-- needing to repeat the end_date IS NULL filter itself.

drop view if exists vw_current_employment;

create view vw_current_employment as

select *
from employment_history
where end_date is null
order by start_date desc
limit 1;

grant select on vw_current_employment to anon;
grant select on vw_current_employment to authenticated;
