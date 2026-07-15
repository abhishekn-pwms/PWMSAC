-- 2072_View_PayrollMonth.sql
-- Cross-table report, not flavored by a single table — matches an
-- attendance_log row to whichever employment_history stint was active
-- on that date, then computes the payroll month/year using THAT
-- stint's own cycle days (not a single global rule), since a future
-- employer could run a different cycle entirely.
--
-- Rarely used — mainly relevant around a Last Working Day. Left as its
-- own separate view rather than folded into the everyday attendance
-- pages, per instruction.

drop view if exists vw_payroll_month;

create view vw_payroll_month as

select

    al.log_date,
    al.code,
    al.description,
    al.hr_type_frozen,

    eh.employer_name,
    eh.payroll_cycle_start_day,
    eh.payroll_cycle_end_day,

    case
        when extract(day from al.log_date) >= eh.payroll_cycle_start_day
        then case
                when extract(month from al.log_date) = 12 then 1
                else extract(month from al.log_date) + 1
             end
        else extract(month from al.log_date)
    end as payroll_month,

    case
        when extract(day from al.log_date) >= eh.payroll_cycle_start_day
             and extract(month from al.log_date) = 12
        then extract(year from al.log_date) + 1
        else extract(year from al.log_date)
    end as payroll_year

from attendance_log al

left join employment_history eh
    on al.log_date >= eh.start_date
    and (eh.end_date is null or al.log_date <= eh.end_date);

grant select on vw_payroll_month to anon;
grant select on vw_payroll_month to authenticated;
