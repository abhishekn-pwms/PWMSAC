let projectData = [];

let portfolioData = [];

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();


        loadStatusDropdown(
            "projectStatus"
        );

        loadStatusDropdown(
            "projectStatusFilter",
            true
        );


        await loadPortfolioDropdown();

        await loadProjects();

        // 🚀 NEW: Instantly ready to search without clicking
        document.getElementById("searchText")?.focus();

    }
);


async function loadPortfolioDropdown() {

    portfolioData =
        await getData(
            "portfolio?enabled=eq.true&order=portfolio_name.asc"
        );

    if (!Array.isArray(portfolioData)) {

        console.error(
            "Portfolio load failed",
            portfolioData
        );

        showError(
            portfolioData?.message ||
            "Unable to load portfolios"
        );

        portfolioData = [];

        return;
    }

    const dropdown =
        document.getElementById(
            "portfolioId"
        );

    dropdown.innerHTML = "";

    portfolioData.forEach(item => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            item.portfolio_id;

        option.textContent =
            item.portfolio_name;

        dropdown.appendChild(
            option
        );

    });
}

async function loadProjects() {

    projectData =
        await getData(
            "project?order=project_name.asc"
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
    }

    renderProjectGrid();
}

function renderProjectGrid() {

    const grid =
        document.getElementById(
            "projectGrid"
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


    const projectStatusFilter =
        document.getElementById(
            "projectStatusFilter"
        )?.value || "All";


    const rows =
        projectData.filter(item => {

            const matchesSearch =

                (item.project_code || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.project_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.description || "")
                    .toLowerCase()
                    .includes(search);

            let matchesStatus =
                true;


let matchesProjectStatus =
    true;

if (
    projectStatusFilter !==
    "All"
) {

    matchesProjectStatus =
        item.status ===
        projectStatusFilter;
}



            if (
                statusFilter ===
                "Enabled"
            ) {

                matchesStatus =
                    item.enabled === true;
            }

            if (
                statusFilter ===
                "Disabled"
            ) {

                matchesStatus =
                    item.enabled === false;
            }

return (
    matchesSearch &&
    matchesStatus &&
    matchesProjectStatus
);


        });

    document.getElementById(
        "projectCount"
    ).textContent =
        `Showing ${rows.length} project(s)`;

    grid.innerHTML = "";

    if (rows.length === 0) {

        grid.innerHTML = `

            <tr>

                <td
                    colspan="9"
                    style="text-align:center;">

                    No projects found

                </td>

            </tr>

        `;

        return;
    }

    rows.forEach(item => {

        const portfolio =
            portfolioData.find(
                x =>
                    x.portfolio_id ===
                    item.portfolio_id
            );

        grid.innerHTML += `

        <tr>

            <td>
                ${item.project_code}
            </td>

            <td>
                <strong>${item.project_name}</strong>
            </td>

            <td>
                ${portfolio?.portfolio_name || ""}
            </td>

            <td>
                ${statusBadgeHtml(item.status)}
            </td>

            <td>
                ${formatDate(item.start_date)}
            </td>

            <td>
                ${formatDate(item.target_date)}
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
                        onclick="editProject('${item.project_id}')">

                        &#9999;&#65039;

                    </button>

                    <button
                        class="btn btn-danger btn-sm"
                        title="Disable"
                        onclick="disableProject('${item.project_id}')">

                        &#128683;

                    </button>

                    `

                    : `

                    <button
                        class="btn btn-secondary btn-sm"
                        title="Enable"
                        onclick="enableProject('${item.project_id}')">

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

function newProject() {

    document.getElementById(
        "projectId"
    ).value = "";

    document.getElementById(
        "projectCode"
    ).value = "";

    document.getElementById(
        "projectName"
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
        "projectStatus"
    ).value =
        "Not Started";

    document.getElementById(
        "portfolioId"
    ).selectedIndex = 0;

    document.getElementById(
        "enabled"
    ).checked = true;

    document.getElementById(
        "enabled"
    ).disabled = true;

    openModal(
        "projectModal"
    );
}

function editProject(id) {

    const item =
        projectData.find(
            x =>
                x.project_id === id
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "projectId"
    ).value =
        item.project_id;

    document.getElementById(
        "portfolioId"
    ).value =
        item.portfolio_id;

    document.getElementById(
        "projectCode"
    ).value =
        item.project_code;

    document.getElementById(
        "projectName"
    ).value =
        item.project_name;

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
        "projectStatus"
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
        "projectModal"
    );
}

async function saveProject() {

    const projectId =
        getInputValue(
            "projectId"
        );

    const portfolioId =
        getInputValue(
            "portfolioId"
        );

    const projectCode =
        getInputValue(
            "projectCode"
        ).trim();

    const projectName =
        getInputValue(
            "projectName"
        ).trim();

    const duplicateCode =
        projectData.find(x =>

            (x.project_code || "")
                .trim()
                .toLowerCase() ===

            projectCode
                .toLowerCase()

            &&

            x.project_id !==
            projectId
        );

    if (duplicateCode) {

        showError(
            "Project Code already exists"
        );

        return;
    }

    const duplicateName =
        projectData.find(x =>

            x.portfolio_id ===
            portfolioId

            &&

            (x.project_name || "")
                .trim()
                .toLowerCase() ===

            projectName
                .toLowerCase()

            &&

            x.project_id !==
            projectId
        );

    if (duplicateName) {

        showError(
            "Project Name already exists in this Portfolio"
        );

        return;
    }

    if (
        !portfolioId ||
        !projectCode ||
        !projectName
    ) {

        showError(
            "Portfolio, Project Code and Project Name are required"
        );

        return;
    }

    const payload = {

        portfolio_id:
            portfolioId,

        project_code:
            projectCode,

        project_name:
            projectName,

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
                "projectStatus"
            ),

        enabled:
            document.getElementById(
                "enabled"
            ).checked,

        updated_by:
            getCurrentUser()
    };

    try {

        if (!projectId) {

            payload.created_by =
                getCurrentUser();

            await insertData(
                "project",
                payload
            );
        }
        else {

            await updateData(
                "project",
                "project_id",
                projectId,
                payload
            );
        }

        closeModal(
            "projectModal"
        );

        await loadProjects();

        showSuccess(
            projectId
                ? "Project updated successfully"
                : "Project created successfully"
        );
    }
    catch (error) {

        console.error(error);

        showError(
            "Unable to save project"
        );
    }
}

async function disableProject(
    projectId
) {

    if (
        !confirmAction(
            "Disable Project?"
        )
    ) {
        return;
    }

    await updateData(
        "project",
        "project_id",
        projectId,
        {
            enabled: false,
            updated_by:
                getCurrentUser()
        }
    );

    await loadProjects();
}

async function enableProject(
    projectId
) {

    if (
        !confirmAction(
            "Enable Project?"
        )
    ) {
        return;
    }

    await updateData(
        "project",
        "project_id",
        projectId,
        {
            enabled: true,
            updated_by:
                getCurrentUser()
        }
    );

    await loadProjects();
}

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {
            closeModal(
                "projectModal"
            );
        }

        // 🚀 ENTER KEY SHORTCUT: Save project form from keyboard
        const modal = document.getElementById("projectModal");
        if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {
            // Ignore Enter if the user is writing a long text description note
            if (event.key === "Enter" && document.activeElement.id !== "description") {
                event.preventDefault(); 
                saveProject();
            }
        }
    }
);