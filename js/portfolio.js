let portfolioData = [];

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        loadPortfolioTypes();

        await loadPortfolios();

        // 🚀 NEW: Instantly ready to search without clicking
        document.getElementById("searchText")?.focus();

    }
);

function loadPortfolioTypes() {

    const dropdown =
        document.getElementById(
            "portfolioType"
        );

    dropdown.innerHTML = "";

    MASTERS.PORTFOLIO_TYPES
        .forEach(type => {

            const option =
                document.createElement(
                    "option"
                );

            option.value = type;

            option.textContent = type;

            dropdown.appendChild(
                option
            );

        });
}

async function loadPortfolios() {

    portfolioData =
        await getData(
            "portfolio?order=portfolio_name.asc"
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
    }

    renderPortfolioGrid();
}


function renderPortfolioGrid() {

    const grid =
        document.getElementById(
            "portfolioGrid"
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

    const rows =
        portfolioData.filter(item => {

            const matchesSearch =

                (item.portfolio_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.description || "")
                    .toLowerCase()
                    .includes(search);

            let matchesStatus = true;

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
                matchesStatus
            );

        });



document.getElementById(
    "portfolioCount"
).textContent =
    `Showing ${rows.length} portfolio(s)`;


    grid.innerHTML = "";

    if (rows.length === 0) {

        grid.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    style="text-align:center;">

                    No portfolios found

                </td>

            </tr>

        `;

        return;
    }

    rows.forEach(item => {

        grid.innerHTML += `

        <tr>

            <td>
                <strong>${item.portfolio_name}</strong>
            </td>

            <td>
                ${item.portfolio_type}
            </td>

            <td>
                ${item.description || ""}
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
                        onclick="editPortfolio('${item.portfolio_id}')">

                        &#9999;&#65039;

                    </button>

                    <button
                        class="btn btn-danger btn-sm"
                        title="Disable"
                        onclick="disablePortfolio('${item.portfolio_id}')">

                        &#128683;

                    </button>

                    `

                    : `

                    <button
                        class="btn btn-secondary btn-sm"
                        title="Enable"
                        onclick="enablePortfolio('${item.portfolio_id}')">

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

function newPortfolio() {

    document.getElementById(
        "portfolioId"
    ).value = "";

    document.getElementById(
        "portfolioName"
    ).value = "";

    document.getElementById(
        "description"
    ).value = "";

    document.getElementById(
        "portfolioType"
    ).selectedIndex = 0;

    document.getElementById(
        "enabled"
    ).checked = true;


    document.getElementById(
        "enabled"
    ).disabled = true;


    openModal(
        "portfolioModal"
    );
}

function editPortfolio(id) {

    const item =
        portfolioData.find(
            x =>
                x.portfolio_id === id
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "portfolioId"
    ).value =
        item.portfolio_id;

    document.getElementById(
        "portfolioName"
    ).value =
        item.portfolio_name;

    document.getElementById(
        "portfolioType"
    ).value =
        item.portfolio_type;

    document.getElementById(
        "description"
    ).value =
        item.description || "";

    document.getElementById(
        "enabled"
    ).checked =
        item.enabled;


    document.getElementById(
        "enabled"
    ).disabled = false;


    openModal(
        "portfolioModal"
    );
}

async function savePortfolio() {

    const portfolioId =
        getInputValue(
            "portfolioId"
        );


    const portfolioName =
        getInputValue(
            "portfolioName"
        ).trim();


    const portfolioType =
        getInputValue(
            "portfolioType"
        );


const duplicate =
    portfolioData.find(x =>

        (x.portfolio_name || "")
            .trim()
            .toLowerCase() ===

        portfolioName
            .toLowerCase()

        &&

        x.portfolio_id !==
        portfolioId
    );




if (duplicate) {

    showError(
        "Portfolio Name already exists"
    );

    return;
}



    if (!portfolioName) {

        showError(
            "Portfolio Name is required"
        );

        return;
    }

    const payload = {

        portfolio_name:
            portfolioName,

        portfolio_type:
            portfolioType,

        description:
            getInputValue(
                "description"
            ),

        enabled:
            document.getElementById(
                "enabled"
            ).checked,

        updated_by:
            getCurrentUser()
    };

    try {

        if (!portfolioId) {

            payload.created_by =
                getCurrentUser();

            await insertData(
                "portfolio",
                payload
            );
        }
        else {

            await updateData(
                "portfolio",
                "portfolio_id",
                portfolioId,
                payload
            );
        }

        closeModal(
            "portfolioModal"
        );

        await loadPortfolios();


        showSuccess(
            portfolioId
                ? "Portfolio updated successfully"
                : "Portfolio created successfully"
        );


    }
    catch (error) {

        console.error(error);

        showError(
            "Unable to save portfolio"
        );
    }
}

async function disablePortfolio(
    portfolioId
) {

    if (
        !confirmAction(
            "Disable Portfolio?"
        )
    ) {
        return;
    }

    await updateData(
        "portfolio",
        "portfolio_id",
        portfolioId,
        {
            enabled: false,
            updated_by:
                getCurrentUser()
        }
    );

    await loadPortfolios();
}

async function enablePortfolio(
    portfolioId
) {

    if (
        !confirmAction(
            "Enable Portfolio?"
        )
    ) {
        return;
    }

    await updateData(
        "portfolio",
        "portfolio_id",
        portfolioId,
        {
            enabled: true,
            updated_by:
                getCurrentUser()
        }
    );

    await loadPortfolios();
}



// ... Existing code at the bottom of portfolio.js ...

document.addEventListener(
    "keydown",
    event => {
        // 1. Existing Escape Key handler
        if (event.key === "Escape") {
            closeModal("portfolioModal"); //
        }

        // 🚀 NEW: Check if the modal is currently open and user hits Enter
        const modal = document.getElementById("portfolioModal");
        if (modal && modal.style.display === "flex" || modal.style.display === "block") {
            // Ignore Enter if the user is typing inside a multiline textarea description box
            if (event.key === "Enter" && document.activeElement.id !== "description") {
                event.preventDefault(); // Stop native page submissions or linebreaks
                savePortfolio(); // Triggers your save logic automatically!
            }
        }
    }
);
