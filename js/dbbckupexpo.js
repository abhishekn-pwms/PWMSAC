// AC v1.7 DB BACKUP/EXPORT PASS 2

// backup.js
// Data Safety page — exports and full-replace backup push to pwms_prev.
// All 8 tables, every time, no partial operations, per explicit design.

const BACKUP_TABLES = [
    { name: "portfolio", pk: "portfolio_id" },
    { name: "project", pk: "project_id" },
    { name: "milestone", pk: "milestone_id" },
    { name: "activity", pk: "activity_id" },
    { name: "todo", pk: "todo_id" },
    { name: "task_log", pk: "task_log_id" },
    { name: "update_prep_settings", pk: "setting_key" },
    { name: "update_prep_history", pk: "history_id" },
    { name: "personal_profile", pk: "profile_id" },
    { name: "employment_history", pk: "employment_id" },
    { name: "attendance_codes", pk: "code" },
    { name: "holiday_master", pk: "holiday_id" },
    { name: "attendance_log", pk: "log_date" }
];

// Parents before children, so a child's foreign key always has
// somewhere valid to point during insert. attendance_codes must
// precede attendance_log (the only real dependency among the
// attendance tables) — the other three attendance tables have no
// dependencies and can sit anywhere.
const INSERT_ORDER = [
    "portfolio", "project", "milestone", "activity",
    "todo", "task_log",
    "update_prep_settings", "update_prep_history",
    "personal_profile", "employment_history",
    "attendance_codes", "holiday_master", "attendance_log"
];

// Children before parents, so nothing is still referenced when its
// parent gets deleted. attendance_log must precede attendance_codes.
const DELETE_ORDER = [
    "task_log", "todo", "activity", "milestone", "project", "portfolio",
    "update_prep_settings", "update_prep_history",
    "attendance_log", "attendance_codes",
    "personal_profile", "employment_history", "holiday_master"
];

let backupData = {};


// ======================================
// PAGINATED FETCH — PostgREST caps any single request at a default row
// limit (commonly 1000), silently truncating anything beyond it unless
// explicitly paginated. This fetches page by page until a page comes
// back with fewer rows than requested, guaranteeing every row is
// retrieved regardless of table size. Same fix as Data Query's.
// ======================================

async function fetchAllRowsPaginated(tableName) {

    const PAGE_SIZE = 1000;
    let allRows = [];
    let offset = 0;

    while (true) {

        const page = await getData(`${tableName}?limit=${PAGE_SIZE}&offset=${offset}`);
        const pageRows = Array.isArray(page) ? page : [];

        allRows = allRows.concat(pageRows);

        if (pageRows.length < PAGE_SIZE) {
            break;
        }

        offset += PAGE_SIZE;
    }

    return allRows;
}


// ======================================
// SHARED PROGRESS LOG — every action writes into this, appending
// timestamped lines, not overwriting. Auto-scrolls to the latest line.
// ======================================

function logBackup(message) {

    const log = document.getElementById("bkProgressLog");
    const time = new Date().toLocaleTimeString();

    log.value += `[${time}] ${message}\n`;
    log.scrollTop = log.scrollHeight;
}


function clearBackupLog() {

    document.getElementById("bkProgressLog").value = "";
}


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        await loadAllBackupData();
    }
);


// ======================================
// LOAD — always all 8 tables, raw tables not views, since these are
// the base rows that actually need restoring (views get recreated by
// running the SQL scripts, not exported/pushed as data).
// ======================================

async function loadAllBackupData() {

    const strip = document.getElementById("bkSummaryStrip");
    strip.innerHTML = `<div class="stat-chip">Loading table counts...</div>`;

    logBackup("Refreshing table counts from live...");

    for (const t of BACKUP_TABLES) {

        backupData[t.name] = await fetchAllRowsPaginated(t.name);

        logBackup(`  ${t.name}: ${backupData[t.name].length} row(s)`);
    }

    logBackup("Table counts refreshed.");

    renderSummary();
}


function renderSummary() {

    const strip = document.getElementById("bkSummaryStrip");

    strip.innerHTML = BACKUP_TABLES
        .map(t => `<div class="stat-chip">${t.name}: ${backupData[t.name].length}</div>`)
        .join("");
}


// ======================================
// CSV EXPORT — zipped, one file per table
// ======================================

async function exportCsvZip() {

    logBackup("Starting CSV export...");

    const zip = new JSZip();

    BACKUP_TABLES.forEach(t => {
        zip.file(`${t.name}.csv`, convertToCsv(backupData[t.name]));
        logBackup(`  Added ${t.name}.csv (${backupData[t.name].length} row(s))`);
    });

    logBackup("Compressing zip...");

    const blob = await zip.generateAsync({ type: "blob" });

    downloadBlob(`PWMS_DbBckupExpo_CSV_${getToday()}.zip`, blob);

    logBackup("CSV export downloaded.");

    showSuccess("CSV export downloaded");
}


function convertToCsv(rows) {

    if (!rows || rows.length === 0) {
        return "";
    }

    const headers = Object.keys(rows[0]);

    const escapeCsv = (val) => {

        if (val === null || val === undefined) {
            return "";
        }

        const str = String(val);

        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return '"' + str.replace(/"/g, '""') + '"';
        }

        return str;
    };

    const lines = [headers.join(",")];

    rows.forEach(row => {
        lines.push(headers.map(h => escapeCsv(row[h])).join(","));
    });

    return lines.join("\n");
}


// ======================================
// JSON EXPORT — single file, one key per table
// ======================================

function exportJson() {

    logBackup("Starting JSON export...");

    const combined = {};

    BACKUP_TABLES.forEach(t => {
        combined[t.name] = backupData[t.name];
        logBackup(`  Added ${t.name} (${backupData[t.name].length} row(s))`);
    });

    downloadText(
        `PWMS_DbBckupExpo_JSON_${getToday()}.json`,
        JSON.stringify(combined, null, 2),
        "application/json"
    );

    logBackup("JSON export downloaded.");

    showSuccess("JSON export downloaded");
}


// ======================================
// PUSH TO PWMS_PREV — full replace, not a single atomic transaction
// (REST calls, not wrapped in one DB transaction), so a failure
// partway through is surfaced explicitly rather than hidden.
// ======================================

async function pushToPrev() {

    if (!confirmAction(
        "This will DELETE all data currently in pwms_prev and replace it with a fresh copy of live data. This cannot be undone. Continue?"
    )) {
        return;
    }

    const statusEl = document.getElementById("bkPushStatus");
    statusEl.textContent = "Starting push to pwms_prev...";

    logBackup("=== Push to pwms_prev started ===");

    try {

        for (const tableName of DELETE_ORDER) {

            statusEl.textContent = `Clearing ${tableName}...`;
            logBackup(`  Clearing ${tableName} in pwms_prev...`);

            const table = BACKUP_TABLES.find(t => t.name === tableName);
            await deleteAllDataPrev(table.name, table.pk);

            logBackup(`  Cleared ${tableName}.`);
        }

        for (const tableName of INSERT_ORDER) {

            const rows = backupData[tableName] || [];

            if (rows.length === 0) {
                logBackup(`  Skipping ${tableName} — no rows to insert.`);
                continue;
            }

            statusEl.textContent = `Inserting ${tableName} (${rows.length} rows)...`;
            logBackup(`  Inserting ${rows.length} row(s) into ${tableName}...`);

            await insertDataPrev(tableName, rows);

            logBackup(`  Inserted ${tableName}.`);
        }

        statusEl.textContent = `✅ Push complete — ${new Date().toLocaleString()}`;
        logBackup("=== Push to pwms_prev complete ===");

        showSuccess("Push to pwms_prev complete");

    } catch (error) {

        console.error(error);

        statusEl.textContent = "❌ Push failed partway through — pwms_prev may be in a partial state. Check console, fix the issue, then run the push again from the start.";
        logBackup(`=== Push FAILED: ${error.message || error} ===`);

        showError("Push to pwms_prev failed — see status message for details");
    }
}


// ======================================
// SQL SEED GENERATION — one-time tool, separate from the standard
// export flow. All 8 tables, including replacing the current
// placeholder todo seed with real data.
// ======================================

async function generateSqlSeeds() {

    logBackup("Starting SQL seed generation...");

    const zip = new JSZip();

    const seedNumbers = {
        portfolio: "3010",
        project: "3020",
        milestone: "3030",
        activity: "3040",
        todo: "3050",
        task_log: "3060",
        update_prep_settings: "3070",
        update_prep_history: "3080",
        personal_profile: "3090",
        employment_history: "3100",
        attendance_codes: "3110",
        holiday_master: "3120",
        attendance_log: "3130"
    };

    BACKUP_TABLES.forEach(t => {

        let rows = backupData[t.name];

        // attendance_log is deliberately scoped to May–Dec 2022 only
        // here — enough real data to not start from nothing, without
        // seeding four-plus years of history every time this runs.
        // CSV/JSON export and Push to pwms_prev are unaffected — both
        // still use the full live dataset, unrestricted.
        if (t.name === "attendance_log") {
            rows = rows.filter(r => r.log_date >= "2022-05-30" && r.log_date <= "2022-12-31");
        }

        const number = seedNumbers[t.name];
        const filename = `${number}_Seed_${toPascalCase(t.name)}.sql`;

        zip.file(filename, generateInsertSql(t.name, rows));
        logBackup(`  Generated ${filename} (${rows.length} row(s))`);
    });

    logBackup("Compressing zip...");

    const blob = await zip.generateAsync({ type: "blob" });

    downloadBlob(`PWMS_DbBckupExpo_SeedSQL_${getToday()}.zip`, blob);

    logBackup("SQL seed files downloaded.");

    showSuccess("SQL seed files generated");
}


function generateInsertSql(tableName, rows) {

    if (!rows || rows.length === 0) {
        return `-- No data in ${tableName} at time of generation (${getToday()})\n`;
    }

    const columns = Object.keys(rows[0]);

    let sql = `-- Seed data for ${tableName}, generated from live data on ${getToday()}\n\n`;
    sql += `insert into ${tableName} (${columns.join(", ")}) values\n`;

    const valueLines = rows.map(row =>
        "(" + columns.map(c => sqlValue(row[c])).join(", ") + ")"
    );

    sql += valueLines.join(",\n") + ";\n";

    return sql;
}


function sqlValue(val) {

    if (val === null || val === undefined) {
        return "null";
    }

    if (typeof val === "boolean") {
        return val ? "true" : "false";
    }

    if (typeof val === "number") {
        return String(val);
    }

    return "'" + String(val).replace(/'/g, "''") + "'";
}


function toPascalCase(str) {

    return str
        .split("_")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
}


// ======================================
// DOWNLOAD HELPERS
// ======================================

function downloadBlob(filename, blob) {

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}


function downloadText(filename, text, mimeType) {

    downloadBlob(filename, new Blob([text], { type: mimeType }));
}
