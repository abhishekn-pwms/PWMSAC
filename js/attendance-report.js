// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE

// attendance-report.js
// Full attendance history — but scoped to the rolling 365-day window,
// never further back, regardless of how much real data exists.
// Table always available; Calendar only when Scope = Month.

const ATTR_WINDOW_MONTHS = 6;

// Isolated on purpose, same reasoning as attendance.js — later changing
// ATTR_WINDOW_MONTHS to 6, 3, whatever, is the only edit needed.
function getWindowStartDate(monthsBack) {

    const today = new Date(getToday() + "T00:00:00");
    const start = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);

    return toLocalDateStr(start);
}

let attrAllRows = [];      // within the 365-day window only
let attrGapsOnly = false;
let attrSortColumn = "log_date";
let attrSortDirection = "desc";

let attrCodes = [];
let attrHolidays = [];


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateScopeSelectors();

        onAttScopeChanged();
        
        const params = new URLSearchParams(window.location.search);

        if (params.get("gaps") === "1") {
            setAttReportGapsOnly(true, /*skipRender*/ true);
        }

        await loadAttReportData();
        await loadAttrCodesAndHolidays();


        renderAttReport();
    }
);


async function loadAttrCodesAndHolidays() {

    const codesData = await getData("attendance_codes?order=code.asc");
    attrCodes = Array.isArray(codesData) ? codesData : [];

    const holidaysData = await getData("holiday_master?order=holiday_date.asc");
    attrHolidays = Array.isArray(holidaysData) ? holidaysData : [];
}


function getSuggestedReasonReport(code, dateStr) {

    const codeRow = attrCodes.find(c => c.code === code);

    if (!codeRow) {
        return "";
    }

    if (code === "OFF") {

        const dow = new Date(dateStr + "T00:00:00").getDay();

        if (dow === 6) return "SATURDAY WEEK-OFF";
        if (dow === 0) return "SUNDAY WEEK-OFF";

        return codeRow.attendance_type;
    }

    if (codeRow.hr_type === "Holiday") {

        const holiday = attrHolidays.find(h => h.holiday_date === dateStr);

        if (holiday) {
            return `${holiday.holiday_type} Holiday — ${holiday.holiday_name}`;
        }

        return codeRow.attendance_type;
    }

    return codeRow.attendance_type.toUpperCase();
}


function populateAttrCodeDropdown() {

    document.getElementById("attEditCode").innerHTML = attrCodes
        .map(c => `<option value="${c.code}">${c.code} — ${c.attendance_type}</option>`)
        .join("");
}


function openAttEditModal(dateStr) {

    const entry = attrAllRows.find(r => r.log_date === dateStr);

    if (!entry) {
        return;
    }

    document.getElementById("attEditDate").value = dateStr;
    document.getElementById("attEditDateDisplay").value = dateStr;

    populateAttrCodeDropdown();
    document.getElementById("attEditCode").value = entry.code;
    document.getElementById("attEditReason").value = entry.reason || "";
    document.getElementById("attEditOracle").checked = !!entry.oracle_updated;

    openModal("attEditModal");
}


function onAttEditCodeChanged() {

    const code = document.getElementById("attEditCode").value;
    const dateStr = document.getElementById("attEditDate").value;

    document.getElementById("attEditReason").value = getSuggestedReasonReport(code, dateStr);
}


async function saveAttendanceEditFromReport() {

    const dateStr = document.getElementById("attEditDate").value;
    const code = document.getElementById("attEditCode").value;
    const reason = document.getElementById("attEditReason").value;
    const oracleUpdated = document.getElementById("attEditOracle").checked;

    const codeRow = attrCodes.find(c => c.code === code);

    await updateData("attendance_log", "log_date", dateStr, {
        code,
        reason,
        description: codeRow.attendance_type,
        hr_type_frozen: codeRow.hr_type,
        oracle_updated: oracleUpdated
    });

    showSuccess("Entry updated");

    closeModal("attEditModal");

    await loadAttReportData();
    renderAttReport();
}


async function deleteAttendanceLogFromReport() {

    const dateStr = document.getElementById("attEditDate").value;

    if (!confirmAction(`Delete the entry for ${formatDate(dateStr)}?`)) {
        return;
    }

    await deleteData("attendance_log", "log_date", dateStr);

    showSuccess("Entry deleted");

    closeModal("attEditModal");

    await loadAttReportData();
    renderAttReport();
}


// ======================================
// LOAD — always the rolling 365-day window, nothing further back
// ======================================

async function loadAttReportData() {

    const today = getToday();
    const from = getWindowStartDate(ATTR_WINDOW_MONTHS);

    const rows = await getData(`attendance_log?log_date=gte.${from}&log_date=lte.${today}&order=log_date.desc`);

    attrAllRows = Array.isArray(rows) ? rows : [];
}


function populateScopeSelectors() {

    const today = new Date();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Exactly ATTR_WINDOW_MONTHS months populate here — the same number
    // driving the actual data window (getWindowStartDate), so the
    // dropdown can never offer a month that falls outside it.
    const monthSelect = document.getElementById("attMonthSelect");
    const yearSelect = document.getElementById("attYearSelect");

    const options = [];
    const seenYears = new Set();

    for (let i = 0; i < ATTR_WINDOW_MONTHS; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        options.push({ month: d.getMonth(), year: d.getFullYear(), label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
        seenYears.add(d.getFullYear());
    }

    monthSelect.innerHTML = options
        .map(o => `<option value="${o.month}|${o.year}">${o.label}</option>`)
        .join("");

    yearSelect.innerHTML = [...seenYears]
        .sort((a, b) => b - a)
        .map(y => `<option value="${y}">${y}</option>`)
        .join("");

    document.getElementById("attWindowNote").textContent =
        `Report is limited to the last ${ATTR_WINDOW_MONTHS} months, regardless of how far back real data goes — use Data Query for anything older.`;

    document.getElementById("attFromDate").value = getWindowStartDate(ATTR_WINDOW_MONTHS);
    document.getElementById("attToDate").value = getToday();
}


// ======================================
// SCOPE / VIEW SWITCHING
// ======================================

function onAttScopeChanged() {

    const scope = document.getElementById("attScope").value;

    document.getElementById("attMonthField").style.display = (scope === "month") ? "flex" : "none";
    document.getElementById("attYearField").style.display = (scope === "year") ? "flex" : "none";
    document.getElementById("attFromField").style.display = (scope === "range") ? "flex" : "none";
    document.getElementById("attToField").style.display = (scope === "range") ? "flex" : "none";

    const calBtn = document.getElementById("attBtnCal");

    if (scope === "month") {
        calBtn.disabled = false;
    } else {
        calBtn.disabled = true;
        showAttReportView("table");
    }

    renderAttReport();
}


function showAttReportView(view) {

    if (view === "calendar" && document.getElementById("attBtnCal").disabled) {
        return;
    }

    document.getElementById("attReportTableView").style.display = (view === "table") ? "block" : "none";
    document.getElementById("attReportCalendarView").style.display = (view === "calendar") ? "block" : "none";

    document.getElementById("attBtnTable").classList.toggle("active", view === "table");
    document.getElementById("attBtnCal").classList.toggle("active", view === "calendar");

    renderAttReport();
}


function setAttReportGapsOnly(value, skipRender) {

    attrGapsOnly = value;

    document.getElementById("attViewAll").classList.toggle("active", !value);
    document.getElementById("attViewGaps").classList.toggle("active", value);

    if (!skipRender) {
        renderAttReport();
    }
}


function setAttReportSort(column) {

    if (attrSortColumn === column) {
        attrSortDirection = (attrSortDirection === "asc") ? "desc" : "asc";
    } else {
        attrSortColumn = column;
        attrSortDirection = "asc";
    }

    renderAttReport();
}


// ======================================
// SCOPE RESOLUTION — returns {from, to} within the current selection
// ======================================

function getCurrentScopeRange() {

    const scope = document.getElementById("attScope").value;

    if (scope === "month") {

        const [month, year] = document.getElementById("attMonthSelect").value.split("|").map(Number);
        const from = toLocalDateStr(new Date(year, month, 1));
        const to = toLocalDateStr(new Date(year, month + 1, 0));

        return { from, to };
    }

    if (scope === "year") {

        const year = Number(document.getElementById("attYearSelect").value);

        return { from: `${year}-01-01`, to: `${year}-12-31` };
    }

    return {
        from: document.getElementById("attFromDate").value,
        to: document.getElementById("attToDate").value
    };
}


// ======================================
// BUILD ROWS (real entries + gap placeholders) FOR THE CURRENT SCOPE
// ======================================

function buildScopedRows() {

    let { from, to } = getCurrentScopeRange();

    const today = getToday();
    const windowStart = getWindowStartDate(ATTR_WINDOW_MONTHS);

    // Never scan past today — a future day hasn't happened yet.
    if (to > today) {
        to = today;
    }

    // Never scan before the window start — attrAllRows was only ever
    // fetched from that point forward, so anything earlier would show
    // as a false gap (never fetched) rather than a genuine one.
    if (from < windowStart) {
        from = windowStart;
    }

    if (from > to) {
        return [];
    }

    const rowsByDate = {};
    attrAllRows.forEach(r => { rowsByDate[r.log_date] = r; });

    const result = [];

    for (let d = new Date(from + "T00:00:00"); d <= new Date(to + "T00:00:00"); d.setDate(d.getDate() + 1)) {

        const dateStr = toLocalDateStr(d);
        const dow = d.getDay();
        const isWeekend = (dow === 0 || dow === 6);
        const entry = rowsByDate[dateStr];

        if (entry) {
            result.push({ ...entry, isGap: false });
        } else if (!isWeekend) {
            result.push({ log_date: dateStr, isGap: true });
        }
        // unlogged weekends are simply omitted from the report entirely —
        // not gaps, not shown as rows
    }

    return result;
}


// ======================================
// RENDER — TABLE
// ======================================

function renderAttReport() {

    const fullScopedRows = buildScopedRows();

    renderAttStatStrip(fullScopedRows);

    let rows = fullScopedRows;

    if (attrGapsOnly) {
        rows = rows.filter(r => r.isGap);
    }

    rows.sort((a, b) => {

        let valA = a[attrSortColumn] || "";
        let valB = b[attrSortColumn] || "";

        if (valA < valB) return (attrSortDirection === "asc") ? -1 : 1;
        if (valA > valB) return (attrSortDirection === "asc") ? 1 : -1;
        return 0;
    });

    const tbody = document.getElementById("attReportBody");

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="wb-empty-state">No rows match.</td></tr>`;
    } else {
        tbody.innerHTML = rows.map(r => renderAttReportRow(r)).join("");
    }

    ["log_date", "code", "hr_type_frozen"].forEach(col => {
        const icon = document.getElementById(`attSortIcon_${col}`);
        icon.textContent = (col === attrSortColumn) ? (attrSortDirection === "asc" ? "▲" : "▼") : "";
    });

    renderAttReportCalendar(rows);
}


function renderAttStatStrip(rows) {

    const total = rows.length;
    const gaps = rows.filter(r => r.isGap).length;
    const logged = total - gaps;
    const oraclePending = rows.filter(r => !r.isGap && !r.oracle_updated).length;

    document.getElementById("attStatStrip").innerHTML = `
        <div class="stat-chip">${total} Total Day(s)</div>
        <div class="stat-chip">${logged} Logged</div>
        <div class="stat-chip">${gaps} Gap(s)</div>
        <div class="stat-chip">${oraclePending} Oracle Pending</div>
    `;
}


function renderAttReportRow(r) {

    const dayLabel = new Date(r.log_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });

    if (r.isGap) {
        return `
            <tr class="att-row-missed-weekday">
                <td>${formatDate(r.log_date)}</td>
                <td>${dayLabel}</td>
                <td colspan="3">⚠️ No entry logged</td>
            </tr>
        `;
    }

    const oracleTag = r.oracle_updated
        ? ""
        : `<span style="font-size:0.68rem; color:var(--warning); font-weight:700; margin-left:6px;">🔶 Oracle pending</span>`;

    return `
        <tr onclick="openAttEditModal('${r.log_date}')">
            <td>${formatDate(r.log_date)}</td>
            <td>${dayLabel}</td>
            <td><span class="att-code-tag ${(r.hr_type_frozen || "").toLowerCase()}">${r.code}</span></td>
            <td>${r.reason || ""}${oracleTag} <span style="float:right; color:var(--primary);">✏️</span></td>
            <td>${r.hr_type_frozen || ""}</td>
        </tr>
    `;
}


// ======================================
// RENDER — CALENDAR (Month scope only)
// ======================================

function renderAttReportCalendar(scopedRows) {

    const scope = document.getElementById("attScope").value;
    const grid = document.getElementById("attCalGrid");

    if (scope !== "month") {
        grid.innerHTML = "";
        return;
    }

    const [month, year] = document.getElementById("attMonthSelect").value.split("|").map(Number);

    const rowsByDate = {};
    scopedRows.forEach(r => { rowsByDate[r.log_date] = r; });

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDow = firstDay.getDay();

    let html = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
        .map(d => `<div class="att-cal-dow">${d}</div>`)
        .join("");

    for (let i = 0; i < startDow; i++) {
        html += `<div class="att-cal-day att-cal-blank"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {

        const dateStr = toLocalDateStr(new Date(year, month, day));
        const entry = rowsByDate[dateStr];

        if (entry && entry.isGap) {
            html += `<div class="att-cal-day att-cal-gap" onclick="window.location.href='attendance.html'"><div class="att-cal-daynum">${day}</div><div class="att-cal-daycode">⚠️</div></div>`;
        } else if (entry) {
            html += `<div class="att-cal-day"><div class="att-cal-daynum">${day}</div><div class="att-cal-daycode">${entry.code}</div></div>`;
        } else {
            html += `<div class="att-cal-day"><div class="att-cal-daynum">${day}</div></div>`;
        }
    }

    grid.innerHTML = html;
}


// ======================================
// EXPORT
// ======================================

function exportAttReportCsv() {

    let rows = buildScopedRows();

    if (attrGapsOnly) {
        rows = rows.filter(r => r.isGap);
    }

    const headers = ["log_date", "code", "reason", "hr_type_frozen"];

    const lines = [headers.join(",")];

    rows.forEach(r => {
        lines.push([
            r.log_date,
            r.isGap ? "GAP" : (r.code || ""),
            r.isGap ? "No entry logged" : (r.reason || "").replace(/,/g, ";"),
            r.isGap ? "" : (r.hr_type_frozen || "")
        ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `Attendance_Report_${getToday()}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showSuccess("Report exported");
}


// ======================================
// DATE HELPER
// ======================================

// ======================================
// TIMEZONE-SAFE DATE HELPER — same fix as attendance.js. .toISOString()
// converts to UTC first, silently shifting local dates back a day for
// any timezone ahead of UTC. This reads local calendar fields directly.
// ======================================

function toLocalDateStr(date) {

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}


function shiftDateStr(dateStr, days) {

    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);

    return toLocalDateStr(d);
}
