// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE

// payroll.js
// Deliberately minimal — no rolling-window restriction, since this page
// exists specifically for rare, further-back lookups (mainly LWD-type
// cases). Sourced entirely from vw_payroll_month, which already resolves
// each entry against whichever employment_history stint was active on
// that date, using that stint's own payroll cycle days.

let payAllRows = [];

const PAY_MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        await loadPayrollData();

        populatePayrollSelectors();

        renderPayrollView();
    }
);


async function loadPayrollData() {

    const rows = await getData("vw_payroll_month?order=log_date.desc");

    payAllRows = Array.isArray(rows) ? rows : [];
}


function populatePayrollSelectors() {

    const monthSelect = document.getElementById("payMonthSelect");
    const yearSelect = document.getElementById("payYearSelect");

    monthSelect.innerHTML = PAY_MONTH_NAMES
        .map((name, i) => `<option value="${i + 1}">${name}</option>`)
        .join("");

    const years = [...new Set(payAllRows.map(r => r.payroll_year))].sort((a, b) => b - a);

    yearSelect.innerHTML = years
        .map(y => `<option value="${y}">${y}</option>`)
        .join("");

    const now = new Date();
    monthSelect.value = now.getMonth() + 1;

    if (years.length > 0) {
        yearSelect.value = years[0];
    }
}


function renderPayrollView() {

    const month = Number(document.getElementById("payMonthSelect").value);
    const year = Number(document.getElementById("payYearSelect").value);

    const rows = payAllRows.filter(r => r.payroll_month === month && r.payroll_year === year);

    renderPayStatStrip(rows);

    const tbody = document.getElementById("payrollBody");

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="wb-empty-state">No entries for this payroll month.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${formatDate(r.log_date)}</td>
            <td><span class="att-code-tag ${(r.hr_type_frozen || "").toLowerCase()}">${r.code}</span></td>
            <td>${r.description || ""}</td>
            <td>${r.employer_name || "—"}</td>
            <td>${r.payroll_cycle_start_day || "?"} – ${r.payroll_cycle_end_day || "?"}</td>
        </tr>
    `).join("");
}


function renderPayStatStrip(rows) {

    const counts = {};

    rows.forEach(r => {
        const type = r.hr_type_frozen || "Unknown";
        counts[type] = (counts[type] || 0) + 1;
    });

    const chips = [`<div class="stat-chip">${rows.length} Total Day(s)</div>`];

    ["Presence", "Leave", "WeekOff", "Holiday"].forEach(type => {
        if (counts[type]) {
            chips.push(`<div class="stat-chip">${counts[type]} ${type}</div>`);
        }
    });

    document.getElementById("payStatStrip").innerHTML = chips.join("");
}
