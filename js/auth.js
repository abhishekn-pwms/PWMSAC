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
