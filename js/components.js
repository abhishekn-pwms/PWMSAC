async function loadComponent(
    elementId,
    filePath
) {

    const response =
        await fetch(filePath);

    const html =
        await response.text();

    document.getElementById(
        elementId
    ).innerHTML = html;
}



async function initializeLayout() {


    await loadComponent(
        "header",
        appUrl("/components/header.html")
    );

    await loadComponent(
        "sidebar",
        appUrl("/components/sidebar.html")
    );

    await loadComponent(
        "footer",
        appUrl("/components/footer.html")
    );


    loadCurrentUser();

    setActiveMenu();

/* ==================================
   v1.1UI CALL MENU TOGGLE
================================== */

    initializeSidebar();

}



function loadCurrentUser() {

    const element =
        document.getElementById(
            "loggedInUser"
        );

    if (!element) {
        return;
    }

    element.textContent =
        getCurrentUser();
}



/* ==================================
   v1.1UI MENU SIDEBAR INIT
================================== */

function initializeSidebar() {

    const layout =
        document.querySelector(
            ".app-layout"
        );

    const button =
        document.getElementById(
            "menuToggle"
        );

    if (!layout || !button) {
        return;
    }

    layout.classList.add(
        "sidebar-hidden"
    );

    button.addEventListener(
        "click",
        () => {

            layout.classList.toggle(
                "sidebar-hidden"
            );

        }
    );
}
