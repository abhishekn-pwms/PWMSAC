// AC v2.0 FAMILY

// backup.js
// Data Safety page — exports and full-replace backup push to pwms_prev.
// All 8 tables, every time, no partial operations, per explicit design.

const BACKUP_TABLES = [
    { name: "portfolio", pk: "portfolio_id" },
    { name: "project", pk: "project_id" },
    { name: "milestone", pk: "milestone_id" },
    { name: "activity", pk: "activity_id" },
    { name: "todo", pk: "todo_id" },
    { name: "todo_attachments", pk: "attachment_id" },
    { name: "task_log", pk: "task_log_id" },
    { name: "update_prep_settings", pk: "setting_key" },
    { name: "update_prep_history", pk: "history_id" },
    { name: "update_prep_attachments", pk: "attachment_id" },
    { name: "personal_profile", pk: "profile_id" },
    { name: "employment_history", pk: "employment_id" },
    { name: "attendance_codes", pk: "code" },
    { name: "holiday_master", pk: "holiday_id" },
    { name: "attendance_log", pk: "log_date" },
    { name: "quicklog_entries", pk: "entry_id" },
    { name: "bank_account", pk: "bank_account_id" },
    { name: "deposit", pk: "deposit_id" },
    { name: "person", pk: "person_id" },
    { name: "insurance_policy", pk: "insurance_policy_id" },
    { name: "attachment", pk: "attachment_id" },
    { name: "contact", pk: "contact_id" },
    { name: "identity_document", pk: "identity_document_id" },
    { name: "card", pk: "card_id" },
    { name: "locker", pk: "locker_id" },
    { name: "mf_holding", pk: "mf_holding_id" },
    { name: "mf_valuation", pk: "mf_valuation_id" },
    { name: "family_summary_log", pk: "family_summary_log_id" }
];

// Maps each attachment table to the Storage bucket its storage_path
// values live in. Table rows and bucket files are backed up/restored
// as separate steps below (REST for rows, Storage REST for files) —
// there is no single call that does both together.
const ATTACHMENT_BUCKETS = {
    todo_attachments: "todo-attachments",
    update_prep_attachments: "updateprep-attachments",
    attachment: "records-attachments"
};

// Parents before children, so a child's foreign key always has
// somewhere valid to point during insert. attendance_codes must
// precede attendance_log (the only real dependency among the
// attendance tables) — the other three attendance tables have no
// dependencies and can sit anywhere.
const INSERT_ORDER = [
    "portfolio", "project", "milestone", "activity",
    "todo", "todo_attachments", "task_log",
    "update_prep_settings", "update_prep_history", "update_prep_attachments",
    "personal_profile", "employment_history",
    "attendance_codes", "holiday_master", "attendance_log",
    "quicklog_entries",
    "person", "contact", "insurance_policy", "bank_account", "deposit",
    "identity_document", "card", "locker",
    "mf_holding", "mf_valuation",
    "family_summary_log",
    "attachment"
];

// Children before parents, so nothing is still referenced when its
// parent gets deleted. attendance_log must precede attendance_codes.
// todo_attachments must precede todo; update_prep_attachments must
// precede update_prep_history — same cascade logic as todo/task_log.
// quicklog_entries has no foreign keys at all, so its position here
// doesn't matter — placed first since it's the simplest case.
// deposit must precede bank_account and insurance_policy (it points at both);
// attachment points at person, bank_account, deposit and insurance_policy, so it
// goes first; insurance_policy must precede person. bank_account points at
// contact, so it is cleared first; card and locker point at person and
// bank_account, identity_document at person; mf_holding at person and
// bank_account, and mf_valuation at mf_holding, so valuations go first.
const DELETE_ORDER = [
    "quicklog_entries", "family_summary_log",
    "attachment", "mf_valuation", "mf_holding", "locker", "card", "identity_document",
    "deposit", "bank_account", "contact", "insurance_policy", "person",
    "task_log", "todo_attachments", "todo", "activity", "milestone", "project", "portfolio",
    "update_prep_settings", "update_prep_attachments", "update_prep_history",
    "attendance_log", "attendance_codes",
    "personal_profile", "employment_history", "holiday_master"
];

let backupData = {};

// The tables that could not be read at the last refresh. A table that fails to
// read must never be treated as "empty": the push would then wipe the backup
// and copy nothing.
let backupLoadErrors = [];


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

    // Ordered by the primary key, so the pages never overlap or skip a row.
    const table = BACKUP_TABLES.find(t => t.name === tableName);
    const order = table ? `order=${table.pk}.asc&` : "";

    while (true) {

        const page = await getData(`${tableName}?${order}limit=${PAGE_SIZE}&offset=${offset}`);

        // A rejected or failed read comes back as an error object, not an array.
        // Fail loudly rather than carry on with a short or empty table.
        if (!Array.isArray(page)) {
            throw new Error(`Could not read ${tableName}`);
        }

        const pageRows = page;

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

    backupLoadErrors = [];

    for (const t of BACKUP_TABLES) {

        try {

            backupData[t.name] = await fetchAllRowsPaginated(t.name);

            logBackup(`  ${t.name}: ${backupData[t.name].length} row(s)`);

        } catch (error) {

            console.error(error);

            backupData[t.name] = [];
            backupLoadErrors.push(t.name);

            logBackup(`  \u26A0\uFE0F ${t.name}: could not be read`);
        }
    }

    if (backupLoadErrors.length > 0) {

        logBackup(`Table counts refreshed WITH ERRORS \u2014 could not read: ${backupLoadErrors.join(", ")}.`);

        showError(`Could not read from live: ${backupLoadErrors.join(", ")}`);

    } else {

        logBackup("Table counts refreshed.");
    }

    renderSummary();

    return backupLoadErrors.length === 0;
}


// Reloads live data fresh and says whether every table was read. Everything that
// copies or exports live data goes through this first, so it always acts on what
// is in the database now (not what was loaded when the page was opened) and never
// on a table that failed to read.
async function refreshLiveFor(action) {

    const ok = await loadAllBackupData();

    if (!ok) {
        showError(`${action} not done \u2014 live could not be read. Nothing was changed.`);
    }

    return ok;
}


function renderSummary() {

    const strip = document.getElementById("bkSummaryStrip");

    strip.innerHTML = BACKUP_TABLES
        .map(t => backupLoadErrors.includes(t.name)
            ? `<div class="stat-chip bk-chip-bad">${t.name}: not read</div>`
            : `<div class="stat-chip">${t.name}: ${backupData[t.name].length}</div>`)
        .join("");
}


// ======================================
// CSV EXPORT — zipped, one file per table
// ======================================

async function exportCsvZip() {

    logBackup("Starting CSV export...");

    if (!(await refreshLiveFor("CSV export"))) {
        return;
    }

    const zip = new JSZip();

    BACKUP_TABLES.forEach(t => {
        zip.file(`${t.name}.csv`, convertToCsv(backupData[t.name]));
        logBackup(`  Added ${t.name}.csv (${backupData[t.name].length} row(s))`);
    });

    logBackup("Fetching attachment files from Storage...");

    for (const tableName of Object.keys(ATTACHMENT_BUCKETS)) {

        const bucket = ATTACHMENT_BUCKETS[tableName];
        const rows = backupData[tableName] || [];

        for (const row of rows) {

            const { data: blob, error } =
                await supabaseClient.storage.from(bucket).download(row.storage_path);

            if (error || !blob) {
                logBackup(`  ⚠️ Could not fetch ${tableName}/${row.storage_path} — skipped (row still exported in CSV)`);
                continue;
            }

            zip.file(`attachments/${tableName}/${row.storage_path}`, blob);
        }

        logBackup(`  Added ${rows.length} file(s) from ${bucket}`);
    }

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

async function exportJson() {

    logBackup("Starting JSON export...");

    if (!(await refreshLiveFor("JSON export"))) {
        return;
    }

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

// Returns the names of any tables pwms_prev can't be read from (missing, or
// no read policy). Empty array means every table is there.
async function findUnreachablePrevTables() {

    const unreachable = [];

    for (const t of BACKUP_TABLES) {

        try {

            const probe = await getDataPrev(`${t.name}?limit=1`);

            if (!Array.isArray(probe)) {
                unreachable.push(t.name);
            }

        } catch (error) {

            unreachable.push(t.name);
        }
    }

    return unreachable;
}


async function pushToPrev() {

    const statusEl = document.getElementById("bkPushStatus");
    const passwordEl = document.getElementById("bkPrevPassword");
    const password = passwordEl ? passwordEl.value : "";

    // pwms_prev only lets in the dedicated backup login, so the push needs
    // its password. Checked first, before anything else is asked or done.
    if (!password) {

        statusEl.textContent = "Enter the backup login password above, then push again.";

        showError("Enter the backup login password first");

        return;
    }

    if (!confirmAction(
        "This will DELETE all data currently in pwms_prev and replace it with a fresh copy of live data. This cannot be undone. Continue?"
    )) {
        return;
    }

    statusEl.textContent = "Starting push to pwms_prev...";

    logBackup("=== Push to pwms_prev started ===");

    // Read live fresh first, before signing in or deleting anything: the push
    // must copy what is in the database NOW, and must never run on a table that
    // failed to read (it would wipe the backup and copy nothing).
    statusEl.textContent = "Reading live data...";

    if (!(await refreshLiveFor("Push"))) {

        statusEl.textContent = `\u274C Push not started \u2014 could not read from live: ${backupLoadErrors.join(", ")}. Nothing was deleted.`;
        logBackup(`=== Push NOT started: could not read ${backupLoadErrors.join(", ")} from live \u2014 nothing was deleted ===`);

        return;
    }

    statusEl.textContent = "Signing in to pwms_prev...";
    logBackup(`  Signing in to pwms_prev as ${PWMS_PREV_CONFIG.BACKUP_EMAIL}...`);

    const signedIn = await signInPrev(password);

    // The password has done its job — clear the box either way so it is
    // never left sitting on the page.
    passwordEl.value = "";

    if (!signedIn.ok) {

        statusEl.textContent = `❌ Push not started — could not sign in to pwms_prev (${signedIn.message}). Nothing was deleted.`;
        logBackup(`=== Push NOT started: pwms_prev sign-in failed (${signedIn.message}) — nothing was deleted ===`);

        showError("Could not sign in to pwms_prev — check the backup password");

        return;
    }

    logBackup("  Signed in to pwms_prev.");

    try {

        // Safeguard 1 — this push is delete-then-insert, so a table missing in
        // pwms_prev would otherwise be discovered only AFTER earlier tables had
        // already been emptied. Check every table is reachable first, and stop
        // before deleting anything if one isn't.
        statusEl.textContent = "Checking pwms_prev has every table...";
        logBackup("  Checking pwms_prev has every table...");

        const missingPrev = await findUnreachablePrevTables();

        if (missingPrev.length > 0) {

            const names = missingPrev.join(", ");

            statusEl.textContent = `❌ Push not started — pwms_prev can't read: ${names}. Nothing was deleted. Create those tables there (and their RLS policies) first.`;
            logBackup(`=== Push NOT started: pwms_prev can't read ${names} — nothing was deleted ===`);

            showError(`Push not started — pwms_prev is missing: ${names}`);

            return;
        }

        logBackup("  All tables present in pwms_prev.");

        try {

            for (const tableName of DELETE_ORDER) {

                statusEl.textContent = `Clearing ${tableName}...`;
                logBackup(`  Clearing ${tableName} in pwms_prev...`);

                const table = BACKUP_TABLES.find(t => t.name === tableName);

                // Safeguard 2 — deleteAllDataPrev reports failure by returning
                // false rather than throwing; don't carry on as if it worked.
                const cleared = await deleteAllDataPrev(table.name, table.pk);

                if (!cleared) {
                    throw new Error(`Could not clear ${tableName} in pwms_prev.`);
                }

                logBackup(`  Cleared ${tableName}.`);
            }

            for (const tableName of Object.keys(ATTACHMENT_BUCKETS)) {

                const bucket = ATTACHMENT_BUCKETS[tableName];

                statusEl.textContent = `Clearing ${bucket} bucket in pwms_prev...`;
                logBackup(`  Clearing all files in ${bucket} (pwms_prev)...`);

                // A refused delete comes back as false, not an exception.
                const bucketCleared = await clearBucketPrev(bucket);

                if (!bucketCleared) {
                    throw new Error(`Could not clear the ${bucket} bucket in pwms_prev.`);
                }

                logBackup(`  Cleared ${bucket}.`);
            }

            for (const tableName of INSERT_ORDER) {

                const rows = backupData[tableName] || [];

                if (rows.length === 0) {
                    logBackup(`  Skipping ${tableName} — no rows to insert.`);
                    continue;
                }

                statusEl.textContent = `Inserting ${tableName} (${rows.length} rows)...`;
                logBackup(`  Inserting ${rows.length} row(s) into ${tableName}...`);

                // Safeguard 3 — a rejected insert comes back as an error object,
                // not an array. Treat it as a failure instead of logging success.
                const inserted = await insertDataPrev(tableName, rows);

                if (!Array.isArray(inserted)) {

                    const detail = inserted && (inserted.message || inserted.hint);

                    throw new Error(`Insert into ${tableName} on pwms_prev failed${detail ? ` — ${detail}` : ""}.`);
                }

                logBackup(`  Inserted ${tableName}.`);

                if (ATTACHMENT_BUCKETS[tableName]) {

                    const bucket = ATTACHMENT_BUCKETS[tableName];

                    statusEl.textContent = `Copying files for ${tableName} (${rows.length})...`;
                    logBackup(`  Copying ${rows.length} file(s) into ${bucket} (pwms_prev)...`);

                    for (const row of rows) {

                        const { data: blob, error } =
                            await supabaseClient.storage.from(bucket).download(row.storage_path);

                        if (error || !blob) {
                            throw new Error(`Could not download ${tableName}/${row.storage_path} from live Storage — aborting so pwms_prev doesn't end up with rows pointing at missing files.`);
                        }

                        const uploaded = await uploadFilePrev(bucket, row.storage_path, blob);

                        if (!uploaded.ok) {
                            throw new Error(`Failed to upload ${row.storage_path} into ${bucket} on pwms_prev${uploaded.message ? ` \u2014 ${uploaded.message}` : ""}.`);
                        }
                    }

                    logBackup(`  Copied ${rows.length} file(s) into ${bucket}.`);
                }
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

    } finally {

        await signOutPrev();

        logBackup("  Signed out of pwms_prev.");
    }
}

// ======================================
// SQL SEED GENERATION — one-time tool, separate from the standard
// export flow. All 8 tables, including replacing the current
// placeholder todo seed with real data.
// ======================================

async function generateSqlSeeds() {

    logBackup("Starting SQL seed generation...");

    if (!(await refreshLiveFor("Seed generation"))) {
        return;
    }

    const zip = new JSZip();

    const seedNumbers = {
        portfolio: "3010",
        project: "3020",
        milestone: "3030",
        activity: "3040",
        todo: "3050",
        todo_attachments: "3055",
        task_log: "3060",
        update_prep_settings: "3070",
        update_prep_history: "3080",
        update_prep_attachments: "3085",
        personal_profile: "3090",
        employment_history: "3100",
        attendance_codes: "3110",
        holiday_master: "3120",
        attendance_log: "3130",
        quicklog_entries: "3140",
        bank_account: "3150",
        deposit: "3160",
        person: "3170",
        insurance_policy: "3180",
        attachment: "3200",
        contact: "3210",
        identity_document: "3220",
        card: "3230",
        locker: "3250",
        mf_holding: "3260",
        mf_valuation: "3270",
        family_summary_log: "3280"
    };

    BACKUP_TABLES.forEach(t => {

        let rows = backupData[t.name];

        // attendance_log is deliberately scoped to Jan 2020 to Dec 2022 only
        // here — enough real data to not start from nothing, without
        // seeding four-plus years of history every time this runs.
        // CSV/JSON export and Push to pwms_prev are unaffected — both
        // still use the full live dataset, unrestricted.
        if (t.name === "attendance_log") {
            rows = rows.filter(r => r.log_date >= "2020-01-01" && r.log_date <= "2022-12-31");
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
