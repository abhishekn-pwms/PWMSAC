// AC v1.7e UPDATEPREPATTACHPUSHSAFE

// backup-supabase.js
// Parallel REST helpers pointed at pwms_prev — completely separate from
// supabase.js, which stays untouched and only ever talks to the live
// project. Only backup.html loads this file; nothing else in the app
// references it.

const PREV_HEADERS = {

    apikey: PWMS_PREV_CONFIG.SUPABASE_ANON_KEY,

    Authorization:
        `Bearer ${PWMS_PREV_CONFIG.SUPABASE_ANON_KEY}`,

    "Content-Type":
        "application/json"
};


// ======================================
// READ
// ======================================

async function getDataPrev(tableOrView) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/rest/v1/${tableOrView}`,
            {
                headers: PREV_HEADERS
            }
        );

    return await response.json();
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
                    ...PREV_HEADERS,
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
                    ...PREV_HEADERS,
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
// API directly with the same anon-key headers.
// ======================================

async function listFilesPrev(bucket, prefix) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/list/${bucket}`,
            {
                method: "POST",
                headers: PREV_HEADERS,
                body: JSON.stringify({ prefix: prefix || "", limit: 1000, offset: 0 })
            }
        );

    if (!response.ok) {
        return [];
    }

    return await response.json();
}


// Wipes every file in a pwms_prev bucket. Storage's list endpoint is
// one folder level at a time (not recursive), and every attachment
// path here is exactly "{parent_id}/{filename}" — so this only ever
// needs to recurse one level deep, not a general-purpose walker.
async function clearBucketPrev(bucket) {

    const topLevel = await listFilesPrev(bucket, "");

    // Supabase Storage reports pseudo-folders with id === null, and
    // real files with a real id — this distinguishes the two.
    const folders = topLevel.filter(entry => entry.id === null);
    const rootFiles = topLevel.filter(entry => entry.id !== null).map(f => f.name);

    let allPaths = [...rootFiles];

    for (const folder of folders) {
        const inner = await listFilesPrev(bucket, folder.name);
        inner.forEach(f => allPaths.push(`${folder.name}/${f.name}`));
    }

    if (allPaths.length === 0) {
        return true;
    }

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}`,
            {
                method: "DELETE",
                headers: PREV_HEADERS,
                body: JSON.stringify({ prefixes: allPaths })
            }
        );

    return response.ok;
}


async function uploadFilePrev(bucket, path, blob) {

    const response =
        await fetch(
            `${PWMS_PREV_CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
            {
                method: "POST",
                headers: {
                    apikey: PWMS_PREV_CONFIG.SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${PWMS_PREV_CONFIG.SUPABASE_ANON_KEY}`,
                    "Content-Type": blob.type || "application/octet-stream"
                },
                body: blob
            }
        );

    return response.ok;
}
