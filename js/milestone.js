let milestoneData = [];

let projectData = [];

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        loadStatusDropdown(
            "milestoneStatus"
        );

        loadStatusDropdown(
            "milestoneStatusFilter",
            true
        );


        await loadProjects();

        await loadMilestones();

        // 🚀 NEW: Instantly ready to search without clicking
        document.getElementById("searchText")?.focus();

    }
);


async function loadProjects() {

    projectData =
        await getData(
            "project?enabled=eq.true&order=project_name.asc"
        );

    if (!Array.isArray(projectData)) {

        console.error(
            "Project load failed",
            projectData
        );

        showError(
            projectData?.message ||
            "Unable to load projects"
        );

        projectData = [];

        return;
    }

    const dropdown =
        document.getElementById(
            "projectId"
        );

    dropdown.innerHTML = "";

    projectData.forEach(item => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            item.project_id;

        option.textContent =
            item.project_name;

        dropdown.appendChild(
            option
        );

    });
}

async function loadMilestones() {

    milestoneData =
        await getData(
            "vw_milestone_details?order=milestone_name.asc"
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

    renderMilestoneGrid();
}

function renderMilestoneGrid() {

    const grid =
        document.getElementById(
            "milestoneGrid"
        );

    const search =
        document
            .getElementById(
                "searchText"
            )
            .value
            .toLowerCase();

    const statusFilter =
        document.getElementById(
            "statusFilter"
        )?.value || "Enabled";

    const milestoneStatusFilter =
        document.getElementById(
            "milestoneStatusFilter"
        )?.value || "All";

    const rows =
        milestoneData.filter(item => {

            const matchesSearch =

                (item.milestone_code || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.milestone_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.description || "")
                    .toLowerCase()
                    .includes(search);

            let matchesEnabled =
                true;

            if (
                statusFilter ===
                "Enabled"
            ) {

                matchesEnabled =
                    item.enabled === true;
            }

            if (
                statusFilter ===
                "Disabled"
            ) {

                matchesEnabled =
                    item.enabled === false;
            }

            let matchesMilestoneStatus =
                true;

            if (
                milestoneStatusFilter !==
                "All"
            ) {

                matchesMilestoneStatus =
                    item.status ===
                    milestoneStatusFilter;
            }

            return (

                matchesSearch

                &&

                matchesEnabled

                &&

                matchesMilestoneStatus

            );

        });

    document.getElementById(
        "milestoneCount"
    ).textContent =
        `Showing ${rows.length} milestone(s)`;

    grid.innerHTML = "";

    if (rows.length === 0) {

        grid.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    style="text-align:center;">

                    No milestones found

                </td>

            </tr>

        `;

        return;
    }

    rows.forEach(item => {

        grid.innerHTML += `

        <tr>

            <td>
                ${item.milestone_code}
            </td>

            <td>
                <strong>${item.milestone_name}</strong>
            </td>

            <td>
                ${item.project_name || ""}
            </td>

            <td>
                ${item.portfolio_name || ""}
            </td>

            <td>
                ${statusBadgeHtml(item.status)}
            </td>

            <td>
                ${formatDate(
                    item.start_date
                )}
            </td>

            <td>
                ${formatDate(
                    item.target_date
                )}
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
                        onclick="editMilestone('${item.milestone_id}')">

                        &#9999;&#65039;

                    </button>

                    <button
                        class="btn btn-danger btn-sm"
                        title="Disable"
                        onclick="disableMilestone('${item.milestone_id}')">

                        &#128683;

                    </button>

                    `

                    : `

                    <button
                        class="btn btn-secondary btn-sm"
                        title="Enable"
                        onclick="enableMilestone('${item.milestone_id}')">

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


function newMilestone() {

    document.getElementById(
        "milestoneId"
    ).value = "";

    document.getElementById(
        "milestoneCode"
    ).value = "";

    document.getElementById(
        "milestoneName"
    ).value = "";

    document.getElementById(
        "description"
    ).value = "";

    document.getElementById(
        "startDate"
    ).value = "";

    document.getElementById(
        "targetDate"
    ).value = "";

    document.getElementById(
        "milestoneStatus"
    ).value =
        "Not Started";

    document.getElementById(
        "projectId"
    ).selectedIndex = 0;

    document.getElementById(
        "enabled"
    ).checked = true;

    document.getElementById(
        "enabled"
    ).disabled = true;

    openModal(
        "milestoneModal"
    );
}

function editMilestone(id) {

    const item =
        milestoneData.find(
            x =>
                x.milestone_id === id
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "milestoneId"
    ).value =
        item.milestone_id;

    document.getElementById(
        "projectId"
    ).value =
        item.project_id;

    document.getElementById(
        "milestoneCode"
    ).value =
        item.milestone_code;

    document.getElementById(
        "milestoneName"
    ).value =
        item.milestone_name;

    document.getElementById(
        "description"
    ).value =
        item.description || "";


    document.getElementById(
        "startDate"
    ).value =
        item.start_date
            ? item.start_date.substring(0, 10)
            : "";

    document.getElementById(
        "targetDate"
    ).value =
        item.target_date
            ? item.target_date.substring(0, 10)
            : "";



    document.getElementById(
        "milestoneStatus"
    ).value =
        item.status || "Not Started";

    document.getElementById(
        "enabled"
    ).checked =
        item.enabled;

    document.getElementById(
        "enabled"
    ).disabled = false;

    openModal(
        "milestoneModal"
    );
}

async function saveMilestone() {

    const milestoneId =
        getInputValue(
            "milestoneId"
        );

    const projectId =
        getInputValue(
            "projectId"
        );

    const milestoneCode =
        getInputValue(
            "milestoneCode"
        ).trim();

    const milestoneName =
        getInputValue(
            "milestoneName"
        ).trim();

    const duplicateCode =
        milestoneData.find(x =>

            (x.milestone_code || "")
                .trim()
                .toLowerCase() ===

            milestoneCode
                .toLowerCase()

            &&

            x.milestone_id !==
            milestoneId
        );

    if (duplicateCode) {

        showError(
            "Milestone Code already exists"
        );

        return;
    }

    const duplicateName =
        milestoneData.find(x =>

            x.project_id ===
            projectId

            &&

            (x.milestone_name || "")
                .trim()
                .toLowerCase() ===

            milestoneName
                .toLowerCase()

            &&

            x.milestone_id !==
            milestoneId
        );

    if (duplicateName) {

        showError(
            "Milestone Name already exists in this Project"
        );

        return;
    }

    if (
        !projectId ||
        !milestoneCode ||
        !milestoneName
    ) {

        showError(
            "Project, Milestone Code and Milestone Name are required"
        );

        return;
    }

    const payload = {

        project_id:
            projectId,

        milestone_code:
            milestoneCode,

        milestone_name:
            milestoneName,

        description:
            getInputValue(
                "description"
            ),

        start_date:
            getInputValue(
                "startDate"
            ) || null,

        target_date:
            getInputValue(
                "targetDate"
            ) || null,

        status:
            getInputValue(
                "milestoneStatus"
            ),

        enabled:
            document.getElementById(
                "enabled"
            ).checked,

        updated_by:
            getCurrentUser()
    };

    try {

        if (!milestoneId) {

            payload.created_by =
                getCurrentUser();

            await insertData(
                "milestone",
                payload
            );
        }
        else {

            await updateData(
                "milestone",
                "milestone_id",
                milestoneId,
                payload
            );
        }

        closeModal(
            "milestoneModal"
        );

        await loadMilestones();

        showSuccess(
            milestoneId
                ? "Milestone updated successfully"
                : "Milestone created successfully"
        );
    }
    catch (error) {

        console.error(error);

        showError(
            "Unable to save milestone"
        );
    }
}

async function disableMilestone(
    milestoneId
) {

    if (
        !confirmAction(
            "Disable Milestone?"
        )
    ) {
        return;
    }

    await updateData(
        "milestone",
        "milestone_id",
        milestoneId,
        {
            enabled: false,
            updated_by:
                getCurrentUser()
        }
    );

    await loadMilestones();
}

async function enableMilestone(
    milestoneId
) {

    if (
        !confirmAction(
            "Enable Milestone?"
        )
    ) {
        return;
    }

    await updateData(
        "milestone",
        "milestone_id",
        milestoneId,
        {
            enabled: true,
            updated_by:
                getCurrentUser()
        }
    );

    await loadMilestones();
}

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {
            closeModal(
                "milestoneModal"
            );
        }

        // 🚀 ENTER KEY SHORTCUT: Save milestone form from keyboard
        const modal = document.getElementById("milestoneModal");
        if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {
            // Ignore Enter if cursor is inside description box
            if (event.key === "Enter" && document.activeElement.id !== "description") {
                event.preventDefault();
                saveMilestone();
            }
        }
    }
);
