// AC v2.0 BANKNDEPOSITS & RESTORE

// backup-supabase.js
// Parallel REST helpers pointed at pwms_prev — completely separate from
// supabase.js, which stays untouched and only ever talks to the live
// project. Only backup.html loads this file; nothing else in the app
// references it.

// ======================================
// SIGN-IN — pwms_prev is locked down: the only account it lets in is the
// dedicated backup login (4003_Lockdown_PwmsPrev.sql). The Data Safety page
// signs in at the start of each push with a password typed on the page,
// holds the resulting token in this variable only (never in storage), and
// signs out when the push ends.
// ======================================

let prevAccessToken = null;


async function signInPrev(password) {

    let response;

    try {

        response =
            await fetch(
                `${PWMS_PREV_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`,
                {
                    method: "POST",

                    headers: {
                        apikey: PWMS_PREV_CONFIG.SUPABASE_ANON_KEY,
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: PWMS_PREV_CONFIG.BACKUP_EMAIL,
                        password: password
                    })
                }
            );

    } catch (error) {

        prevAccessToken = null;

        return { ok: false, message: "could not reach pwms_prev" };
    }

    let body = {};

    try {
        body = await response.json();
    } catch (error) { /* non-JSON error page */ }

    if (!response.ok || !body.access_token) {

        prevAccessToken = null;

        return {
            ok: false,
            message: body.msg || body.error_description || body.message || "sign-in was refused"
        };
    }

    prevAccessToken = body.access_token;

    return { ok: true };
}


async function signOutPrev() {

    const token = prevAccessToken;

    prevAccessToken = null;

    if (!token) {
        return;
    }

    try {

        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/auth/v1/logout`,
            {
                method: "POST",

                headers: {
                    apikey: PWMS_PREV_CONFIG.SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${token}`
                }
            }
        );

    } catch (error) { /* the token is already forgotten locally */ }
}


// Headers for every pwms_prev request: the public key identifies the
// project, the backup login's token proves who is asking. Throws if the
// push has not signed in, so nothing quietly runs as the public key.
function prevHeaders(extra) {

    if (!prevAccessToken) {
        throw new Error("Not signed in to pwms_prev");
    }

    return {

        apikey: PWMS_PREV_CONFIG.SUPABASE_ANON_KEY,

        Authorization:
            `Bearer ${prevAccessToken}`,

        "Content-Type":
            "application/json",

        ...(extra || {})
    };
}


// ======================================
// READ
// ======================================

async function getDataPrev(tableOrView) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/rest/v1/${tableOrView}`,
            {
                headers: prevHeaders()
            }
        );

    return await response.json();
}


// Every row of a table, page by page. PostgREST caps a single request at 1,000
// rows, so one plain read silently truncates a bigger table (attendance_log has
// thousands). Ordered by the primary key so the pages never overlap or skip.
// Returns null if ANY page could not be read -- a failed read must never be
// mistaken for an empty table, because verify and restore act on what this says.
async function fetchAllPrev(table, primaryKeyField) {

    const PAGE = 1000;
    let all = [];
    let offset = 0;

    while (true) {

        const response =
            await fetch(
                `${PWMS_PREV_CONFIG.SUPABASE_URL}/rest/v1/${table}?order=${primaryKeyField}.asc&limit=${PAGE}&offset=${offset}`,
                { headers: prevHeaders() }
            );

        if (!response.ok) {
            return null;
        }

        const page = await response.json();

        if (!Array.isArray(page)) {
            return null;
        }

        all = all.concat(page);

        if (page.length < PAGE) {
            break;
        }

        offset += PAGE;
    }

    return all;
}


// ======================================
// INSERT — accepts a single object OR an array for bulk insert
// (PostgREST inserts every row in one request when the body is a
// JSON array, rather than needing one call per row).
// ======================================

async function insertDataPrev(table, payload) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/rest/v1/${table}`,
            {
                method: "POST",

                headers: {
                    ...prevHeaders(),
                    Prefer:
                        "return=representation"
                },

                body:
                    JSON.stringify(payload)
            }
        );

    return await response.json();
}


// ======================================
// DELETE ALL — "primaryKey=not.is.null" matches every row, since a
// primary key can never be null. Standard PostgREST idiom for
// "delete everything in this table" without needing a real filter.
// ======================================

async function deleteAllDataPrev(table, primaryKeyField) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/rest/v1/${table}?${primaryKeyField}=not.is.null`,
            {
                method: "DELETE",

                headers: {
                    ...prevHeaders(),
                    Prefer:
                        "return=minimal"
                }
            }
        );

    return response.ok;
}


// ======================================
// STORAGE — pwms_prev has no supabase-js client instance (only the
// lightweight REST helpers above), so these talk to the Storage REST
// API directly with the same signed-in headers.
// ======================================

async function listFilesPrev(bucket, prefix) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/list/${bucket}`,
            {
                method: "POST",
                headers: prevHeaders(),
                body: JSON.stringify({ prefix: prefix || "", limit: 1000, offset: 0 })
            }
        );

    if (!response.ok) {
        return [];
    }

    return await response.json();
}


// Lists ONE folder of a bucket, page by page. Storage's list endpoint is not
// recursive: sub-folders come back as entries with id === null. Returns null
// if the listing itself failed -- which must never be mistaken for "empty".
async function listFolderPrev(bucket, prefix) {

    const PAGE = 1000;
    let all = [];
    let offset = 0;

    while (true) {

        const response =
            await fetch(
                `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/list/${bucket}`,
                {
                    method: "POST",
                    headers: prevHeaders(),
                    body: JSON.stringify({ prefix: prefix || "", limit: PAGE, offset })
                }
            );

        if (!response.ok) {
            return null;
        }

        const page = await response.json();

        all = all.concat(page);

        if (page.length < PAGE) {
            break;
        }

        offset += PAGE;
    }

    return all;
}


// Every file in a bucket, at ANY depth, as { path, size }. The records-attachments
// bucket stores files at {table}/{record id}/{file}, three levels down, while the
// older buckets use {id}/{file}; a walker that only knew one depth silently
// left the deeper files behind. size is null if storage did not report one.
// Returns null if any listing failed.
async function listAllFilesInfoPrev(bucket, prefix) {

    const entries = await listFolderPrev(bucket, prefix);

    if (entries === null) {
        return null;
    }

    let files = [];

    for (const entry of entries) {

        const path = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.id === null) {

            const inner = await listAllFilesInfoPrev(bucket, path);

            if (inner === null) {
                return null;
            }

            files = files.concat(inner);

        } else {

            const size = entry.metadata && entry.metadata.size !== undefined ? Number(entry.metadata.size) : null;

            files.push({ path, size });
        }
    }

    return files;
}


// The same walk, paths only. Returns null if any listing failed.
async function listAllFilesPrev(bucket, prefix) {

    const info = await listAllFilesInfoPrev(bucket, prefix);

    return info === null ? null : info.map(f => f.path);
}


// One file's contents from a pwms_prev bucket, or null if it can't be read.
async function downloadFilePrev(bucket, path) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
            { headers: prevHeaders() }
        );

    if (!response.ok) {
        return null;
    }

    return await response.blob();
}


// Wipes every file in a pwms_prev bucket, then checks it really is empty.
// Returns true only if the bucket is verifiably empty afterwards -- the file
// copy that follows would otherwise collide with whatever was left behind.
async function clearBucketPrev(bucket) {

    const files = await listAllFilesPrev(bucket, "");

    if (files === null) {
        return false;
    }

    const CHUNK = 100;

    for (let i = 0; i < files.length; i += CHUNK) {

        const response =
            await fetch(
                `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}`,
                {
                    method: "DELETE",
                    headers: prevHeaders(),
                    body: JSON.stringify({ prefixes: files.slice(i, i + CHUNK) })
                }
            );

        if (!response.ok) {
            return false;
        }
    }

    const left = await listAllFilesPrev(bucket, "");

    return left !== null && left.length === 0;
}


// Uploads one file, overwriting any file already at that path (x-upsert) so a
// leftover can never make the push fail. Returns { ok, message }: on failure
// the message carries the storage's own reason, so the progress log says WHY.
async function uploadFilePrev(bucket, path, blob) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
            {
                method: "POST",
                headers: prevHeaders({
                    "Content-Type": blob.type || "application/octet-stream",
                    "x-upsert": "true"
                }),
                body: blob
            }
        );

    if (response.ok) {
        return { ok: true, message: "" };
    }

    let reason = "";

    try {
        const body = await response.json();
        reason = body.message || body.error || "";
    } catch (error) { /* not JSON */ }

    return { ok: false, message: reason ? `${reason} (status ${response.status})` : `status ${response.status}` };
}
