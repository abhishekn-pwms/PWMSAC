let activityData = [];

let milestoneData = [];

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        loadActivityMasters();

        await loadMilestones();

        await loadActivities();

        // 🚀 NEW: Instantly ready to search without clicking
        document.getElementById("searchText")?.focus();

    }
);

function loadActivityMasters() {

    const statusDropdown =
        document.getElementById(
            "activityStatus"
        );

    const statusFilter =
        document.getElementById(
            "activityStatusFilter"
        );

    const priorityDropdown =
        document.getElementById(
            "activityPriority"
        );

    const priorityFilter =
        document.getElementById(
            "activityPriorityFilter"
        );


    loadStatusDropdown(
        "activityStatus"
    );

    loadStatusDropdown(
        "activityStatusFilter",
        true
    );


    priorityDropdown.innerHTML = "";

    priorityFilter.innerHTML =
        `<option value="All">
            All Priorities
        </option>`;

    MASTERS.ACTIVITY_PRIORITY.forEach(
        item => {

            priorityDropdown.innerHTML += `
                <option value="${item}">
                    ${item}
                </option>
            `;

            priorityFilter.innerHTML += `
                <option value="${item}">
                    ${item}
                </option>
            `;
        }
    );
}

async function loadMilestones() {

    milestoneData =
        await getData(
            "vw_milestone_details?enabled=eq.true&order=milestone_name.asc"
        );

    if (!Array.isArray(milestoneData)) {

        console.error(
            "Milestone load failed",
            milestoneData
        );

        showError(
            milestoneData?.message ||
            "Unable to load milestones"
        );

        milestoneData = [];

        return;
    }

    const dropdown =
        document.getElementById(
            "milestoneId"
        );

    dropdown.innerHTML = `
        <option value="">
            Standalone Activity
        </option>
    `;

    milestoneData.forEach(item => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            item.milestone_id;

        option.textContent =
            `${item.portfolio_name} | ${item.project_name} | ${item.milestone_name}`;

        dropdown.appendChild(
            option
        );

    });
}

async function loadActivities() {

    activityData =
        await getData(
            "vw_activity_details?order=display_order.asc,target_date.asc,activity_name.asc"
        );

    if (!Array.isArray(activityData)) {

        console.error(
            "Activity load failed",
            activityData
        );

        showError(
            activityData?.message ||
            "Unable to load activities"
        );

        activityData = [];

        return;
    }

    renderActivityGrid();
}

function renderActivityGrid() {

    const grid =
        document.getElementById(
            "activityGrid"
        );

    const search =
        document
            .getElementById(
                "searchText"
            )
            .value
            .toLowerCase();

    const enabledFilter =
        document.getElementById(
            "statusFilter"
        )?.value || "Enabled";

    const activityStatusFilter =
        document.getElementById(
            "activityStatusFilter"
        )?.value || "All";

    const priorityFilter =
        document.getElementById(
            "activityPriorityFilter"
        )?.value || "All";

    const rows =
        activityData.filter(item => {

            const matchesSearch =

                (item.activity_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.description || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.milestone_name || "")
                    .toLowerCase()
                    .includes(search);

            let matchesEnabled =
                true;

            if (
                enabledFilter ===
                "Enabled"
            ) {

                matchesEnabled =
                    item.enabled === true;
            }

            if (
                enabledFilter ===
                "Disabled"
            ) {

                matchesEnabled =
                    item.enabled === false;
            }

            let matchesStatus =
                true;

            if (
                activityStatusFilter !==
                "All"
            ) {

                matchesStatus =
                    item.status ===
                    activityStatusFilter;
            }

            let matchesPriority =
                true;

            if (
                priorityFilter !==
                "All"
            ) {

                matchesPriority =
                    item.priority ===
                    priorityFilter;
            }

            return (

                matchesSearch

                &&

                matchesEnabled

                &&

                matchesStatus

                &&

                matchesPriority

            );

        });

    document.getElementById(
        "activityCount"
    ).textContent =
        `Showing ${rows.length} activity(s)`;

    grid.innerHTML = "";

    if (rows.length === 0) {

        grid.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="text-align:center;">

                    No activities found

                </td>
            </tr>
        `;

        return;
    }

    rows.forEach(item => {

        const context =

            item.milestone_id

            ?

            `${item.portfolio_name} | ${item.project_name} | ${item.milestone_name}`

            :

            "Standalone Activity";

        grid.innerHTML += `

        <tr>

            <td>
                <strong>${item.activity_name}</strong>
            </td>

            <td>
                ${context}
            </td>

            <td>
                ${formatDate(
                    item.target_date
                )}
            </td>

            <td>
                ${priorityBadgeHtml(item.priority)}
            </td>

            <td>
                ${statusBadgeHtml(item.status)}
            </td>

            <td>
                ${enabledBadgeHtml(item.enabled)}
            </td>

            <td>
                <div class="row-actions">
                ${item.enabled

                    ? `

                    <button
                        class="btn btn-secondary btn-sm"
                        title="Edit"
                        onclick="editActivity('${item.activity_id}')">

                        &#9999;&#65039;

                    </button>

                    <button
                        class="btn btn-danger btn-sm"
                        title="Disable"
                        onclick="disableActivity('${item.activity_id}')">

                        &#128683;

                    </button>

                    `

                    :

                    `

                    <button
                        class="btn btn-secondary btn-sm"
                        title="Enable"
                        onclick="enableActivity('${item.activity_id}')">

                        &#9989;

                    </button>

                    `
                }
                </div>
            </td>

        </tr>

        `;
    });
}




function newActivity() {

    document.getElementById(
        "activityId"
    ).value = "";

    document.getElementById(
        "milestoneId"
    ).value = "";

    document.getElementById(
        "activityName"
    ).value = "";

    document.getElementById(
        "description"
    ).value = "";

    document.getElementById(
        "targetDate"
    ).value = "";

    document.getElementById(
        "activityPriority"
    ).value = "Medium";

    document.getElementById(
        "activityStatus"
    ).value = "Not Started";

    document.getElementById(
        "displayOrder"
    ).value = 100;

    document.getElementById(
        "enabled"
    ).checked = true;

    document.getElementById(
        "enabled"
    ).disabled = true;

    openModal(
        "activityModal"
    );
}

function editActivity(id) {

    const item =
        activityData.find(
            x =>
                x.activity_id === id
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "activityId"
    ).value =
        item.activity_id;

    document.getElementById(
        "milestoneId"
    ).value =
        item.milestone_id || "";

    document.getElementById(
        "activityName"
    ).value =
        item.activity_name;

    document.getElementById(
        "description"
    ).value =
        item.description || "";

    document.getElementById(
        "targetDate"
    ).value =
        formatDateForInput(
            item.target_date
        );

    document.getElementById(
        "activityPriority"
    ).value =
        item.priority || "Medium";

    document.getElementById(
        "activityStatus"
    ).value =
        item.status || "Not Started";

    document.getElementById(
        "displayOrder"
    ).value =
        item.display_order || 100;

    document.getElementById(
        "enabled"
    ).checked =
        item.enabled;

    document.getElementById(
        "enabled"
    ).disabled = false;

    openModal(
        "activityModal"
    );
}

async function saveActivity() {

    const activityId =
        getInputValue(
            "activityId"
        );

    const milestoneId =
        getInputValue(
            "milestoneId"
        );

    const activityName =
        getInputValue(
            "activityName"
        ).trim();

    if (!activityName) {

        showError(
            "Activity Name is required"
        );

        return;
    }

    const duplicate =
        activityData.find(x =>

            (x.milestone_id || "") ===
            (milestoneId || "")

            &&

            (x.activity_name || "")
                .trim()
                .toLowerCase() ===

            activityName
                .toLowerCase()

            &&

            x.activity_id !==
            activityId
        );

    if (duplicate) {

        showError(
            "Activity already exists"
        );

        return;
    }

    const payload = {

        milestone_id:
            milestoneId || null,

        activity_name:
            activityName,

        description:
            getInputValue(
                "description"
            ),

        target_date:
            getInputValue(
                "targetDate"
            ) || null,

        priority:
            getInputValue(
                "activityPriority"
            ),

        status:
            getInputValue(
                "activityStatus"
            ),

        display_order:
            parseInt(
                getInputValue(
                    "displayOrder"
                ) || 100
            ),

        enabled:
            document.getElementById(
                "enabled"
            ).checked,

        updated_by:
            getCurrentUser()
    };

    try {

        if (!activityId) {

            payload.created_by =
                getCurrentUser();

            await insertData(
                "activity",
                payload
            );
        }
        else {

            await updateData(
                "activity",
                "activity_id",
                activityId,
                payload
            );
        }

        closeModal(
            "activityModal"
        );

        await loadActivities();

        showSuccess(
            activityId
                ? "Activity updated successfully"
                : "Activity created successfully"
        );
    }
    catch (error) {

        console.error(
            error
        );

        showError(
            "Unable to save activity"
        );
    }
}

async function disableActivity(
    activityId
) {

    if (
        !confirmAction(
            "Disable Activity?"
        )
    ) {
        return;
    }

    await updateData(
        "activity",
        "activity_id",
        activityId,
        {
            enabled: false,
            updated_by:
                getCurrentUser()
        }
    );

    await loadActivities();
}

async function enableActivity(
    activityId
) {

    if (
        !confirmAction(
            "Enable Activity?"
        )
    ) {
        return;
    }

    await updateData(
        "activity",
        "activity_id",
        activityId,
        {
            enabled: true,
            updated_by:
                getCurrentUser()
        }
    );

    await loadActivities();
}

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {
            closeModal(
                "activityModal"
            );
        }

        // 🚀 ENTER KEY SHORTCUT: Save activity form from keyboard
        const modal = document.getElementById("activityModal");
        if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {
            // Ignore Enter if cursor is inside description textarea box
            if (event.key === "Enter" && document.activeElement.id !== "description") {
                event.preventDefault();
                saveActivity();
            }
        }
    }
);