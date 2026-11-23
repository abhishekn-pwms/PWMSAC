// AC v2.0 BANKNDEPOSITS & RESTORE

// dbbckupexpo-restore.js
// The two safety checks that complete the backup: VERIFY (is the copy in
// pwms_prev really the same as live?) and RESTORE (put the copy back).
// Loaded by the Data Safety page only, after dbbckupexpo.js, whose table lists,
// logging and live-data reader it uses.
//
// VERIFY is read-only. It reads every table and every attached file on both
// sides, compares them, and changes nothing anywhere.
//
// RESTORE replaces ALL live data and files with the copy in pwms_prev. It never
// writes to pwms_prev. Because it can destroy live data, it is ordered so that
// the risky-to-fail work happens before the destructive work:
//
//   1. sign in to pwms_prev and read the whole backup (tables and files);
//      read live fresh. Any read that fails stops everything here.
//   2. refuse (no override) if the backup is empty, or if it has attachment
//      rows whose files are missing from its bucket (a half-finished push);
//   3. show what would change and ask; the box on the page must also say RESTORE;
//   4. download a complete copy of what live holds NOW (tables and files). If it
//      cannot be produced, stop: nothing has been changed;
//   5. copy the backup's files into live Storage. This only adds or overwrites
//      files, so if it fails the live database is still untouched;
//   6. clear the live tables and insert the backup's rows. This is the only
//      destructive step, and it touches the database only. If it fails the page
//      says live is incomplete; running the restore again is safe;
//   7. remove live files that no restored row points at (a failure here is only
//      a warning: stray files are harmless);
//   8. read live again and compare it with the backup, and say so plainly.
//
// Nothing here is a single database transaction (these are REST calls), so a
// failure partway is reported explicitly rather than hidden.

// ======================================
// COMPARING
// ======================================

const BK_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/;


function bkSortKeys(value) {

    if (Array.isArray(value)) {
        return value.map(bkSortKeys);
    }

    if (value && typeof value === "object") {

        const out = {};

        Object.keys(value).sort().forEach(k => { out[k] = bkSortKeys(value[k]); });

        return out;
    }

    return value;
}


// One value in a form two reads of the same data will agree on: timestamps by
// the instant they name (to the microsecond, however the offset is written),
// objects by sorted keys, everything else as it is.
function bkNormalise(value) {

    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {

        const m = value.match(BK_TIMESTAMP);

        if (m) {

            let tz = m[4];

            if (tz !== "Z") {
                const digits = tz.slice(1).replace(":", "");
                tz = `${tz[0]}${digits.slice(0, 2)}:${digits.slice(2, 4) || "00"}`;
            }

            const ms = Date.parse(`${m[1]}T${m[2]}${tz}`);

            if (!Number.isNaN(ms)) {
                return `ts:${ms / 1000}.${(m[3] || "").padEnd(6, "0").slice(0, 6)}`;
            }
        }

        return value;
    }

    return JSON.stringify(bkSortKeys(value));
}


// Live rows against backup rows for one table, matched by primary key.
function bkCompareRows(liveRows, prevRows, primaryKey) {

    const prevById = new Map(prevRows.map(r => [String(r[primaryKey]), r]));
    const liveIds = new Set();

    const missingInPrev = [];
    const different = [];

    liveRows.forEach(row => {

        const id = String(row[primaryKey]);

        liveIds.add(id);

        const other = prevById.get(id);

        if (!other) {
            missingInPrev.push(id);
            return;
        }

        const columns = [...new Set([...Object.keys(row), ...Object.keys(other)])]
            .filter(c => bkNormalise(row[c]) !== bkNormalise(other[c]));

        if (columns.length > 0) {
            different.push({ id, columns });
        }
    });

    const extraInPrev = prevRows
        .filter(r => !liveIds.has(String(r[primaryKey])))
        .map(r => String(r[primaryKey]));

    return {
        live: liveRows.length,
        prev: prevRows.length,
        missingInPrev,
        extraInPrev,
        different,
        same: missingInPrev.length === 0 && extraInPrev.length === 0 && different.length === 0
    };
}


// The files behind one attachment table: does each live row's file exist on both
// sides, and is it the same size? Files nothing points at are reported, but are
// not a failure.
function bkCompareFiles(liveRows, prevRows, liveFiles, prevFiles) {

    const liveMap = new Map(liveFiles.map(f => [f.path, f]));
    const prevMap = new Map(prevFiles.map(f => [f.path, f]));

    const missingInLive = [];
    const missingInPrev = [];
    const sizeDiffers = [];

    liveRows.forEach(row => {

        const path = row.storage_path;
        const l = liveMap.get(path);
        const b = prevMap.get(path);

        if (!l) missingInLive.push(path);
        if (!b) missingInPrev.push(path);

        if (l && b && l.size !== null && b.size !== null && l.size !== b.size) {
            sizeDiffers.push(path);
        }
    });

    const liveRefs = new Set(liveRows.map(r => r.storage_path));
    const prevRefs = new Set(prevRows.map(r => r.storage_path));

    return {
        live: liveFiles.length,
        prev: prevFiles.length,
        missingInLive,
        missingInPrev,
        sizeDiffers,
        orphansInLive: liveFiles.filter(f => !liveRefs.has(f.path)).map(f => f.path),
        orphansInPrev: prevFiles.filter(f => !prevRefs.has(f.path)).map(f => f.path),
        ok: missingInLive.length === 0 && missingInPrev.length === 0 && sizeDiffers.length === 0
    };
}


// Everything at once: every table, and the files behind every attachment table.
function bkCompareAll(liveTables, prevTables, liveFiles, prevFiles) {

    const tables = BACKUP_TABLES.map(t => ({
        name: t.name,
        ...bkCompareRows(liveTables[t.name] || [], prevTables[t.name] || [], t.pk)
    }));

    const files = Object.keys(ATTACHMENT_BUCKETS).map(table => {

        const bucket = ATTACHMENT_BUCKETS[table];

        return {
            table,
            bucket,
            ...bkCompareFiles(liveTables[table] || [], prevTables[table] || [], liveFiles[bucket] || [], prevFiles[bucket] || [])
        };
    });

    return {
        tables,
        files,
        identical: tables.every(t => t.same) && files.every(f => f.ok)
    };
}


// ======================================
// READING BOTH SIDES (strictly: a read that fails is an error, never "empty")
// ======================================

// The whole backup: every table and the file list of every bucket.
// Throws, naming what could not be read.
async function bkReadPrev() {

    const tables = {};
    const files = {};

    for (const t of BACKUP_TABLES) {

        const rows = await fetchAllPrev(t.name, t.pk);

        if (rows === null) {
            throw new Error(`Could not read ${t.name} from pwms_prev.`);
        }

        tables[t.name] = rows;

        logBackup(`  pwms_prev ${t.name}: ${rows.length} row(s)`);
    }

    for (const bucket of Object.values(ATTACHMENT_BUCKETS)) {

        const info = await listAllFilesInfoPrev(bucket, "");

        if (info === null) {
            throw new Error(`Could not list the ${bucket} bucket on pwms_prev.`);
        }

        files[bucket] = info;

        logBackup(`  pwms_prev ${bucket}: ${info.length} file(s)`);
    }

    return { tables, files };
}


// Every file in a LIVE bucket, at any depth, as { path, size }.
// Returns null if any listing failed.
async function bkListLiveFiles(bucket, prefix) {

    const store = supabaseClient.storage.from(bucket);

    const PAGE = 1000;
    let entries = [];
    let offset = 0;

    while (true) {

        const { data, error } = await store.list(prefix || "", { limit: PAGE, offset });

        if (error || !Array.isArray(data)) {
            return null;
        }

        entries = entries.concat(data);

        if (data.length < PAGE) {
            break;
        }

        offset += PAGE;
    }

    let files = [];

    for (const entry of entries) {

        const path = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.id === null || entry.id === undefined) {

            const inner = await bkListLiveFiles(bucket, path);

            if (inner === null) {
                return null;
            }

            files = files.concat(inner);

        } else {

            files.push({
                path,
                size: entry.metadata && entry.metadata.size !== undefined ? Number(entry.metadata.size) : null
            });
        }
    }

    return files;
}


async function bkReadLiveFiles() {

    const files = {};

    for (const bucket of Object.values(ATTACHMENT_BUCKETS)) {

        const list = await bkListLiveFiles(bucket, "");

        if (list === null) {
            throw new Error(`Could not list the ${bucket} bucket on live.`);
        }

        files[bucket] = list;
    }

    return files;
}


// ======================================
// WRITING TO LIVE (restore only)
// ======================================

async function bkDeleteAllLive(table, primaryKey) {

    const response =
        await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${primaryKey}=not.is.null`,
            {
                method: "DELETE",
                headers: await authHeaders({ Prefer: "return=minimal" })
            }
        );

    return response.ok;
}


// Returns { ok, message }. Rows go in chunks, so one huge request can't fail on size.
async function bkInsertLive(table, rows) {

    const CHUNK = 500;

    for (let i = 0; i < rows.length; i += CHUNK) {

        const result = await insertData(table, rows.slice(i, i + CHUNK));

        if (!Array.isArray(result)) {

            const detail = result && (result.message || result.hint);

            return { ok: false, message: detail || "rejected" };
        }
    }

    return { ok: true, message: "" };
}


async function bkUploadLive(bucket, path, blob) {

    const { error } = await supabaseClient.storage.from(bucket).upload(path, blob, {
        upsert: true,
        contentType: blob.type || "application/octet-stream"
    });

    return error ? { ok: false, message: error.message || "refused" } : { ok: true, message: "" };
}


async function bkRemoveLiveFiles(bucket, paths) {

    const CHUNK = 100;

    for (let i = 0; i < paths.length; i += CHUNK) {

        const { error } = await supabaseClient.storage.from(bucket).remove(paths.slice(i, i + CHUNK));

        if (error) {
            return false;
        }
    }

    return true;
}


// ======================================
// SHOWING RESULTS
// ======================================

function bkEsc(value) {

    return String(value === null || value === undefined ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


// An error message as one finished sentence: some of ours end in a full stop and
// some come from the browser or the server and don't.
function bkSentence(message) {

    const text = String(message === null || message === undefined ? "" : message).trim();

    return /[.!?]$/.test(text) ? text : `${text}.`;
}


function bkPlural(n, word) {

    return `${n} ${word}${n === 1 ? "" : "s"}`;
}


function bkTableVerdict(t) {

    if (t.same) {
        return "same";
    }

    return [
        t.missingInPrev.length ? `${t.missingInPrev.length} not in the backup` : "",
        t.extraInPrev.length ? `${t.extraInPrev.length} only in the backup` : "",
        t.different.length ? `${t.different.length} changed` : ""
    ].filter(Boolean).join(", ");
}


function bkFileVerdict(f) {

    const problems = [
        f.missingInLive.length ? `${bkPlural(f.missingInLive.length, "row")} point at a file missing from live` : "",
        f.missingInPrev.length ? `${bkPlural(f.missingInPrev.length, "file")} not in the backup` : "",
        f.sizeDiffers.length ? `${bkPlural(f.sizeDiffers.length, "file")} a different size` : ""
    ].filter(Boolean);

    const notes = [
        f.orphansInLive.length ? `${bkPlural(f.orphansInLive.length, "unused file")} on live` : "",
        f.orphansInPrev.length ? `${bkPlural(f.orphansInPrev.length, "unused file")} in the backup` : ""
    ].filter(Boolean);

    const head = problems.length ? problems.join(", ") : `${bkPlural(f.live, "file")}, all in the backup at the same size`;

    return notes.length ? `${head} (${notes.join(", ")})` : head;
}


function bkRenderComparison(result) {

    const el = document.getElementById("bkVerifyResults");

    if (!el) {
        return;
    }

    const tableRows = result.tables.map(t => `
        <tr class="${t.same ? "" : "bk-verify-diff"}">
            <td>${bkEsc(t.name)}</td>
            <td class="bk-verify-num">${t.live}</td>
            <td class="bk-verify-num">${t.prev}</td>
            <td>${bkEsc(bkTableVerdict(t))}</td>
        </tr>
    `).join("");

    const fileRows = result.files.map(f => `
        <tr class="${f.ok ? "" : "bk-verify-diff"}">
            <td>${bkEsc(f.bucket)}</td>
            <td class="bk-verify-num">${f.live}</td>
            <td class="bk-verify-num">${f.prev}</td>
            <td>${bkEsc(bkFileVerdict(f))}</td>
        </tr>
    `).join("");

    el.innerHTML = `
        <div class="bk-verify-wrap">
            <table class="bk-verify-table">
                <thead><tr><th>Table</th><th class="bk-verify-num">Live</th><th class="bk-verify-num">Backup</th><th>Result</th></tr></thead>
                <tbody>${tableRows}</tbody>
                <thead><tr><th>Files</th><th class="bk-verify-num">Live</th><th class="bk-verify-num">Backup</th><th>Result</th></tr></thead>
                <tbody>${fileRows}</tbody>
            </table>
        </div>
    `;
}


function bkLogComparison(result) {

    result.tables.filter(t => !t.same).forEach(t => {
        logBackup(`  ${t.name}: ${bkTableVerdict(t)} (live ${t.live}, backup ${t.prev})`);
    });

    result.files.filter(f => !f.ok).forEach(f => {
        logBackup(`  ${f.bucket}: ${bkFileVerdict(f)}`);
    });
}


// ======================================
// VERIFY BACKUP (read-only)
// ======================================

async function verifyBackup() {

    const statusEl = document.getElementById("bkVerifyStatus");
    const passwordEl = document.getElementById("bkVerifyPassword");
    const password = passwordEl ? passwordEl.value : "";

    if (!password) {

        statusEl.textContent = "Enter the backup login password above, then verify again.";

        showError("Enter the backup login password first");

        return;
    }

    logBackup("=== Verify backup started (read-only: nothing will be changed) ===");

    statusEl.textContent = "Signing in to pwms_prev...";

    const signedIn = await signInPrev(password);

    passwordEl.value = "";

    if (!signedIn.ok) {

        statusEl.textContent = `\u274C Could not sign in to pwms_prev (${signedIn.message}).`;
        logBackup(`=== Verify NOT done: pwms_prev sign-in failed (${signedIn.message}) ===`);

        showError("Could not sign in to pwms_prev \u2014 check the backup password");

        return;
    }

    try {

        statusEl.textContent = "Reading live data...";

        if (!(await refreshLiveFor("Verify"))) {

            statusEl.textContent = `\u274C Could not read from live: ${backupLoadErrors.join(", ")}.`;
            logBackup(`=== Verify NOT done: could not read ${backupLoadErrors.join(", ")} from live ===`);

            return;
        }

        statusEl.textContent = "Reading the backup...";
        logBackup("  Reading everything in pwms_prev...");

        const prev = await bkReadPrev();

        statusEl.textContent = "Reading live files...";

        const liveFiles = await bkReadLiveFiles();

        const result = bkCompareAll(backupData, prev.tables, liveFiles, prev.files);

        bkRenderComparison(result);

        if (result.identical) {

            statusEl.textContent = `\u2705 The backup matches live \u2014 checked ${new Date().toLocaleString()}.`;
            logBackup("=== Verify complete: the backup matches live ===");

            showSuccess("The backup matches live");

        } else {

            const tableCount = result.tables.filter(t => !t.same).length;
            const fileCount = result.files.filter(f => !f.ok).length;

            statusEl.textContent = `\u26A0\uFE0F The backup differs from live (${bkPlural(tableCount, "table")}, ${bkPlural(fileCount, "file group")}). That is normal if you have changed anything since the last push: push again, then verify again.`;
            logBackup("=== Verify complete: differences found ===");

            bkLogComparison(result);

            showError("The backup differs from live \u2014 see the results below");
        }

    } catch (error) {

        console.error(error);

        statusEl.textContent = `\u274C Verify could not finish \u2014 ${bkSentence(error.message || error)} Nothing was changed.`;
        logBackup(`=== Verify FAILED: ${error.message || error} ===`);

        showError("Verify could not finish \u2014 see the status message");

    } finally {

        await signOutPrev();

        logBackup("  Signed out of pwms_prev.");
    }
}


// ======================================
// RESTORE: THE GUARDS
// ======================================

// Reasons the backup must not be restored, whatever you type. Empty list = go on.
function bkRestoreBlockers(prev) {

    const blockers = [];

    const total = BACKUP_TABLES.reduce((sum, t) => sum + (prev.tables[t.name] || []).length, 0);

    if (total === 0) {
        blockers.push("The backup is empty.");
    }

    // An attachment row whose file is not in the backup's bucket means the push
    // that made this backup did not finish: restoring it would create rows that
    // point at files that do not exist.
    Object.keys(ATTACHMENT_BUCKETS).forEach(table => {

        const bucket = ATTACHMENT_BUCKETS[table];
        const have = new Set((prev.files[bucket] || []).map(f => f.path));

        const missing = (prev.tables[table] || []).filter(r => !have.has(r.storage_path));

        if (missing.length > 0) {
            blockers.push(`The backup is incomplete: ${bkPlural(missing.length, "file")} for ${table} ${missing.length === 1 ? "is" : "are"} missing from ${bucket}. A push probably stopped halfway. Push again from live, then verify.`);
        }
    });

    return blockers;
}


// What the confirmation box shows: how live would change.
function bkRestoreSummary(liveTables, prev, liveFiles) {

    const sum = tables => BACKUP_TABLES.reduce((s, t) => s + (tables[t.name] || []).length, 0);

    const changing = BACKUP_TABLES
        .map(t => ({ name: t.name, now: (liveTables[t.name] || []).length, then: (prev.tables[t.name] || []).length }))
        .filter(t => t.now !== t.then);

    const emptied = changing.filter(t => t.then === 0 && t.now > 0).map(t => t.name);

    const fileCount = files => Object.values(files).reduce((s, list) => s + list.length, 0);

    const lines = [
        `Live now: ${sum(liveTables).toLocaleString("en-IN")} rows and ${bkPlural(fileCount(liveFiles), "file")}.`,
        `The backup: ${sum(prev.tables).toLocaleString("en-IN")} rows and ${bkPlural(fileCount(prev.files), "file")}.`
    ];

    if (changing.length > 0) {

        lines.push("", "Tables that would change:");

        changing.slice(0, 12).forEach(t => lines.push(`  ${t.name}: ${t.now} \u2192 ${t.then}`));

        if (changing.length > 12) {
            lines.push(`  ...and ${changing.length - 12} more`);
        }
    } else {

        lines.push("", "Every table has the same number of rows in both.");
    }

    if (emptied.length > 0) {
        lines.push("", `These tables would become EMPTY: ${emptied.join(", ")}.`);
    }

    // Files on live that no record in the backup points to are removed, so that
    // live ends up the same as the backup. Say so, and say they are saved first.
    const strays = Object.keys(ATTACHMENT_BUCKETS).reduce((sum, table) => {

        const bucket = ATTACHMENT_BUCKETS[table];
        const wanted = new Set((prev.tables[table] || []).map(r => r.storage_path));

        return sum + (liveFiles[bucket] || []).filter(f => !wanted.has(f.path)).length;
    }, 0);

    if (strays > 0) {
        lines.push("", `${bkPlural(strays, "file")} on live that no record in the backup points to will be removed (they are saved in the copy of live that is downloaded first).`);
    }

    lines.push(
        "",
        "ALL live data and files will be replaced by the backup. Anything you changed after the last push is lost.",
        "A full copy of live is downloaded first. Continue?"
    );

    return lines.join("\n");
}


// ======================================
// RESTORE: THE SAFETY COPY OF LIVE
// ======================================

// Everything live holds right now, as one zip: every table (CSV and one JSON
// file) and EVERY file in the three buckets -- including files no record points
// at, because the restore removes those, so they must be in the copy. Uses the
// data refreshLiveFor() just read. A file that can't be fetched is listed in the
// zip rather than stopping the restore: a restore is for when things are
// damaged, and a live file that is already missing must not make recovery
// impossible. Throws if the zip can't be produced, or a bucket can't be listed.
async function bkSafetyExport() {

    const zip = new JSZip();

    const counts = [];

    BACKUP_TABLES.forEach(t => {

        const rows = backupData[t.name] || [];

        zip.file(`${t.name}.csv`, convertToCsv(rows));

        counts.push(`${t.name}: ${rows.length}`);
    });

    zip.file("data.json", JSON.stringify(backupData, null, 2));
    zip.file("_row_counts.txt", counts.join("\n") + "\n");

    const liveFiles = await bkReadLiveFiles();

    const missing = [];
    const unreferenced = [];
    let fetched = 0;

    for (const table of Object.keys(ATTACHMENT_BUCKETS)) {

        const bucket = ATTACHMENT_BUCKETS[table];

        const referenced = new Set((backupData[table] || []).map(r => r.storage_path));

        // every file that is there, plus any a record points at that is not
        const paths = [...new Set([...(liveFiles[bucket] || []).map(f => f.path), ...referenced])];

        for (const path of paths) {

            const { data: blob, error } = await supabaseClient.storage.from(bucket).download(path);

            if (error || !blob) {
                missing.push(`${bucket}/${path}`);
                continue;
            }

            zip.file(`attachments/${table}/${path}`, blob);
            fetched++;

            if (!referenced.has(path)) {
                unreferenced.push(`${bucket}/${path}`);
            }
        }
    }

    if (missing.length > 0) {
        zip.file("_missing_files.txt", "These files could not be fetched from live Storage:\n" + missing.join("\n") + "\n");
    }

    if (unreferenced.length > 0) {
        zip.file("_unreferenced_files.txt", "These files were on live, but no record pointed at them. They are included in attachments/ like the rest:\n" + unreferenced.join("\n") + "\n");
    }

    const blob = await zip.generateAsync({ type: "blob" });

    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
    const fileName = `PWMS_PreRestore_Live_${getToday()}_${stamp}.zip`;

    downloadBlob(fileName, blob);

    return { fileName, files: fetched, missing, unreferenced };
}


// ======================================
// RESTORE FROM PWMS_PREV
// ======================================

async function restoreFromPrev() {

    const statusEl = document.getElementById("bkRestoreStatus");
    const passwordEl = document.getElementById("bkRestorePassword");
    const wordEl = document.getElementById("bkRestoreConfirm");

    const password = passwordEl ? passwordEl.value : "";
    const word = wordEl ? wordEl.value.trim() : "";

    // Checked first, before anything is read or signed in.
    if (!password) {

        statusEl.textContent = "Enter the backup login password above, then restore again.";

        showError("Enter the backup login password first");

        return;
    }

    if (word !== "RESTORE") {

        statusEl.textContent = "Type RESTORE (in capital letters) in the box to confirm, then restore again.";

        showError("Type RESTORE in the box to confirm");

        return;
    }

    logBackup("=== Restore from pwms_prev started ===");

    statusEl.textContent = "Signing in to pwms_prev...";

    const signedIn = await signInPrev(password);

    passwordEl.value = "";

    if (!signedIn.ok) {

        statusEl.textContent = `\u274C Restore not started \u2014 could not sign in to pwms_prev (${signedIn.message}). Nothing was changed.`;
        logBackup(`=== Restore NOT started: pwms_prev sign-in failed (${signedIn.message}) \u2014 nothing was changed ===`);

        showError("Could not sign in to pwms_prev \u2014 check the backup password");

        return;
    }

    // What has been touched so far, so a failure can say exactly where things stand.
    let phase = "reading";

    try {

        // ---- 1. read both sides, strictly ----
        statusEl.textContent = "Reading the backup...";
        logBackup("  Reading everything in pwms_prev...");

        const prev = await bkReadPrev();

        statusEl.textContent = "Reading live data...";

        if (!(await refreshLiveFor("Restore"))) {

            statusEl.textContent = `\u274C Restore not started \u2014 could not read from live: ${backupLoadErrors.join(", ")}. Nothing was changed.`;
            logBackup(`=== Restore NOT started: could not read ${backupLoadErrors.join(", ")} from live \u2014 nothing was changed ===`);

            return;
        }

        const liveFilesBefore = await bkReadLiveFiles();

        // ---- 2. the guards: no override ----
        const blockers = bkRestoreBlockers(prev);

        if (blockers.length > 0) {

            statusEl.textContent = `\u274C Restore refused \u2014 ${blockers.join(" ")} Nothing was changed.`;
            logBackup(`=== Restore REFUSED: ${blockers.join(" ")} Nothing was changed. ===`);

            showError("Restore refused \u2014 see the status message");

            return;
        }

        // ---- 3. show what would change, and ask ----
        if (!confirmAction(bkRestoreSummary(backupData, prev, liveFilesBefore))) {

            statusEl.textContent = "Restore cancelled. Nothing was changed.";
            logBackup("=== Restore cancelled \u2014 nothing was changed ===");

            return;
        }

        // ---- 4. a complete copy of what live holds now ----
        statusEl.textContent = "Saving a copy of live first...";
        logBackup("  Saving a complete copy of live before changing anything...");

        // read live again: the copy must be what is there at this moment, not
        // what was there before the question was answered
        if (!(await refreshLiveFor("Restore"))) {

            statusEl.textContent = `\u274C Restore stopped \u2014 could not read from live: ${backupLoadErrors.join(", ")}. Nothing was changed.`;
            logBackup("=== Restore stopped before changing anything ===");

            return;
        }

        let safety;

        try {

            safety = await bkSafetyExport();

        } catch (error) {

            console.error(error);

            statusEl.textContent = `\u274C Restore stopped \u2014 the copy of live could not be saved (${error.message || error}). Nothing was changed.`;
            logBackup(`=== Restore stopped: the copy of live could not be saved (${error.message || error}) \u2014 nothing was changed ===`);

            showError("Restore stopped \u2014 the copy of live could not be saved");

            return;
        }

        logBackup(`  Saved ${safety.fileName} (${bkPlural(safety.files, "attached file")}).`);

        if (safety.unreferenced.length > 0) {
            logBackup(`  ${bkPlural(safety.unreferenced.length, "file")} that no record points at ${safety.unreferenced.length === 1 ? "was" : "were"} saved in that copy too.`);
        }

        if (safety.missing.length > 0) {
            logBackup(`  \u26A0\uFE0F ${bkPlural(safety.missing.length, "live file")} could not be fetched for that copy and are listed inside it.`);
        }

        // ---- 5. the backup's files into live: adds and overwrites only ----
        phase = "files";

        for (const table of Object.keys(ATTACHMENT_BUCKETS)) {

            const bucket = ATTACHMENT_BUCKETS[table];
            const rows = prev.tables[table] || [];

            statusEl.textContent = `Copying files into ${bucket} (${rows.length})...`;
            logBackup(`  Copying ${rows.length} file(s) from pwms_prev into ${bucket} (live)...`);

            for (const row of rows) {

                const blob = await downloadFilePrev(bucket, row.storage_path);

                if (!blob) {
                    throw new Error(`Could not download ${row.storage_path} from pwms_prev.`);
                }

                const uploaded = await bkUploadLive(bucket, row.storage_path, blob);

                if (!uploaded.ok) {
                    throw new Error(`Could not upload ${row.storage_path} into ${bucket} on live \u2014 ${uploaded.message}.`);
                }
            }

            logBackup(`  Copied ${rows.length} file(s) into ${bucket}.`);
        }

        // ---- 6. the database: clear, then insert. The only destructive step. ----
        phase = "database";

        for (const tableName of DELETE_ORDER) {

            const table = BACKUP_TABLES.find(t => t.name === tableName);

            statusEl.textContent = `Clearing ${tableName} on live...`;
            logBackup(`  Clearing ${tableName} on live...`);

            if (!(await bkDeleteAllLive(table.name, table.pk))) {
                throw new Error(`Could not clear ${tableName} on live.`);
            }
        }

        for (const tableName of INSERT_ORDER) {

            const rows = prev.tables[tableName] || [];

            if (rows.length === 0) {
                logBackup(`  Skipping ${tableName} \u2014 no rows to restore.`);
                continue;
            }

            statusEl.textContent = `Restoring ${tableName} (${rows.length} rows)...`;
            logBackup(`  Restoring ${rows.length} row(s) into ${tableName}...`);

            const inserted = await bkInsertLive(tableName, rows);

            if (!inserted.ok) {
                throw new Error(`Restoring ${tableName} on live failed \u2014 ${inserted.message}.`);
            }
        }

        // ---- 7. files nothing points at any more ----
        phase = "tidy";

        for (const table of Object.keys(ATTACHMENT_BUCKETS)) {

            const bucket = ATTACHMENT_BUCKETS[table];
            const wanted = new Set((prev.tables[table] || []).map(r => r.storage_path));

            const files = await bkListLiveFiles(bucket, "");

            if (files === null) {
                logBackup(`  \u26A0\uFE0F Could not list ${bucket} on live to tidy it. Stray files, if any, are harmless.`);
                continue;
            }

            const strays = files.filter(f => !wanted.has(f.path)).map(f => f.path);

            if (strays.length === 0) {
                continue;
            }

            logBackup(`  Removing ${bkPlural(strays.length, "stray file")} from ${bucket} on live...`);

            if (!(await bkRemoveLiveFiles(bucket, strays))) {
                logBackup(`  \u26A0\uFE0F Could not remove some stray files from ${bucket}. They are harmless.`);
            }
        }

        // ---- 8. check the result ----
        phase = "verify";

        statusEl.textContent = "Checking the result...";
        logBackup("  Reading live again to check the result...");

        await loadAllBackupData();

        const result = bkCompareAll(backupData, prev.tables, await bkReadLiveFiles(), prev.files);

        bkRenderComparison(result);

        if (result.identical && backupLoadErrors.length === 0) {

            statusEl.textContent = `\u2705 Restore complete \u2014 live now matches the backup (${new Date().toLocaleString()}). Your copy of the old live data was downloaded as ${safety.fileName}.`;
            logBackup("=== Restore complete: live now matches the backup ===");

            showSuccess("Restore complete");

        } else {

            statusEl.textContent = `\u26A0\uFE0F Restore finished, but the check found differences between live and the backup (see the results above). Your copy of the old live data is ${safety.fileName}.`;
            logBackup("=== Restore finished, but the check found differences ===");

            bkLogComparison(result);

            showError("Restore finished, but the check found differences");
        }

    } catch (error) {

        console.error(error);

        const message = bkSentence(error.message || String(error));

        if (phase === "reading") {

            statusEl.textContent = `\u274C Restore stopped \u2014 ${message} Nothing was changed.`;

        } else if (phase === "files") {

            statusEl.textContent = `\u274C Restore stopped while copying files \u2014 ${message} Your live database was not touched.`;

        } else if (phase === "database") {

            statusEl.textContent = `\u274C Restore FAILED after live data was cleared \u2014 live is incomplete right now. ${message} The backup in pwms_prev is untouched and your copy of the old live data was downloaded. Run the restore again from the start: it is safe to repeat.`;

        } else {

            statusEl.textContent = `\u274C Restore stopped at the end \u2014 ${message} The data itself was restored; run Verify backup to check it.`;
        }

        logBackup(`=== Restore FAILED (${phase}): ${message} ===`);

        showError("Restore failed \u2014 see the status message for details");

    } finally {

        await signOutPrev();

        if (wordEl) {
            wordEl.value = "";
        }

        logBackup("  Signed out of pwms_prev.");
    }
}
