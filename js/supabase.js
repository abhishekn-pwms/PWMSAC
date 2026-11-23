// AC v2.0 BANKNDEPOSITS

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


// ======================================
// REQUEST HEADERS
//
// Every database request carries the signed-in user's own session token in
// Authorization. The public key (apikey) only identifies the project -- on
// its own it opens nothing, because the database now answers only to a
// session whose email is on the allow-list (see 4001_RLS_AllTables.sql).
//
// The previous static HEADERS constant (public key as the bearer token) is
// gone on purpose: anything still using it fails loudly instead of quietly
// getting empty results.
//
// No session -> straight to the login page. Without this, a locked-out
// request would come back as an empty list rather than an error, and a
// page would look as though your data had vanished.
// ======================================

function redirectToLogin() {

    if (window.location.pathname.endsWith("/login.html")) {
        return;
    }

    window.location.href = appUrl("/login.html");
}


async function authHeaders(extra) {

    const { data } = await supabaseClient.auth.getSession();

    const session = data ? data.session : null;

    if (!session) {

        redirectToLogin();

        throw new Error("Not signed in");
    }

    return {

        apikey: SUPABASE_ANON_KEY,

        Authorization:
            `Bearer ${session.access_token}`,

        "Content-Type":
            "application/json",

        ...(extra || {})
    };
}


// A 401 means the session token was rejected (expired and could not be
// refreshed, or revoked) -- send the user to login. The error body is still
// handed back, as before, so pages that check for a non-array keep working.
async function readResponse(response) {

    if (response.status === 401) {
        redirectToLogin();
    }

    return await response.json();
}

// ======================================
// READ
// ======================================

async function getData(tableOrView) {

    const response =
        await fetch(
            `${SUPABASE_URL}/rest/v1/${tableOrView}`,
            {
                headers: await authHeaders()
            }
        );

    return await readResponse(response);
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

                headers: await authHeaders({
                    Prefer:
                        "return=representation"
                }),

                body:
                    JSON.stringify(payload)
            }
        );

    return await readResponse(response);
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

                headers: await authHeaders({
                    Prefer:
                        "return=representation"
                }),

                body:
                    JSON.stringify(payload)
            }
        );

    return await readResponse(response);
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

                headers: await authHeaders({
                    Prefer:
                        "return=representation"
                })
            }
        );

    return await readResponse(response);
}
