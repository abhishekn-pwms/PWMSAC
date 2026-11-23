// AC v2.0 FAMILY

async function authenticate(
    email,
    otp
) {

    return (
        email === APP_CONFIG.DEV_EMAIL &&
        otp === APP_CONFIG.DEV_OTP
    );
}



async function login() {

    await supabaseClient.auth.signInWithOAuth({

        provider: "google",

        options: {

            redirectTo:
                window.location.origin +
                appUrl(getDefaultLandingPage())

        }
    });
}


async function logout() {

    await supabaseClient.auth.signOut();

    sessionStorage.clear();

    window.location.href =
        appUrl("/login.html");
}


// ---- Who may come in, and as what ----
//
//   OWNER  : an email in APP_CONFIG.ALLOWED_EMAILS. Every page, as before.
//   FAMILY : an email in APP_CONFIG.FAMILY_EMAILS. Read-only, and only the Family summary page.
//
// The DATABASE is what really protects the data: row-level security uses the same two lists
// (private.is_owner() and private.is_family() in the security script), so keep them in step.
// The page restriction further down is for tidiness: it sends a family login straight to
// the one page meant for them instead of a screen of "not allowed" errors.
// An email on both lists is an owner. Emails are compared in lower case.

const FAMILY_HOME_PAGE = "/pages/family-summary.html";


function emailListHas(list, email) {

    const wanted = String(email || "").trim().toLowerCase();

    return wanted !== "" &&
        Array.isArray(list) &&
        list.some(e => String(e).trim().toLowerCase() === wanted);
}


function roleForEmail(email) {

    if (emailListHas(APP_CONFIG.ALLOWED_EMAILS, email)) {
        return "owner";
    }

    if (emailListHas(APP_CONFIG.FAMILY_EMAILS, email)) {
        return "family";
    }

    return null;
}


function onFamilyHomePage() {

    return window.location.pathname.toLowerCase().endsWith("/family-summary.html");
}


// one place that leaves the page, so a test can watch it
function navigateAway(url) {

    window.location.replace(url);
}


async function checkAuthentication() {

    const {
        data: { session }
    } =
        await supabaseClient.auth.getSession();

    if (!session) {
        return false;
    }

    const role = roleForEmail(session.user.email);

    if (!role) {

        await supabaseClient.auth.signOut();

        alert(
            "You are not authorized to access PWMS."
        );

        window.location.href =
            appUrl("/login.html");

        return false;
    }

    sessionStorage.setItem(
        "pwms_authenticated",
        "true"
    );

    sessionStorage.setItem(
        "pwms_user",
        session.user.email
    );

    sessionStorage.setItem(
        "pwms_role",
        role
    );

    return true;
}


async function requireAuthentication() {

    const authenticated =
        await checkAuthentication();

    if (!authenticated) {

        window.location.href =
            appUrl("/login.html");

        return;
    }

    // A family login belongs on the Family summary page and nowhere else.
    if (
        sessionStorage.getItem("pwms_role") === "family" &&
        !onFamilyHomePage()
    ) {

        navigateAway(
            appUrl(FAMILY_HOME_PAGE)
        );

        // Stop here for good. The page that called this must not carry on loading its own
        // data (or showing errors) while the browser is on its way to the Family summary.
        await new Promise(() => {});
    }
}
