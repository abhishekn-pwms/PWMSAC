-- 2062_View_ReviewTimeSummary.sql

drop view if exists vw_review_time_summary;

create view vw_review_time_summary as

select

    coalesce(
        sum(
            case
                when task_date = current_date
                then minutes_spent
                else 0
            end
        ),
        0
    ) as today_minutes,

    coalesce(
        sum(
            case
                when task_date >= date_trunc('week', current_date)::date
                then minutes_spent
                else 0
            end
        ),
        0
    ) as week_minutes,

    coalesce(
        sum(
            case
                when task_date >= date_trunc('month', current_date)::date
                then minutes_spent
                else 0
            end
        ),
        0
    ) as month_minutes

from task_log;

grant select on vw_review_time_summary to anon;
grant select on vw_review_time_summary to authenticated;
