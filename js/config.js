const APP_BASE = (() => {

    // alert(window.location.hostname)

    const path =
        window.location.pathname;

    if (
        window.location.hostname ===
        "abhishekn-pwms.github.io"
    ) {
        return "/PWMSGG";
    }

    else if (
        window.location.hostname ===
        "192.168.1.8"
    ) {
        return "";
    }


    return "";

})();


/* ==================================
   v1.3bUI DETECT MOBILE DEVICE
================================== */

const IS_MOBILE_DEVICE =

    /Android|iPhone|iPad|iPod/i
        .test(
            navigator.userAgent
        );

if (IS_MOBILE_DEVICE) {

    document.documentElement
        .classList
        .add(
            "mobile-device"
        );
}



function initializeAppIcon() {

    let favicon =
        document.querySelector("link[rel='icon']");

    if (!favicon) {

        favicon =
            document.createElement("link");

        favicon.rel = "icon";

        document.head.appendChild(favicon);
    }

    favicon.href =
        APP_BASE + "/favicon.ico";
}


function appUrl(path) {

    // alert(APP_BASE + path)
    return APP_BASE + path;
}



function isMobile() {

    return window.matchMedia(
        "(max-width: 768px)"
    ).matches;
}


function getDefaultLandingPage() {

    return "/pages/dashboard.html";

}


const APP_CONFIG = {

    APP_NAME: "PWMS GG",

    VERSION: "2.0",

    AUTH_ENABLED: true,

    AUTH_MODE: "GOOGLE",

    ALLOWED_EMAILS: [
        "abhishek.n.space@gmail.com",
        "abhishek.nandrajog@gmail.com"
    ],

    LOCALE: "en-IN",

    TIMEZONE: "Asia/Kolkata"

};