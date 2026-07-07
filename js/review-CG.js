let activitySummary = {};

let timeSummary = {};

let portfolioTime = [];

let openActivities = [];

let recentLogs = [];

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        await loadReviewData();

    }
);

async function loadReviewData() {

    try {

        await Promise.all([

            loadActivitySummary(),

            loadTimeSummary(),

            loadPortfolioTime(),

            loadOpenActivities(),

            loadRecentLogs()

        ]);

    }
    catch (error) {

        console.error(
            error
        );

        showError(
            "Unable to load review data"
        );
    }
}

async function loadActivitySummary() {

    const data =
        await getData(
            "vw_review_activity_summary"
        );

    if (
        !Array.isArray(data)
        ||
        data.length === 0
    ) {
        return;
    }

    activitySummary =
        data[0];

    document.getElementById(
        "openActivities"
    ).textContent =
        activitySummary.open_activities || 0;

    document.getElementById(
        "inProgressActivities"
    ).textContent =
        activitySummary.in_progress_activities || 0;

    document.getElementById(
        "completedActivities"
    ).textContent =
        activitySummary.completed_activities || 0;

    document.getElementById(
        "overdueActivities"
    ).textContent =
        activitySummary.overdue_activities || 0;
}

async function loadTimeSummary() {

    const data =
        await getData(
            "vw_review_time_summary"
        );

    if (
        !Array.isArray(data)
        ||
        data.length === 0
    ) {
        return;
    }

    timeSummary =
        data[0];

    document.getElementById(
        "todayHours"
    ).textContent =
        `${(
            (timeSummary.today_minutes || 0)
            / 60
        ).toFixed(1)} hrs`;

    document.getElementById(
        "weekHours"
    ).textContent =
        `${(
            (timeSummary.week_minutes || 0)
            / 60
        ).toFixed(1)} hrs`;

    document.getElementById(
        "monthHours"
    ).textContent =
        `${(
            (timeSummary.month_minutes || 0)
            / 60
        ).toFixed(1)} hrs`;
}

async function loadPortfolioTime() {

    portfolioTime =
        await getData(
            "vw_review_portfolio_time"
        );

    if (
        !Array.isArray(
            portfolioTime
        )
    ) {

        portfolioTime = [];

        return;
    }

    renderPortfolioTime();
}

function renderPortfolioTime() {

    const grid =
        document.getElementById(
            "portfolioTimeGrid"
        );

    grid.innerHTML = "";

    if (
        portfolioTime.length === 0
    ) {

        grid.innerHTML = `
            <tr>
                <td colspan="3"
                    style="text-align:center;">
                    No data found
                </td>
            </tr>
        `;

        return;
    }

    const totalHours =
        portfolioTime.reduce(
            (sum, row) =>
                sum +
                Number(
                    row.hours_spent || 0
                ),
            0
        );

    portfolioTime.forEach(
        item => {

            const percentage =
                totalHours === 0
                    ? 0
                    : (
                        (
                            item.hours_spent
                            /
                            totalHours
                        ) * 100
                    ).toFixed(1);

            grid.innerHTML += `

                <tr>

                    <td>
                        ${item.portfolio_name}
                    </td>

                    <td>
                        ${item.hours_spent}
                    </td>

                    <td>
                        ${percentage}%
                    </td>

                </tr>

            `;
        }
    );
}

async function loadOpenActivities() {

    openActivities =
        await getData(
            "vw_review_open_activities?order=target_date.asc"
        );

    if (
        !Array.isArray(
            openActivities
        )
    ) {

        openActivities = [];

        return;
    }

    renderOpenActivities();
}

function renderOpenActivities() {

    const grid =
        document.getElementById(
            "openActivitiesGrid"
        );

    grid.innerHTML = "";

    if (
        openActivities.length === 0
    ) {

        grid.innerHTML = `
            <tr>
                <td colspan="4"
                    style="text-align:center;">
                    No open activities
                </td>
            </tr>
        `;

        return;
    }

    openActivities.forEach(
        item => {

            const context =

                item.milestone_name

                    ?

                    `${item.portfolio_name}
                    ->
                    ${item.project_name}
                    ->
                    ${item.milestone_name}`

                    :

                    "Standalone Activity";

            grid.innerHTML += `

                <tr>

                    <td>
                        ${item.activity_name}
                    </td>

                    <td>
                        ${item.status}
                    </td>

                    <td>
                        ${formatDate(
                            item.target_date
                        )}
                    </td>

                    <td>
                        ${context}
                    </td>

                </tr>

            `;
        }
    );
}

async function loadRecentLogs() {

    recentLogs =
        await getData(
            "vw_review_recent_logs?limit=10"
        );

    if (
        !Array.isArray(
            recentLogs
        )
    ) {

        recentLogs = [];

        return;
    }

    renderRecentLogs();
}

function renderRecentLogs() {

    const grid =
        document.getElementById(
            "recentLogsGrid"
        );

    grid.innerHTML = "";

    if (
        recentLogs.length === 0
    ) {

        grid.innerHTML = `
            <tr>
                <td colspan="4"
                    style="text-align:center;">
                    No recent logs
                </td>
            </tr>
        `;

        return;
    }

    recentLogs.forEach(
        item => {

            grid.innerHTML += `

                <tr>

                    <td>
                        ${formatDate(
                            item.task_date
                        )}
                    </td>

                    <td>
                        ${item.task_description || ""}
                    </td>

                    <td>

                        ${item.activity_name || ""}

                        <br>

                        <span
                            style="
                                color:#666;">

                            ${item.activity_status || ""}

                        </span>

                    </td>

                    <td>
                        ${item.minutes_spent || 0}
                    </td>

                </tr>

            `;
        }
    );
}