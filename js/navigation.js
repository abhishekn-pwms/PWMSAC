function navigateTo(page) {

    window.location.href =
        appUrl(`/pages/${page}.html`);
}

function setActiveMenu() {

    const currentPage =
        window.location.pathname;

    document
        .querySelectorAll(".menu-item")
        .forEach(item => {

            item.classList.remove("active");

            const page =
                item.dataset.page;

            if (
                page &&
                currentPage.includes(page)
            ) {
                item.classList.add("active");
            }

        });
}

function toggleMenuGroup(id) {

    const group =
        document.getElementById(id);

    if (!group) return;

    if (
        group.style.display === "none"
    ) {
        group.style.display = "block";
    }
    else {
        group.style.display = "none";
    }
}