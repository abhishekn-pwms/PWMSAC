// AC v1.6 TODO NOTES


// ======================================
// TODO NOTES PREVIEW (v1.6)
// Notes conventionally start with a date marker like "(05-Jul)" or
// "[05-Jul]" at position 0, with older entries appended below. This
// extracts just the newest entry — stops at the SECOND marker — then
// optionally caps length on top of that. Omit maxLength entirely for
// full-text (still stops at the next marker, just never character-cut).
// One shared function, every page just passes a different maxLength.
// ======================================

function getNotesPreview(notes, maxLength) {

    if (!notes) {
        return "";
    }

    let cutoff = notes.length;

    for (let i = 1; i < notes.length; i++) {
        if (notes[i] === "(" || notes[i] === "[") {
            cutoff = i;
            break;
        }
    }

    let preview = notes.substring(0, cutoff).trim();
    const hitSecondMarker = (cutoff < notes.length);

    if (maxLength && preview.length > maxLength) {
        preview = preview.substring(0, maxLength).trim() + "…";
    } else if (hitSecondMarker) {
        // Didn't hit the length cap (or none was given), but there's
        // older history below — signal "there's more" either way.
        preview += "…";
    }

    return preview;
}


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


// ======================================
// v1.1 NEW FAB - ADAPTIVE QUICK-ACTION & NAVIGATION HUB
// ⚙️ UNIFIED QUICK-ACTION HUB CONTROLLERS
// ======================================

// 🚀 Toggle rule for the multi-action menu hub container overlay
function toggleUniversalFab(event) {
    if (event) {
        event.stopPropagation(); // Stops the body click listener from firing instantly
    }
    const fabContainer = document.getElementById("universalFab");
    if (fabContainer) {
        fabContainer.classList.toggle("open");
    }
}



// ======================================
// v1.1g4 PASS NEW FAB
// REPLACING BELOW BLOCK WITH NEW FUNCTION ABOVE
// ======================================
// 🚀 Smart Context Router: Safely targets local handlers or passes parameter state trees
function handleFabQuickAction(targetPage, localInitFunctionName) {
    const currentPath = window.location.pathname;
    
    // Check if the file names match explicitly rather than a loose substring match
    if (currentPath.substring(currentPath.lastIndexOf('/') + 1) === targetPage) {
        if (typeof window[localInitFunctionName] === "function") {
            window[localInitFunctionName](); 
            document.getElementById("universalFab")?.classList.remove("open");
            return;
        }
    }
    
    // Otherwise, redirect forward smoothly using URL redirection parameters
    window.location.href = `${targetPage}?action=new`;
}

// REPLACING BELOW BLOCK WITH NEW FUNCTION ABOVE

/*
// 🚀 Smart Context Router: Triggers modal forms locally or redirects cross-page seamlessly
function handleFabQuickAction(targetPage, localInitFunctionName) {
    const currentPath = window.location.pathname;
    
    // Checks if the user is already sitting on the target page where the modal resides
    if (currentPath.includes(targetPage)) {
        if (typeof window[localInitFunctionName] === "function") {
            window[localInitFunctionName](); // Safely triggers modal open loop locally
            document.getElementById("universalFab")?.classList.remove("open");
            return;
        }
    }
    
    // Otherwise, redirect forward smoothly using URL redirection parameters
    window.location.href = `${targetPage}?action=new`;
}
*/



// Global listener: Automatically collapses the open overlay menu if you tap on empty whitespace
window.addEventListener("click", () => {
    const fabContainer = document.getElementById("universalFab");
    if (fabContainer && fabContainer.classList.contains("open")) {
        fabContainer.classList.remove("open");
    }
});
