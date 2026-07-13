// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE

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
