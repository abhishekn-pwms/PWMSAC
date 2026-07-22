// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE PASS 2

// attendance.js
// Main Attendance page — Log Today, Recent Entries (15 days), gap badge
// (rolling 365-day window), bulk weekend fill, holiday/tenure/month
// widgets, and the shared Edit modal.

const ATT_WINDOW_MONTHS = 6;
const ATT_RECENT_DAYS = 15;

// Isolated on purpose — later changing ATT_WINDOW_MONTHS to 6, 3,
// whatever, is the only edit needed. Snaps to the 1st of whichever
// month is (ATT_WINDOW_MONTHS - 1) months before the current one, so
// every month in the window is a complete calendar month except the
// current one, which is unavoidably partial (today isn't month-end yet).
function getWindowStartDate(monthsBack) {

    const today = new Date(getToday() + "T00:00:00");
    const start = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);

    return toLocalDateStr(start);
}

let attCodes = [];
let attHolidays = [];
let attCurrentEmployment = null;
let attLogRecent = {};   // log_date -> row, within recent window
let attLogRolling = {};  // log_date -> row, within 365-day window (for gaps)


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        document.getElementById("attLogDate").value = getToday();

        await loadAttendancePage();
    }
);


// ======================================
// LOAD
// ======================================

async function loadAttendancePage() {

    const codesData = await getData("attendance_codes?order=code.asc");
    attCodes = Array.isArray(codesData) ? codesData : [];

    const holidaysData = await getData("holiday_master?order=holiday_date.asc");
    attHolidays = Array.isArray(holidaysData) ? holidaysData : [];

    const empData = await getData("vw_current_employment");
    attCurrentEmployment = (Array.isArray(empData) && empData.length > 0) ? empData[0] : null;

    populateCodeDropdown("attLogCode");
    document.getElementById("attLogCode").value = "WFH";

    await loadRecentEntries();
    await loadRollingWindowAndGaps();

    await onAttLogDateChanged();

    renderNextHoliday();
    renderTenure();
    await renderThisMonth();
}


function populateCodeDropdown(selectId) {

    const select = document.getElementById(selectId);

    select.innerHTML = attCodes
        .map(c => `<option value="${c.code}">${c.code} — ${c.attendance_type}</option>`)
        .join("");
}


// ======================================
// REASON AUTO-SUGGESTION
// ======================================

function getSuggestedReason(code, dateStr) {

    const codeRow = attCodes.find(c => c.code === code);

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

        const holiday = attHolidays.find(h => h.holiday_date === dateStr);

        if (holiday) {
            return `${holiday.holiday_type} Holiday — ${holiday.holiday_name}`;
        }

        return codeRow.attendance_type;
    }

    return codeRow.attendance_type.toUpperCase();
}


async function onAttLogDateChanged() {

    const dateStr = document.getElementById("attLogDate").value;

    if (!dateStr) {
        return;
    }

    // Check memory first (today/recent window already loaded), fall
    // back to a direct fetch for dates outside that window.
    let entry = attLogRecent[dateStr] || attLogRolling[dateStr];

    if (!entry) {
        const rows = await getData(`attendance_log?log_date=eq.${dateStr}`);
        entry = (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;
    }

    const note = document.getElementById("attLogModeNote");
    const saveBtn = document.getElementById("attLogSaveBtn");

    if (entry) {

        // Add-only — never load existing values into this form, and
        // never allow Save to silently overwrite. The Edit modal
        // (row click, in Recent Entries below) is the one and only
        // way to change an existing entry.
        note.textContent = `Already logged for ${formatDate(dateStr)} — click the entry below to edit it.`;
        note.style.color = "var(--danger-strong)";

        if (saveBtn) saveBtn.disabled = true;

    } else {

        onAttLogCodeChanged();
        document.getElementById("attLogOracle").checked = false;

        note.textContent = `No entry yet for ${formatDate(dateStr)} — this will create a new one.`;
        note.style.color = "";

        if (saveBtn) saveBtn.disabled = false;
    }
}


function onAttLogCodeChanged() {

    const code = document.getElementById("attLogCode").value;
    const date = document.getElementById("attLogDate").value;

    document.getElementById("attLogReason").value = getSuggestedReason(code, date);
}


// ======================================
// SAVE (insert if new, update in place if that date already exists —
// duplicate-prevented by the primary key, but always editable)
// ======================================

async function saveAttendanceLog() {

    const logDate = document.getElementById("attLogDate").value;
    const code = document.getElementById("attLogCode").value;
    const reason = document.getElementById("attLogReason").value;

    if (!logDate || !code) {
        showError("Date and Code are required");
        return;
    }

    const existing = await getData(`attendance_log?log_date=eq.${logDate}`);

    if (Array.isArray(existing) && existing.length > 0) {
        showError("Already logged for this date — click the entry below to edit it instead.");
        return;
    }

    const codeRow = attCodes.find(c => c.code === code);
    const oracleUpdated = document.getElementById("attLogOracle").checked;

    const payload = {
        code,
        reason,
        description: codeRow.attendance_type,
        hr_type_frozen: codeRow.hr_type,
        oracle_updated: oracleUpdated,
        // No UI for these on this form by design — every new entry gets
        // the standard workday default explicitly, rather than relying
        // on the DB column default (which is currently misconfigured —
        // log_end_time defaults to 08:30:00, same as start).
        log_start_time: "08:30:00",
        log_end_time: "17:00:00"
    };

    await insertData("attendance_log", { log_date: logDate, ...payload });
    showSuccess("Entry saved");

    await loadRecentEntries();
    await loadRollingWindowAndGaps();
    await renderThisMonth();
    await onAttLogDateChanged();
}


// ======================================
// RECENT ENTRIES (last 15 days, gaps shown inline)
// ======================================

async function loadRecentEntries() {

    const today = getToday();
    const from = shiftDate(today, -(ATT_RECENT_DAYS - 1));

    const rows = await getData(`attendance_log?log_date=gte.${from}&log_date=lte.${today}`);

    attLogRecent = {};
    (Array.isArray(rows) ? rows : []).forEach(r => { attLogRecent[r.log_date] = r; });

    const dates = [];
    for (let d = new Date(today + "T00:00:00"); d >= new Date(from + "T00:00:00"); d.setDate(d.getDate() - 1)) {
        dates.push(toLocalDateStr(d));
    }

    const tbody = document.getElementById("attRecentBody");

    tbody.innerHTML = dates.map(dateStr => renderRecentRow(dateStr)).join("");
}


// Shared by the Recent Entries table and the Edit modal's live display —
// one place this math can ever be wrong, not three. Accepts HH:MM or
// HH:MM:SS either way. Returns "—" if either time is missing, or if end
// is before start (can't produce a sane duration).
function calculateHoursDisplay(startTime, endTime) {

    if (!startTime || !endTime) {
        return "—";
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    const minutes = (eh * 60 + em) - (sh * 60 + sm);

    if (minutes < 0) {
        return "—";
    }

    const hours = Math.round((minutes / 60) * 10) / 10;

    return `${hours}h`;
}


function renderRecentRow(dateStr) {

    const date = new Date(dateStr + "T00:00:00");
    const dow = date.getDay();
    const isWeekend = (dow === 0 || dow === 6);
    const dayLabel = date.toLocaleDateString("en-IN", { weekday: "short" });
    const entry = attLogRecent[dateStr];

    if (entry) {

        const oracleTag = entry.oracle_updated
            ? ""
            : `<span style="font-size:0.68rem; color:var(--warning); font-weight:700; margin-left:6px;">🔶 Oracle pending</span>`;

        const startDisplay = entry.log_start_time ? entry.log_start_time.substring(0, 5) : "—";
        const endDisplay = entry.log_end_time ? entry.log_end_time.substring(0, 5) : "—";
        const hoursDisplay = calculateHoursDisplay(entry.log_start_time, entry.log_end_time);

        return `
            <tr onclick="openAttEditModal('${dateStr}')">
                <td>${formatDate(dateStr)}</td>
                <td>${dayLabel}</td>
                <td><span class="att-code-tag ${entry.hr_type_frozen.toLowerCase()}">${entry.code}</span></td>
                <td>${entry.reason || ""}${oracleTag} <span style="float:right; color:var(--primary);">✏️</span></td>
                <td>${startDisplay}</td>
                <td>${endDisplay}</td>
                <td>${hoursDisplay}</td>
            </tr>
        `;
    }

    if (isWeekend) {
        return `
            <tr class="att-row-missed-weekend">
                <td>${formatDate(dateStr)}</td>
                <td>${dayLabel}</td>
                <td colspan="5">No entry — use the bulk button above, or log manually</td>
            </tr>
        `;
    }

    return `
        <tr class="att-row-missed-weekday">
            <td>${formatDate(dateStr)}</td>
            <td>${dayLabel}</td>
            <td colspan="5">⚠️ No entry logged</td>
        </tr>
    `;
}


// ======================================
// ROLLING 365-DAY WINDOW + GAP BADGE
// Weekday gaps only — missing weekends aren't "gaps" in the sense that
// matters here, they have their own bulk-fix action.
// ======================================

async function loadRollingWindowAndGaps() {

    const today = getToday();
    const from = getWindowStartDate(ATT_WINDOW_MONTHS);

    const rows = await getData(`attendance_log?log_date=gte.${from}&log_date=lte.${today}`);

    attLogRolling = {};
    (Array.isArray(rows) ? rows : []).forEach(r => { attLogRolling[r.log_date] = r; });

    let gapCount = 0;

    for (let d = new Date(from + "T00:00:00"); d <= new Date(today + "T00:00:00"); d.setDate(d.getDate() + 1)) {

        const dateStr = toLocalDateStr(d);
        const dow = d.getDay();
        const isWeekend = (dow === 0 || dow === 6);


        const entry = attLogRolling[dateStr];
        const isGap = !isWeekend && (!entry || !entry.oracle_updated);

        if (isGap) {
            gapCount++;
        }


    }

    const alertEl = document.getElementById("attGapAlert");
    alertEl.style.display = "flex";

    if (gapCount === 0) {
        alertEl.className = "gap-alert gap-alert-ok";
        alertEl.innerHTML = `<span>✅ No gaps in the last ${ATT_WINDOW_MONTHS} months</span>`;
    } else {
        alertEl.className = "gap-alert";
        alertEl.innerHTML = `
            <span>⚠️ <b>${gapCount} gap(s)</b> found in the last ${ATT_WINDOW_MONTHS} months</span>
            <a href="attendance-report.html?gaps=1">View gaps in Report →</a>
        `;
    }
}


// ======================================
// BULK: MARK PAST UNLOGGED WEEKENDS AS WEEK-OFF
// Scoped to the same rolling 365-day window. Never touches future dates.
// ======================================

let attBulkFillRunning = false;

async function markPastWeekendsOff() {

    if (attBulkFillRunning) {
        showError("Already running — please wait for it to finish");
        return;
    }

    if (!confirmAction(`Mark every unlogged weekend in the last ${ATT_WINDOW_MONTHS} months as Week-Off?`)) {
        return;
    }

    attBulkFillRunning = true;

    const button = document.querySelector('button[onclick="markPastWeekendsOff()"]');
    if (button) {
        button.disabled = true;
        button.textContent = "Working...";
    }

    const today = getToday();
    const from = getWindowStartDate(ATT_WINDOW_MONTHS);
    const offCode = attCodes.find(c => c.code === "OFF");

    if (!offCode) {
        showError("OFF code not found in attendance_codes");
        attBulkFillRunning = false;
        if (button) { button.disabled = false; button.textContent = "⚡ Mark all unlogged weekends up to today as Week-Off"; }
        return;
    }

    let inserted = 0;
    let skippedAlreadyLogged = 0;
    let failed = 0;
    const failedDates = [];

    for (let d = new Date(from + "T00:00:00"); d <= new Date(today + "T00:00:00"); d.setDate(d.getDate() + 1)) {

        const dateStr = toLocalDateStr(d);

        // Belt-and-braces — this loop condition already prevents it,
        // but never attempt a future date under any circumstance.
        if (dateStr > today) {
            continue;
        }

        const dow = d.getDay();
        const isWeekend = (dow === 0 || dow === 6);

        if (!isWeekend || attLogRolling[dateStr]) {
            continue;
        }

        try {

            const result = await insertData("attendance_log", {
                log_date: dateStr,
                code: "OFF",
                reason: getSuggestedReason("OFF", dateStr),
                description: offCode.attendance_type,
                hr_type_frozen: offCode.hr_type,
                oracle_updated: true
            });

            // A 409/constraint failure often comes back as an error object
            // in the body rather than throwing — check for that explicitly.
            if (result && result.code) {
                throw new Error(result.message || "insert rejected");
            }

            attLogRolling[dateStr] = { code: "OFF" }; // keep our own snapshot in sync mid-run
            inserted++;

        } catch (error) {

            console.error(`Failed to insert ${dateStr}:`, error);
            failed++;
            failedDates.push(dateStr);
        }
    }

    attBulkFillRunning = false;
    if (button) { button.disabled = false; button.textContent = "⚡ Mark all unlogged weekends up to today as Week-Off"; }

    let summary = `${inserted} inserted`;
    if (failed > 0) {
        summary += `, ${failed} failed (${failedDates.join(", ")}) — see console for details`;
    }

    if (failed > 0) {
        showError(summary);
    } else {
        showSuccess(summary);
    }

    await loadRecentEntries();
    await loadRollingWindowAndGaps();
}


// ======================================
// WIDGETS
// ======================================

function renderNextHoliday() {

    const today = getToday();
    const upcoming = attHolidays.find(h => h.holiday_date >= today);

    if (!upcoming) {
        document.getElementById("attNextHolidayDays").textContent = "—";
        document.getElementById("attNextHolidaySub").textContent = "No upcoming holidays in Holiday Master";
        return;
    }

    const days = Math.ceil((new Date(upcoming.holiday_date) - new Date(today)) / (1000 * 60 * 60 * 24));

    document.getElementById("attNextHolidayDays").textContent = `${days} day${days === 1 ? "" : "s"}`;
    document.getElementById("attNextHolidaySub").textContent = `${formatDate(upcoming.holiday_date)} — ${upcoming.holiday_name} (${upcoming.holiday_type})`;
}


function renderTenure() {

    if (!attCurrentEmployment) {
        document.getElementById("attTenure").textContent = "—";
        document.getElementById("attTenureSub").textContent = "No current employment record found";
        return;
    }

    const start = new Date(attCurrentEmployment.start_date);
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    document.getElementById("attTenure").textContent = `${years}y ${months}m`;
    document.getElementById("attTenureSub").textContent = `Since ${formatDate(attCurrentEmployment.start_date)}`;
}


async function renderThisMonth() {

    const now = new Date();
    const firstOfMonth = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const today = getToday();

    const rows = await getData(`attendance_log?log_date=gte.${firstOfMonth}&log_date=lte.${today}`);

    const list = Array.isArray(rows) ? rows : [];

    const counts = {};
    list.forEach(r => { counts[r.code] = (counts[r.code] || 0) + 1; });

    const summary = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => `${count} ${code}`)
        .join(" / ");

    document.getElementById("attMonthSummary").textContent = summary || "No entries yet";
    document.getElementById("attMonthSub").textContent = `${list.length} day(s) logged this month`;
}


// ======================================
// EDIT MODAL
// ======================================

function openAttEditModal(dateStr) {

    const entry = attLogRecent[dateStr] || attLogRolling[dateStr];

    if (!entry) {
        return;
    }

    document.getElementById("attEditDate").value = dateStr;
    document.getElementById("attEditDateDisplay").value = dateStr;

    populateCodeDropdown("attEditCode");
    document.getElementById("attEditCode").value = entry.code;
    document.getElementById("attEditReason").value = entry.reason || "";
    document.getElementById("attEditOracle").checked = !!entry.oracle_updated;

    // <input type="time"> expects HH:MM, DB values come back as
    // HH:MM:SS — strip to the first 5 characters. Fall back to the
    // standard workday default if either field is somehow blank.
    document.getElementById("attEditLogStart").value = (entry.log_start_time || "08:30:00").substring(0, 5);
    document.getElementById("attEditLogEnd").value = (entry.log_end_time || "17:00:00").substring(0, 5);

    updateAttEditHoursDisplay();

    openModal("attEditModal");
}


function updateAttEditHoursDisplay() {

    const start = document.getElementById("attEditLogStart").value;
    const end = document.getElementById("attEditLogEnd").value;

    document.getElementById("attEditHoursDisplay").textContent =
        calculateHoursDisplay(start, end);
}


function onAttEditCodeChanged() {

    const code = document.getElementById("attEditCode").value;
    const dateStr = document.getElementById("attEditDate").value;

    document.getElementById("attEditReason").value = getSuggestedReason(code, dateStr);
}


async function saveAttendanceEdit() {

    const dateStr = document.getElementById("attEditDate").value;
    const code = document.getElementById("attEditCode").value;
    const reason = document.getElementById("attEditReason").value;
    const oracleUpdated = document.getElementById("attEditOracle").checked;
    const logStart = document.getElementById("attEditLogStart").value;
    const logEnd = document.getElementById("attEditLogEnd").value;

    const codeRow = attCodes.find(c => c.code === code);

    await updateData("attendance_log", "log_date", dateStr, {
        code,
        reason,
        description: codeRow.attendance_type,
        hr_type_frozen: codeRow.hr_type,
        oracle_updated: oracleUpdated,
        log_start_time: logStart ? `${logStart}:00` : "08:30:00",
        log_end_time: logEnd ? `${logEnd}:00` : "17:00:00"
    });

    showSuccess("Entry updated");

    closeModal("attEditModal");

    await loadRecentEntries();
    await loadRollingWindowAndGaps();
    await renderThisMonth();
    await onAttLogDateChanged();
}


async function deleteAttendanceLog() {

    const dateStr = document.getElementById("attEditDate").value;

    if (!confirmAction(`Delete the entry for ${formatDate(dateStr)}?`)) {
        return;
    }

    await deleteData("attendance_log", "log_date", dateStr);

    showSuccess("Entry deleted");

    closeModal("attEditModal");

    await loadRecentEntries();
    await loadRollingWindowAndGaps();
    await renderThisMonth();
}


// ======================================
// DATE HELPER
// ======================================

// ======================================
// TIMEZONE-SAFE DATE HELPER
// .toISOString() always converts to UTC first — for any timezone ahead
// of UTC (like IST, +5:30), local midnight becomes the PREVIOUS day in
// UTC, silently shifting every date string back by one. This reads the
// LOCAL calendar fields directly instead, avoiding that entirely.
// ======================================

function toLocalDateStr(date) {

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}


function shiftDate(dateStr, days) {

    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);

    return toLocalDateStr(d);
}
