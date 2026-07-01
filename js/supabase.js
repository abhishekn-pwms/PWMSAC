// Supabase connection

const SUPABASE_URL =
'https://cibatqwvkmhgmedkamdu.supabase.co';

const SUPABASE_ANON_KEY =
'sb_publishable_OxFKEasUc1uPvavmVTQ34g_tFfWdmjt';


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


const HEADERS = {

    apikey: SUPABASE_ANON_KEY,

    Authorization:
        `Bearer ${SUPABASE_ANON_KEY}`,

    "Content-Type":
        "application/json"
};

// ======================================
// READ
// ======================================

async function getData(tableOrView) {

    const response =
        await fetch(
            `${SUPABASE_URL}/rest/v1/${tableOrView}`,
            {
                headers: HEADERS
            }
        );

    return await response.json();
}

// ======================================
// INSERT
// ======================================

async function insertData(
    table,
    payload
) {

    const response =
        await fetch(
            `${SUPABASE_URL}/rest/v1/${table}`,
            {
                method: "POST",

                headers: {
                    ...HEADERS,
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
// UPDATE
// ======================================

async function updateData(
    table,
    idField,
    idValue,
    payload
) {

    const response =
        await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${idValue}`,
            {
                method: "PATCH",

                headers: {
                    ...HEADERS,
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
// DELETE
// ======================================

async function deleteData(
    table,
    idField,
    idValue
) {

    const response =
        await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${idValue}`,
            {
                method: "DELETE",

                headers: {
                    ...HEADERS,
                    Prefer:
                        "return=representation"
                }
            }
        );

    return await response.json();
}