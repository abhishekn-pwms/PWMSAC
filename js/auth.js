// AC v1.7e UPDATEPREPATTACHTODOATTACHPUSHSAFE

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


async function loginGithub() {

    await supabaseClient.auth.signInWithOAuth({

        provider: "github",

        options: {

            redirectTo:
                window.location.origin +
                appUrl(getDefaultLandingPage())

        }
    });
}


// ======================================================
// EMAIL OTP — fallback sign-in for when Google is slow/
// unavailable, or you're on a device you can't finish a
// magic-link click-through on. Requires the Supabase project's
// "Magic Link" email template to use {{ .Token }} instead of
// {{ .ConfirmationURL }} — a one-time dashboard setting, not
// something this code can configure.
//
// shouldCreateUser: false — only emails with an existing account
// (yours, from Google sign-in) can request a code. Otherwise
// anyone typing an arbitrary email into the box would trigger
// Supabase to email *them* a code and create a stray account.
// ======================================================

async function sendOtpCode() {

    const email = document.getElementById("otpEmail").value.trim();
    const messageEl = document.getElementById("otpMessage");

    if (!email) {
        messageEl.textContent = "Enter your email first";
        return;
    }

    messageEl.textContent = "Sending code...";

    const { error } = await supabaseClient.auth.signInWithOtp({

        email,

        options: {
            shouldCreateUser: false
        }
    });

    if (error) {
        messageEl.textContent = `Could not send code — ${error.message}`;
        return;
    }

    messageEl.textContent = "Code sent — check your email.";

    document.getElementById("otpCodeRow").style.display = "flex";
}


async function verifyOtpCode() {

    const email = document.getElementById("otpEmail").value.trim();
    const code = document.getElementById("otpCode").value.trim();
    const messageEl = document.getElementById("otpMessage");

    if (!code) {
        messageEl.textContent = "Enter the code from your email";
        return;
    }

    messageEl.textContent = "Verifying...";

    const { error } = await supabaseClient.auth.verifyOtp({
        email,
        token: code,
        type: "email"
    });

    if (error) {
        messageEl.textContent = `Invalid or expired code — ${error.message}`;
        return;
    }

    // Same allow-list check + redirect the Google flow relies on after
    // its own OAuth redirect lands back on the app — checkAuthentication
    // already handles rejecting a valid-but-not-allow-listed email.
    const authenticated = await checkAuthentication();

    if (authenticated) {
        window.location.href = appUrl(getDefaultLandingPage());
    }
}


async function logout() {

    await supabaseClient.auth.signOut();

    sessionStorage.clear();

    window.location.href =
        appUrl("/login.html");
}


async function checkAuthentication() {

    const {
        data: { session }
    } =
        await supabaseClient.auth.getSession();

    if (!session) {
        return false;
    }

    if (
        !APP_CONFIG.ALLOWED_EMAILS.includes(
            session.user.email
        )
    ) {

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

    return true;
}


async function requireAuthentication() {

    const authenticated =
        await checkAuthentication();

    if (!authenticated) {

        window.location.href =
            appUrl("/login.html");
    }
}
