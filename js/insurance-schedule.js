// AC v2.0 BANKNDEPOSITS

// Premium due dates and RD funding for insurance policies. Pure functions,
// no page or database access, shared by the Insurance and Deposits pages.
//
// Nothing here is stored. Every due date is worked out from three facts on
// the policy: first_due_date (the anchor), premium_mode (the interval) and
// premium_term_years (when paying stops). Past due dates are assumed paid.
//
// All names start with "ins" so they can never collide with a page's own
// helpers.

const INS_PERIOD_MONTHS = {
    "Annual": 12,
    "Half Yearly": 6,
    "Quarterly": 3,
    "Monthly": 1
};

// An RD whose needed-by date is within this many days of a due date is
// taken to be saved for that due date.
const INS_NEEDED_BY_WINDOW_DAYS = 60;


function insParts(iso) {

    const [y, m, d] = String(iso).substring(0, 10).split("-").map(Number);

    return { y, m, d };
}


// Whole days from one yyyy-mm-dd date to another (positive = later), using
// UTC midnights so daylight-saving never shifts the count.
function insDaysBetween(fromIso, toIso) {

    const a = insParts(fromIso);
    const b = insParts(toIso);

    return Math.round(
        (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000
    );
}


// Same behaviour as Excel's EDATE: the day clamps to the month's last day.
function insAddMonths(iso, months) {

    const { y, m, d } = insParts(iso);

    const total = (m - 1) + months;
    const ny = y + Math.floor(total / 12);
    const nm = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();

    return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}


function insIsSinglePayment(policy) {

    return policy.premium_mode === "Single payment" || !INS_PERIOD_MONTHS[policy.premium_mode];
}


// Every premium due date up to and including untilIso, oldest first.
//
// - Single payment (or no mode): the one date is maturity_date -- the
//   renewal date.
// - Otherwise: first_due_date, then every interval after it, always counted
//   from the anchor so month-end days never drift. Stops before the end of
//   the paying term (issue date + premium_term_years); with no paying term
//   it stops before maturity_date, or runs on if that is empty too.
function insDueDates(policy, untilIso) {

    if (insIsSinglePayment(policy)) {

        return policy.maturity_date && policy.maturity_date <= untilIso
            ? [policy.maturity_date]
            : [];
    }

    const step = INS_PERIOD_MONTHS[policy.premium_mode];

    const anchor = policy.first_due_date
        || (policy.issue_date ? insAddMonths(policy.issue_date, step) : null);

    if (!anchor) {
        return [];
    }

    let end = null;

    if (policy.premium_term_years && policy.issue_date) {
        end = insAddMonths(policy.issue_date, policy.premium_term_years * 12);
    } else if (policy.maturity_date) {
        end = policy.maturity_date;
    }

    const dues = [];

    for (let k = 0; k < 2000; k++) {

        const due = insAddMonths(anchor, k * step);

        if (end && due >= end) break;
        if (due > untilIso) break;

        dues.push(due);
    }

    return dues;
}


// The next premium due on or after today.
//
// Returns { date, days, overdue }, or null when there is nothing left to
// pay (closed policy, or the paying term is over).
// overdue is true only for a single-payment policy whose renewal date has
// already passed: that date is never advanced automatically, so it means
// "update the renewal date".
function insNextDue(policy, todayIso) {

    if (policy.status === "Closed") {
        return null;
    }

    // Look far enough ahead to always find the next date, however long the
    // interval; 40 years is beyond any policy term.
    const horizon = insAddMonths(todayIso, 12 * 40);

    const dues = insDueDates(policy, horizon);

    const upcoming = dues.find(d => d >= todayIso);

    if (upcoming) {
        return { date: upcoming, days: insDaysBetween(todayIso, upcoming), overdue: false };
    }

    if (insIsSinglePayment(policy) && policy.maturity_date && policy.maturity_date < todayIso) {
        return { date: policy.maturity_date, days: insDaysBetween(todayIso, policy.maturity_date), overdue: true };
    }

    return null;
}


// Which of the policy's due dates is this RD saving for?
//
// 1. If the RD has a needed-by date, the nearest due date within 60 days
//    of it -- the date you said you need the money is the best evidence.
// 2. Otherwise (or if none is that close) the first due date on or after
//    the RD's maturity date.
// Returns an ISO date, or null.
function insDueForRd(policy, rd, todayIso) {

    const reach = rd.maturity_date && rd.maturity_date > todayIso ? rd.maturity_date : todayIso;
    const horizon = insAddMonths(reach, 12 * 5);

    // Include recent past due dates too, so an RD that matured just after one
    // is still tied to the right cycle.
    const dues = insDueDates(policy, horizon);

    if (dues.length === 0) {
        return null;
    }

    if (rd.needed_by) {

        let best = null;
        let bestGap = Infinity;

        for (const d of dues) {

            const gap = Math.abs(insDaysBetween(rd.needed_by, d));

            if (gap < bestGap) {
                best = d;
                bestGap = gap;
            }
        }

        if (best !== null && bestGap <= INS_NEEDED_BY_WINDOW_DAYS) {
            return best;
        }
    }

    return dues.find(d => d >= rd.maturity_date) || null;
}


// How well the policy's active, linked RDs cover its NEXT premium.
//
// Returns:
//   status "none"    -- no active RD is saving for the next due date
//   status "late"    -- at least one matures after the due date
//   status "short"   -- all on time, but the total is below the premium
//   status "covered" -- all on time and the total meets the premium
//   status "unknown" -- the policy has no premium amount to compare with
//   status "n/a"     -- nothing is due (closed, or paying term over)
// plus due, premium, rds (the matching ones, soonest first), total (of the
// on-time ones), gap (+spare / -short) and lateDays (the worst lateness).
function insFunding(policy, linkedRds, todayIso) {

    const next = insNextDue(policy, todayIso);

    if (!next) {
        return { status: "n/a", due: null, premium: policy.premium_amount, rds: [], total: 0, gap: 0, lateDays: 0 };
    }

    const premium = policy.premium_amount === null || policy.premium_amount === undefined
        ? null
        : Number(policy.premium_amount);

    const rds = linkedRds
        .filter(r => r.insurance_policy_id === policy.insurance_policy_id && r.status === "Active")
        .filter(r => insDueForRd(policy, r, todayIso) === next.date)
        .sort((a, b) => a.maturity_date.localeCompare(b.maturity_date));

    let lateDays = 0;
    let total = 0;

    for (const r of rds) {

        const late = insDaysBetween(next.date, r.maturity_date);

        if (late > 0) {
            lateDays = Math.max(lateDays, late);
        } else {
            total += Number(r.maturity_amount);
        }
    }

    const out = { due: next.date, premium, rds, total, lateDays, gap: premium === null ? 0 : total - premium };

    if (rds.length === 0) {
        out.status = "none";
    } else if (lateDays > 0) {
        out.status = "late";
    } else if (premium === null) {
        out.status = "unknown";
    } else {
        out.status = total >= premium ? "covered" : "short";
    }

    return out;
}
