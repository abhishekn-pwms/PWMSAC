// ======================================
// DATE HELPERS
// ======================================

function getToday() {

    const now =
        new Date();

    const offset =
        now.getTimezoneOffset();

    const localDate =
        new Date(
            now.getTime() -
            offset * 60000
        );

    return localDate
        .toISOString()
        .split("T")[0];
}

function getCurrentDateTime() {

    return new Date()
        .toISOString();
}


function formatDateForInput(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .substring(0, 10);
}


function formatDateTime(value) {

    if (!value) {
        return "";
    }

    return new Date(value)
        .toLocaleString(
            APP_CONFIG.LOCALE,
            {
                timeZone:
                    APP_CONFIG.TIMEZONE,

                day: "2-digit",

                month: "short",

                year: "numeric",

                hour: "2-digit",

                minute: "2-digit"
            }
        );
}


function formatDate(value) {

    if (!value) {
        return "";
    }

    return new Date(value)
        .toLocaleDateString(
            "en-IN",
            {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
}


function formatDateWithDay(value) {

    if (!value) {
        return "";
    }

    return new Date(value)
        .toLocaleDateString(
            "en-IN",
            {
                timeZone: "Asia/Kolkata",
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
}




// Changed to handle 2 separate time renders.

function formatTime(value) {

    if (!value) {
        return "";
    }

    if (
        typeof value === "string" &&
        value.length >= 5
    ) {
        return value.substring(0, 5);
    }

    return new Date(value)
        .toLocaleTimeString(
            APP_CONFIG.LOCALE,
            {
                timeZone:
                    APP_CONFIG.TIMEZONE,
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}




// ======================================
// UI HELPERS
// ======================================

function showSuccess(message) {

    alert(message);
}

function showError(message) {

    alert(message);
}

function showInfo(message) {

    alert(message);
}

function confirmAction(message) {

    return confirm(message);
}

// ======================================
// FORM HELPERS
// ======================================

function clearForm(formId) {

    const form =
        document.getElementById(formId);

    if (!form) {
        return;
    }

    form.reset();
}

function setInputValue(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return;
    }

    element.value =
        value ?? "";
}

function getInputValue(
    elementId
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return "";
    }

    return element.value;
}

// ======================================
// MODAL HELPERS
// ======================================

function openModal(modalId) {

    const modal =
        document.getElementById(
            modalId
        );

    if (!modal) {
        return;
    }

    modal.style.display =
        "block";
}

function closeModal(modalId) {

    const modal =
        document.getElementById(
            modalId
        );

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";
}



// ======================================
// SESSION USER 2-1
// ======================================

function getCurrentUser() {

    return (
        sessionStorage.getItem(
            "pwms_user"
        ) || ""
    );
}


// ======================================
// STATUS MASTER
// ======================================

function loadStatusDropdown(
    dropdownId,
    includeAll = false,
    allText = "All Statuses"
) {

    const dropdown =
        document.getElementById(
            dropdownId
        );

    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = "";

    if (includeAll) {

        dropdown.innerHTML += `
            <option value="All">
                ${allText}
            </option>
        `;
    }

    MASTERS.MILESTONE_STATUS.forEach(
        status => {

            dropdown.innerHTML += `
                <option value="${status}">
                    ${status}
                </option>
            `;
        }
    );
}


// ======================================
// STATUS / PRIORITY BADGES
// Real, working color-coded badges. Replaces the old CSS-only approach
// that relied on :contains() — which isn't valid CSS and never fired.
// ======================================

function statusBadgeHtml(status) {

    if (!status) {
        return "";
    }

    const key =
        status
            .toLowerCase()
            .replace(/\s+/g, "-");

    return `<span class="badge-pill badge-status-${key}">${status}</span>`;
}

function priorityBadgeHtml(priority) {

    if (!priority) {
        return "";
    }

    const key =
        priority.toLowerCase();

    return `<span class="badge-pill badge-priority-${key}">${priority}</span>`;
}

function enabledBadgeHtml(enabled) {

    return enabled
        ? `<span class="badge-pill badge-status-completed">Yes</span>`
        : `<span class="badge-pill badge-status-cancelled">No</span>`;
}
