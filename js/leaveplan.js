// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE

// leaveplan.js
// Combines two different sources into one simple list:
//   - Leave: pulled from attendance_log (hr_type_frozen = 'Leave') —
//     only shows if you've actually logged it, including pre-logging a
//     future planned leave day ahead of time
//   - Holiday: pulled directly from holiday_master — known in advance,
//     doesn't require individually logging each one first
// No 365-day restriction here; this page is meant to look forward too.

let lpAllRows = [];


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        document.getElementById("lpFromDate").value = getToday();

        const now = new Date();
        const yearEnd = `${now.getFullYear()}-12-31`;
        document.getElementById("lpToDate").value = yearEnd;

        await loadLeavePlanData();

        renderLeavePlan();
    }
);


async function loadLeavePlanData() {

    const leaveRows = await getData("attendance_log?hr_type_frozen=eq.Leave&order=log_date.asc");
    const holidayRows = await getData("holiday_master?order=holiday_date.asc");

    const leaves = (Array.isArray(leaveRows) ? leaveRows : []).map(r => ({
        date: r.log_date,
        type: "Leave",
        details: r.description || r.reason || r.code
    }));

    const holidays = (Array.isArray(holidayRows) ? holidayRows : []).map(r => ({
        date: r.holiday_date,
        type: "Holiday",
        details: `${r.holiday_name} (${r.holiday_type})`
    }));

    lpAllRows = [...leaves, ...holidays].sort((a, b) => a.date.localeCompare(b.date));
}


function renderLeavePlan() {

    const from = document.getElementById("lpFromDate").value;
    const to = document.getElementById("lpToDate").value;
    const typeFilter = document.getElementById("lpTypeFilter").value;

    let rows = lpAllRows.filter(r => r.date >= from && r.date <= to);

    if (typeFilter !== "all") {
        rows = rows.filter(r => r.type === typeFilter);
    }

    const tbody = document.getElementById("lpBody");

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="wb-empty-state">No entries in this range.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${formatDate(r.date)}</td>
            <td><span class="att-code-tag ${r.type.toLowerCase()}">${r.type}</span></td>
            <td>${r.details}</td>
        </tr>
    `).join("");
}


function exportLeavePlanCsv() {

    const from = document.getElementById("lpFromDate").value;
    const to = document.getElementById("lpToDate").value;
    const typeFilter = document.getElementById("lpTypeFilter").value;

    let rows = lpAllRows.filter(r => r.date >= from && r.date <= to);

    if (typeFilter !== "all") {
        rows = rows.filter(r => r.type === typeFilter);
    }

    const lines = ["Date,Type,Details"];

    rows.forEach(r => {
        lines.push([r.date, r.type, r.details.replace(/,/g, ";")].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `Leave_Plan_${getToday()}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showSuccess("Leave Plan exported");
}
