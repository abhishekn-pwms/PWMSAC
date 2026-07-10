// AC v1.6 TODO NOTES

// ======================================================
// Work Breakdown (Deep Dive Planner)
// Milestone -> ToDo -> Task Log, nested & filterable.
// Desktop-first. No enabled/status hiding logic yet
// (that comes later once enabled-flag filtering rolls
// out app-wide) — this page shows everything that
// exists so far in the ToDo/Task Log mapping.
// ======================================================

let wbMilestones = [];
let wbTodos = [];
let wbTaskLogs = [];

let wbExpandedMilestones = new Set();
let wbExpandedTodos = new Set();

const WB_OPEN_STATUSES = ["Not Started", "In Progress", "On Hold"];
const WB_CLOSED_STATUSES = ["Completed", "Cancelled"];

const WB_STATUS_SORT_ORDER = {
    "In Progress": 0,
    "Not Started": 1,
    "On Hold": 2,
    "Completed": 3,
    "Cancelled": 4
};

let wbDatePreset = "7days";


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        await loadWorkBreakdownData();

        renderWorkBreakdown();
    }
);


// ======================================================
// DATA LOADING
// ======================================================

async function loadWorkBreakdownData() {

    wbMilestones =
        await getData(
            "vw_milestone_details?enabled=eq.true&order=target_date.asc"
        );

    if (!Array.isArray(wbMilestones)) {
        wbMilestones = [];
    }

    wbTodos =
        await getData(
            "vw_todo?order=due_date.asc"
        );

    if (!Array.isArray(wbTodos)) {
        wbTodos = [];
    }

    populateMilestonePicker();

    // Milestones default expanded so the page reads as a full picture on load
    wbMilestones.forEach(m => wbExpandedMilestones.add(m.milestone_id));

    await loadWorkBreakdownTaskLogs();
}


async function loadWorkBreakdownTaskLogs() {

    const range = getWorkBreakdownDateRange();

    let query = "vw_task_log_details?order=task_date.desc";

    if (range.from) {
        query += `&task_date=gte.${range.from}`;
    }

    if (range.to) {
        query += `&task_date=lte.${range.to}`;
    }

    wbTaskLogs = await getData(query);

    if (!Array.isArray(wbTaskLogs)) {
        wbTaskLogs = [];
    }

    // Only logs mapped to a ToDo count toward this planner —
    // legacy Activity-only logs aren't part of the ToDo breakdown.
    wbTaskLogs = wbTaskLogs.filter(t => !!t.todo_id);
}


function populateMilestonePicker() {

    const picker =
        document.getElementById("wbMilestonePicker");

    const currentValue = picker.value || "All";

    picker.innerHTML = `<option value="All">All Milestones</option>`;

    wbMilestones
        .slice()
        .sort((a, b) =>
            (a.milestone_name || "").localeCompare(b.milestone_name || "")
        )
        .forEach(m => {

            picker.innerHTML += `
                <option value="${m.milestone_id}">
                    ${m.milestone_name}
                </option>
            `;
        });

    picker.value = currentValue;
}


// ======================================================
// DATE RANGE HANDLING
// ======================================================

function getWorkBreakdownDateRange() {

    const today = getToday();

    if (wbDatePreset === "today") {
        return { from: today, to: today };
    }

    if (wbDatePreset === "week") {

        const now = new Date();
        const day = now.getDay(); // 0 = Sunday
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((day + 6) % 7));

        return {
            from: monday.toISOString().split("T")[0],
            to: today
        };
    }

    if (wbDatePreset === "7days") {

        const from = new Date();
        from.setDate(from.getDate() - 6);

        return {
            from: from.toISOString().split("T")[0],
            to: today
        };
    }

    if (wbDatePreset === "month") {

        const now = new Date();
        const firstOfMonth =
            new Date(now.getFullYear(), now.getMonth(), 1);

        return {
            from: firstOfMonth.toISOString().split("T")[0],
            to: today
        };
    }

    if (wbDatePreset === "custom") {

        return {
            from: document.getElementById("wbDateFrom").value || null,
            to: document.getElementById("wbDateTo").value || null
        };
    }

    // "all"
    return { from: null, to: null };
}


function setWorkBreakdownDatePreset(preset) {

    wbDatePreset = preset;

    document
        .querySelectorAll(".wb-preset-btn")
        .forEach(btn =>
            btn.classList.toggle(
                "active",
                btn.dataset.preset === preset
            )
        );

    document.getElementById("wbCustomDateRow").style.display =
        (preset === "custom") ? "flex" : "none";

    if (preset !== "custom") {
        applyWorkBreakdownFilters();
    }
}


async function applyWorkBreakdownFilters() {

    await loadWorkBreakdownTaskLogs();

    renderWorkBreakdown();
}


async function refreshWorkBreakdown() {

    await loadWorkBreakdownData();

    renderWorkBreakdown();
}


// ======================================================
// EXPAND / COLLAPSE
// ======================================================

function toggleMilestone(milestoneId) {

    if (wbExpandedMilestones.has(milestoneId)) {
        wbExpandedMilestones.delete(milestoneId);
    } else {
        wbExpandedMilestones.add(milestoneId);
    }

    renderWorkBreakdown();
}


function toggleTodo(todoId) {

    if (wbExpandedTodos.has(todoId)) {
        wbExpandedTodos.delete(todoId);
    } else {
        wbExpandedTodos.add(todoId);
    }

    renderWorkBreakdown();
}


function expandAllMilestones() {

    wbMilestones.forEach(m => wbExpandedMilestones.add(m.milestone_id));

    renderWorkBreakdown();
}


function collapseAllMilestones() {

    wbExpandedMilestones.clear();

    renderWorkBreakdown();
}


// ======================================================
// RENDER
// ======================================================

function renderWorkBreakdown() {

    const container =
        document.getElementById("wbTreeContainer");

    const statusFilter =
        document.getElementById("wbMilestoneStatusFilter").value;

    const milestonePickerValue =
        document.getElementById("wbMilestonePicker").value;

    let visibleMilestones =
        wbMilestones.filter(m => {

            if (milestonePickerValue !== "All" &&
                m.milestone_id !== milestonePickerValue) {
                return false;
            }

            if (statusFilter === "Open") {
                return WB_OPEN_STATUSES.includes(m.status);
            }

            if (statusFilter === "Completed") {
                return WB_CLOSED_STATUSES.includes(m.status);
            }

            return true; // "All"
        });

    visibleMilestones =
        visibleMilestones.slice().sort((a, b) => {

            const orderA = WB_STATUS_SORT_ORDER[a.status] ?? 5;
            const orderB = WB_STATUS_SORT_ORDER[b.status] ?? 5;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            const dateA = a.target_date || "9999-12-31";
            const dateB = b.target_date || "9999-12-31";

            return dateA.localeCompare(dateB);
        });

    if (visibleMilestones.length === 0) {

        container.innerHTML = `
            <div class="wb-empty-state">
                No milestones match the current filters.
            </div>
        `;

        updateWorkBreakdownSummary(0, 0, 0, 0);

        return;
    }

    let totalTodos = 0;
    let totalTasks = 0;
    let totalMinutes = 0;

    container.innerHTML =
        visibleMilestones
            .map(milestone => {

                const todosForMilestone =
                    wbTodos.filter(
                        t => t.milestone_id === milestone.milestone_id
                    );

                totalTodos += todosForMilestone.length;

                const { html, minutes, taskCount } =
                    renderTodoRows(todosForMilestone);

                totalMinutes += minutes;
                totalTasks += taskCount;

                const isExpanded =
                    wbExpandedMilestones.has(milestone.milestone_id);

                return `
                    <div class="wb-milestone-card">

                        <div class="wb-milestone-header"
                             onclick="toggleMilestone('${milestone.milestone_id}')">

                            <span class="wb-chevron ${isExpanded ? "open" : ""}">▶</span>

                            <div class="wb-milestone-title-block">
                                <div class="wb-milestone-name">${milestone.milestone_name}</div>
                                <div class="wb-milestone-context">
                                    ${milestone.project_name || ""}${milestone.portfolio_name ? " · " + milestone.portfolio_name : ""}
                                </div>
                            </div>

                            ${statusBadgeHtml(milestone.status)}

                            <div class="wb-milestone-stats">
                                <span>${todosForMilestone.length} ToDo(s)</span>
                                <span>${formatMinutesAsHours(minutes)} logged</span>
                            </div>

                        </div>

                        <div class="wb-milestone-body" style="display:${isExpanded ? "block" : "none"};">
                            ${todosForMilestone.length > 0 ? html : `<div class="wb-empty-state wb-empty-state-small">No ToDos under this milestone yet.</div>`}
                        </div>

                    </div>
                `;
            })
            .join("");

    updateWorkBreakdownSummary(
        visibleMilestones.length,
        totalTodos,
        totalTasks,
        totalMinutes
    );
}


function renderTodoRows(todos) {

    let minutes = 0;
    let taskCount = 0;

    const sorted =
        todos.slice().sort((a, b) => {

            const dateA = a.due_date || "9999-12-31";
            const dateB = b.due_date || "9999-12-31";

            return dateA.localeCompare(dateB);
        });

    const html =
        sorted
            .map(todo => {

                const logsForTodo =
                    wbTaskLogs.filter(
                        l => l.todo_id === todo.todo_id
                    );

                const todoMinutes =
                    logsForTodo.reduce(
                        (sum, l) => sum + (l.minutes_spent || 0),
                        0
                    );

                minutes += todoMinutes;
                taskCount += logsForTodo.length;

                const isExpanded =
                    wbExpandedTodos.has(todo.todo_id);

                const logsHtml =
                    logsForTodo
                        .slice()
                        .sort((a, b) =>
                            (b.task_date || "").localeCompare(a.task_date || "")
                        )
                        .map(log => `
                            <div class="wb-task-log-row">
                                <div class="wb-task-log-date">${formatDate(log.task_date)}</div>
                                <div class="wb-task-log-desc">${log.task_description || ""}</div>
                                <div class="wb-task-log-minutes">${formatMinutesAsHours(log.minutes_spent || 0)}</div>
                            </div>
                        `)
                        .join("");

                const notesPreview = getNotesPreview(todo.notes, 150);

                return `
                    <div class="wb-todo-row">

                        <div class="wb-todo-header" onclick="toggleTodo('${todo.todo_id}')">

                            <span class="wb-chevron wb-chevron-small ${isExpanded ? "open" : ""}">▶</span>

                            <div class="wb-todo-text">${todo.todo_text}</div>

                            ${statusBadgeHtml(todo.status)}

                            <div class="wb-todo-stats">
                                <span>${logsForTodo.length} log(s)</span>
                                <span>${formatMinutesAsHours(todoMinutes)}</span>
                            </div>

                        </div>

                        ${notesPreview ? `<div class="wb-todo-notes-preview">📝 ${notesPreview}</div>` : ""}

                        <div class="wb-todo-body" style="display:${isExpanded ? "block" : "none"};">
                            ${logsForTodo.length > 0 ? logsHtml : `<div class="wb-empty-state wb-empty-state-small">No task logs in this date range.</div>`}
                        </div>

                    </div>
                `;
            })
            .join("");

    return { html, minutes, taskCount };
}


function updateWorkBreakdownSummary(milestoneCount, todoCount, taskCount, minutes) {

    document.getElementById("wbSummaryMilestones").textContent =
        `${milestoneCount} Milestone(s)`;

    document.getElementById("wbSummaryTodos").textContent =
        `${todoCount} ToDo(s)`;

    document.getElementById("wbSummaryTasks").textContent =
        `${taskCount} Task Log(s)`;

    document.getElementById("wbSummaryHours").textContent =
        `${formatMinutesAsHours(minutes)} logged`;
}


function formatMinutesAsHours(minutes) {

    if (!minutes) {
        return "0h";
    }

    const hours = minutes / 60;

    return `${hours.toFixed(1)}h`;
}
