// AC v1.3 Pass 3 WORKMAP

// ======================================================
// Work Map — Milestone Cards Overview
// Single-glance view of all milestones. Click a card to
// expand an inline ToDo/Task panel next to it, in place,
// without losing sight of the other milestones.
// ======================================================

let wmMilestones = [];
let wmTodos = [];
let wmTaskLogs = [];

let wmSelectedMilestoneId = null;
let wmEditingTodoId = null;
let wmAddingLogForTodoId = null;
let wmEditingLogId = null;

const WM_CLOSED_STATUSES = ["Completed", "Cancelled"];
const WM_STANDALONE_ID = "__standalone__";


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateMilestoneStatusOptions();

        await loadWorkMapData();

        renderWorkMap();
    }
);


function populateMilestoneStatusOptions() {

    const select = document.getElementById("wmModalStatus");

    select.innerHTML =
        MASTERS.MILESTONE_STATUS
            .map(s => `<option value="${s}">${s}</option>`)
            .join("");
}


// ======================================================
// DATA LOADING
// All-time data — the "no task logs yet" critical flag
// needs to know about ALL history, not just a recent window.
// ======================================================

async function loadWorkMapData() {

    wmMilestones =
        await getData(
            "vw_milestone_details?enabled=eq.true&order=target_date.desc"
        );

    if (!Array.isArray(wmMilestones)) {
        wmMilestones = [];
    }

    wmTodos =
        await getData("vw_todo");

    if (!Array.isArray(wmTodos)) {
        wmTodos = [];
    }

    wmTaskLogs =
        await getData("vw_task_log_details?todo_id=not.is.null");

    if (!Array.isArray(wmTaskLogs)) {
        wmTaskLogs = [];
    }
}


async function refreshWorkMap() {

    await loadWorkMapData();

    renderWorkMap();
}


function isMilestoneClosed(status) {

    return WM_CLOSED_STATUSES.includes(status);
}


// ======================================================
// STATS PER MILESTONE
// ======================================================

function getTodosForMilestoneId(milestoneId) {

    if (milestoneId === WM_STANDALONE_ID) {
        return wmTodos.filter(t => !t.milestone_id);
    }

    return wmTodos.filter(t => t.milestone_id === milestoneId);
}


function getMilestoneStats(milestoneId) {

    const todosForMilestone = getTodosForMilestoneId(milestoneId);

    let loggedCount = 0;
    let pendingCount = 0;
    let totalMinutes = 0;

    todosForMilestone.forEach(todo => {

        const logs =
            wmTaskLogs.filter(l => l.todo_id === todo.todo_id);

        totalMinutes +=
            logs.reduce((sum, l) => sum + (l.minutes_spent || 0), 0);

        if (logs.length > 0) {
            loggedCount++;
        } else if (todo.status === "Open" || todo.status === "In Progress") {
            pendingCount++;
        }
    });

    return {
        todoCount: todosForMilestone.length,
        loggedCount,
        pendingCount,
        totalMinutes,
        isCritical: pendingCount > 0
    };
}


function getDaysRemaining(targetDate) {

    if (!targetDate) {
        return null;
    }

    const today = new Date();
    const target = new Date(targetDate);

    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}


// ======================================================
// NEAREST DATE + HEAT TIER
// Urgency is driven by whichever comes first: the
// milestone's own target date, or the earliest due_date
// among its still-active ToDos. A distant milestone with
// an urgent ToDo underneath it should still run hot.
// ======================================================

function getNearestDateInfo(milestone, todosForMilestone) {

    const candidates = [];

    if (milestone.target_date) {
        candidates.push({
            date: milestone.target_date,
            source: "milestone"
        });
    }

    todosForMilestone
        .filter(t =>
            t.due_date &&
            t.status !== "Completed" &&
            t.status !== "Cancelled"
        )
        .forEach(t => {
            candidates.push({
                date: t.due_date,
                source: "todo",
                text: t.todo_text
            });
        });

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => a.date.localeCompare(b.date));

    const nearest = candidates[0];

    return {
        ...nearest,
        daysRemaining: getDaysRemaining(nearest.date)
    };
}


function getEarliestActiveTodoDate(todosForMilestone) {

    const dated =
        todosForMilestone
            .filter(t =>
                t.due_date &&
                t.status !== "Completed" &&
                t.status !== "Cancelled"
            )
            .slice()
            .sort((a, b) => a.due_date.localeCompare(b.due_date));

    return dated.length > 0 ? dated[0] : null;
}


function getHeatTier(daysRemaining) {

    if (daysRemaining === null || daysRemaining === undefined) {
        return "neutral";
    }

    if (daysRemaining <= 3) {
        return "critical";
    }

    if (daysRemaining <= 7) {
        return "hot";
    }

    if (daysRemaining <= 14) {
        return "warm";
    }

    return "neutral";
}


// ======================================================
// RENDER — CARD GRID
// ======================================================

function renderWorkMap() {

    const grid = document.getElementById("wmCardGrid");

    const searchText =
        (document.getElementById("wmSearchBox").value || "")
            .toLowerCase()
            .trim();

    let visibleMilestones =
        wmMilestones.filter(m =>
            !searchText ||
            (m.milestone_name || "").toLowerCase().includes(searchText) ||
            (m.project_name || "").toLowerCase().includes(searchText)
        );

    const realMilestoneCount = visibleMilestones.length;

    const standaloneTodos = wmTodos.filter(t => !t.milestone_id);

    const standaloneMatchesSearch =
        !searchText ||
        "standalone".includes(searchText) ||
        "unassigned".includes(searchText) ||
        standaloneTodos.some(t => (t.todo_text || "").toLowerCase().includes(searchText));

    if (standaloneTodos.length > 0 && standaloneMatchesSearch) {

        visibleMilestones = visibleMilestones.concat([{
            milestone_id: WM_STANDALONE_ID,
            milestone_name: "Standalone ToDos",
            project_name: "Not tied to any milestone",
            portfolio_name: "",
            status: "Open",
            target_date: null
        }]);
    }

    if (visibleMilestones.length === 0) {

        grid.innerHTML = `<div class="wb-empty-state">No milestones match your search.</div>`;

        updateWorkMapSummary(0, 0);

        return;
    }

    let criticalCount = 0;

    const withStats =
        visibleMilestones.map(milestone => {

            const stats = getMilestoneStats(milestone.milestone_id);

            const todosForMilestone =
                getTodosForMilestoneId(milestone.milestone_id);

            const nearest =
                getNearestDateInfo(milestone, todosForMilestone);

            if (stats.isCritical) {
                criticalCount++;
            }

            return { milestone, stats, nearest };
        });

    // Open milestones first (sorted by urgency), closed ones always at the
    // end regardless of how overdue their old target date looks.
    withStats.sort((a, b) => {

        const closedA = isMilestoneClosed(a.milestone.status) ? 1 : 0;
        const closedB = isMilestoneClosed(b.milestone.status) ? 1 : 0;

        if (closedA !== closedB) {
            return closedA - closedB;
        }

        const daysA = a.nearest ? a.nearest.daysRemaining : Infinity;
        const daysB = b.nearest ? b.nearest.daysRemaining : Infinity;

        return daysA - daysB;
    });

    grid.innerHTML =
        withStats
            .map(({ milestone, stats, nearest }) => {

                const isSelected =
                    milestone.milestone_id === wmSelectedMilestoneId;

                if (isSelected) {
                    return renderExpandedRow(milestone, stats, nearest);
                }

                return renderMilestoneCard(milestone, stats, nearest);
            })
            .join("");

    updateWorkMapSummary(realMilestoneCount, criticalCount);

    populateOpenEditPickers();
}


function renderMilestoneCard(milestone, stats, nearest) {

    const closed = isMilestoneClosed(milestone.status);
    const isStandalone = (milestone.milestone_id === WM_STANDALONE_ID);

    const heatTier = closed ? "neutral" : getHeatTier(nearest ? nearest.daysRemaining : null);

    const criticalClass = (stats.isCritical && !closed) ? "wm-card-critical" : "";

    return `
        <div class="wm-card wm-heat-${heatTier} ${criticalClass}" onclick="selectMilestone('${milestone.milestone_id}')">

            <div class="wm-card-top">
                ${isStandalone ? `<span class="badge-pill badge-status-not-started">Standalone</span>` : statusBadgeHtml(milestone.status)}
                ${(stats.isCritical && !closed) ? `<span class="wm-critical-flag" title="Has ToDo(s) started with zero task logs">⚠️ Needs attention</span>` : ""}
                <div class="wm-card-actions">
                    ${isStandalone ? "" : `<button type="button" class="wm-icon-btn" title="Edit milestone" onclick="event.stopPropagation(); editMilestone('${milestone.milestone_id}')">✏️</button>`}
                </div>
            </div>

            <div class="wm-card-name">${milestone.milestone_name}</div>
            <div class="wm-card-context">${milestone.project_name || ""}</div>

            ${renderNearestDateBlock(milestone, nearest, closed)}

            <div class="wm-card-stats-row">
                <div class="wm-card-stat">
                    <div class="wm-card-stat-value">${stats.todoCount}</div>
                    <div class="wm-card-stat-label">ToDos</div>
                </div>
                <div class="wm-card-stat">
                    <div class="wm-card-stat-value" style="color: var(--success);">${stats.loggedCount}</div>
                    <div class="wm-card-stat-label">Logged</div>
                </div>
                <div class="wm-card-stat">
                    <div class="wm-card-stat-value" style="color: ${stats.pendingCount > 0 ? "var(--danger-strong)" : "var(--text-faint)"};">${stats.pendingCount}</div>
                    <div class="wm-card-stat-label">Pending</div>
                </div>
            </div>

        </div>
    `;
}


function renderNearestDateBlock(milestone, nearest, closed) {

    const isStandalone = (milestone.milestone_id === WM_STANDALONE_ID);

    const todosForMilestone = getTodosForMilestoneId(milestone.milestone_id);

    const earliestTodo = getEarliestActiveTodoDate(todosForMilestone);

    let secondLine = `<span class="wm-date-placeholder">No active ToDo due date</span>`;

    if (earliestTodo && !closed) {

        const todoDays = getDaysRemaining(earliestTodo.due_date);

        secondLine = `
            <span title="${earliestTodo.todo_text}">📌 ${formatDate(earliestTodo.due_date)}</span>
            <span class="wm-days-chip ${todoDays < 0 ? "wm-days-overdue" : ""}">${todoDays < 0 ? Math.abs(todoDays) + "d overdue" : todoDays + "d left"}</span>
        `;
    }

    if (isStandalone) {
        // No milestone target date exists for the standalone bucket —
        // just show the nearest active ToDo due date, full width.
        return `<div class="wm-card-date-row">${secondLine}</div>`;
    }

    const milestoneDateLabel =
        `🎯 ${formatDate(milestone.target_date) || "—"}`;

    const milestoneDays = getDaysRemaining(milestone.target_date);

    const milestoneDaysChip =
        (milestone.target_date && !closed)
            ? `<span class="wm-days-chip ${milestoneDays < 0 ? "wm-days-overdue" : ""}">${milestoneDays < 0 ? Math.abs(milestoneDays) + "d overdue" : milestoneDays + "d left"}</span>`
            : "";

    return `
        <div class="wm-card-date-row">
            <span>${milestoneDateLabel}</span>
            ${milestoneDaysChip}
        </div>
        <div class="wm-card-date-row">
            ${secondLine}
        </div>
    `;
}


function renderExpandedRow(milestone, stats, nearest) {

    const closed = isMilestoneClosed(milestone.status);
    const isStandalone = (milestone.milestone_id === WM_STANDALONE_ID);

    const heatTier = closed ? "neutral" : getHeatTier(nearest ? nearest.daysRemaining : null);

    const criticalClass = (stats.isCritical && !closed) ? "wm-card-critical" : "";

    return `
        <div class="wm-expanded-row">

            <div class="wm-card wm-card-selected wm-heat-${heatTier} ${criticalClass}" onclick="selectMilestone('${milestone.milestone_id}')">

                <div class="wm-card-top">
                    ${isStandalone ? `<span class="badge-pill badge-status-not-started">Standalone</span>` : statusBadgeHtml(milestone.status)}
                    ${(stats.isCritical && !closed) ? `<span class="wm-critical-flag">⚠️ Needs attention</span>` : ""}
                    <div class="wm-card-actions">
                        ${isStandalone ? "" : `<button type="button" class="wm-icon-btn" title="Edit milestone" onclick="event.stopPropagation(); editMilestone('${milestone.milestone_id}')">✏️</button>`}
                    </div>
                </div>

                <div class="wm-card-name">${milestone.milestone_name}</div>
                <div class="wm-card-context">${milestone.project_name || ""}</div>

                ${renderNearestDateBlock(milestone, nearest, closed)}

                <div class="wm-card-stats-row">
                    <div class="wm-card-stat">
                        <div class="wm-card-stat-value">${stats.todoCount}</div>
                        <div class="wm-card-stat-label">ToDos</div>
                    </div>
                    <div class="wm-card-stat">
                        <div class="wm-card-stat-value" style="color: var(--success);">${stats.loggedCount}</div>
                        <div class="wm-card-stat-label">Logged</div>
                    </div>
                    <div class="wm-card-stat">
                        <div class="wm-card-stat-value" style="color: ${stats.pendingCount > 0 ? "var(--danger-strong)" : "var(--text-faint)"};">${stats.pendingCount}</div>
                        <div class="wm-card-stat-label">Pending</div>
                    </div>
                </div>

                <div class="wm-card-collapse-hint">Click to collapse</div>

            </div>

            <div class="wm-detail-panel">

                <div class="wm-detail-panel-header">
                    <div class="wm-detail-panel-title">${milestone.milestone_name} — ToDo Breakdown</div>
                    <a class="wm-open-detail-icon" href="workmap-detail.html?milestone_id=${milestone.milestone_id}" title="Open full detail view">⤢</a>
                </div>

                <div class="wm-detail-panel-body">
                    ${renderMilestoneTodoTree(milestone.milestone_id)}
                </div>

            </div>

        </div>
    `;
}


// ======================================================
// TODO / TASK LOG TREE (scoped to one milestone)
// With inline edit / delete / add-log actions.
// ======================================================

function renderMilestoneTodoTree(milestoneId) {

    const todos =
        getTodosForMilestoneId(milestoneId)
            .slice()
            .sort((a, b) => {

                const dateA = a.due_date || "9999-12-31";
                const dateB = b.due_date || "9999-12-31";

                return dateA.localeCompare(dateB);
            });

    if (todos.length === 0) {
        return `<div class="wb-empty-state wb-empty-state-small">No ToDos under this milestone yet.</div>`;
    }

    return todos
        .map(todo => renderTodoBlock(todo))
        .join("");
}


function renderTodoBlock(todo) {

    const logs =
        wmTaskLogs
            .filter(l => l.todo_id === todo.todo_id)
            .slice()
            .sort((a, b) => (b.task_date || "").localeCompare(a.task_date || ""));

    const todoMinutes =
        logs.reduce((sum, l) => sum + (l.minutes_spent || 0), 0);

    const flagClass =
        logs.length === 0 &&
        (todo.status === "Open" || todo.status === "In Progress")
            ? "wm-todo-row-flagged"
            : "";

    const isEditingThisTodo = (wmEditingTodoId === todo.todo_id);
    const isAddingLogHere = (wmAddingLogForTodoId === todo.todo_id);

    // Header row always stays visible as-is; the edit icon opens a second
    // row underneath it (milestone reassignment + notes live there) rather
    // than replacing the header.
    const headerHtml = `
        <div class="wb-todo-header" style="cursor:default;">
            <div class="wb-todo-text">${todo.todo_text}</div>
            ${statusBadgeHtml(todo.status)}
            <div class="wb-todo-stats">
                <span>${logs.length} log(s)</span>
                <span>${formatMinutesAsHours(todoMinutes)}</span>
            </div>
            <div class="wm-row-actions">
                <button type="button" class="wm-icon-btn" title="Edit ToDo" onclick="editTodoInline('${todo.todo_id}')">✏️</button>
                <button type="button" class="wm-icon-btn wm-icon-btn-danger" title="Delete ToDo" onclick="deleteTodoInline('${todo.todo_id}')">🗑️</button>
            </div>
        </div>
    `;

    const editPanelHtml =
        isEditingThisTodo
            ? renderTodoEditForm(todo)
            : "";

    const logsHtml =
        logs
            .map(log => renderLogRow(log))
            .join("");

    const addLogSection =
        isAddingLogHere
            ? renderAddLogForm(todo.todo_id)
            : `<button type="button" class="wm-add-log-btn" onclick="showAddLogForm('${todo.todo_id}')">+ Add Task Log</button>`;

    return `
        <div class="wb-todo-row ${flagClass}">
            ${headerHtml}
            ${editPanelHtml}
            <div class="wb-todo-body" style="display:block;">
                ${logs.length > 0 ? logsHtml : `<div class="wb-empty-state wb-empty-state-small">Not started — no task logs yet.</div>`}
                ${addLogSection}
            </div>
        </div>
    `;
}


function renderLogRow(log) {

    if (wmEditingLogId === log.task_log_id) {
        return renderLogEditForm(log);
    }

    return `
        <div class="wb-task-log-row">
            <div class="wb-task-log-date">${formatDate(log.task_date)}</div>
            <div class="wb-task-log-desc">${log.task_description || ""}</div>
            <div class="wb-task-log-minutes">${formatMinutesAsHours(log.minutes_spent || 0)}</div>
            <div class="wm-row-actions">
                <button type="button" class="wm-icon-btn" title="Edit log" onclick="editLogInline('${log.task_log_id}')">✏️</button>
                <button type="button" class="wm-icon-btn wm-icon-btn-danger" title="Delete log" onclick="deleteLogInline('${log.task_log_id}')">🗑️</button>
            </div>
        </div>
    `;
}


function renderTodoEditForm(todo) {

    const suffix = todo.todo_id;

    return `
        <div class="wm-inline-edit-form wm-inline-edit-form-full">

            <div class="wm-edit-field-row">
                <label>ToDo</label>
                <input type="text" id="wmEditTodoText_${suffix}" value="${(todo.todo_text || "").replace(/"/g, "&quot;")}" maxlength="200">
            </div>

            <div class="wm-edit-field-row wm-edit-field-row-split">
                <div>
                    <label>Status</label>
                    <select id="wmEditTodoStatus_${suffix}">
                        <option value="Open" ${todo.status === "Open" ? "selected" : ""}>Open</option>
                        <option value="In Progress" ${todo.status === "In Progress" ? "selected" : ""}>In Progress</option>
                        <option value="Completed" ${todo.status === "Completed" ? "selected" : ""}>Completed</option>
                        <option value="Cancelled" ${todo.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                    </select>
                </div>
                <div>
                    <label>Due Date</label>
                    <input type="date" id="wmEditTodoDue_${suffix}" value="${todo.due_date || ""}">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Milestone</label>
                <div class="activity-picker-row">
                    <select id="wmEditTodoMilestone_${suffix}" onchange="wmMilestonePickerChanged('${suffix}')"></select>
                    <input type="search" id="wmEditTodoMilestoneSearch_${suffix}" placeholder="Filter milestones..." onkeyup="wmFilterMilestonePicker('${suffix}')">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Context</label>
                <div class="activity-context-box" id="wmEditTodoMilestoneContext_${suffix}">Standalone Action</div>
            </div>

            <div class="wm-edit-field-row">
                <label>Notes</label>
                <textarea id="wmEditTodoNotes_${suffix}" rows="2">${todo.notes || ""}</textarea>
            </div>

            <div class="wm-inline-edit-actions">
                <button type="button" class="btn btn-primary" onclick="saveTodoEdit('${suffix}')">Save</button>
                <button type="button" class="btn btn-secondary" onclick="cancelEditTodo()">Cancel</button>
            </div>
        </div>
    `;
}


function renderAddLogForm(todoId) {

    return `
        <div class="wm-add-log-form">
            <input type="date" id="wmNewLogDate_${todoId}" value="${getToday()}">
            <input type="text" id="wmNewLogDesc_${todoId}" placeholder="What did you do?">
            <input type="number" id="wmNewLogMinutes_${todoId}" placeholder="Minutes" min="1">
            <div class="wm-inline-edit-actions">
                <button type="button" class="btn btn-primary" onclick="saveNewLog('${todoId}')">Save</button>
                <button type="button" class="btn btn-secondary" onclick="cancelAddLog()">Cancel</button>
            </div>
        </div>
    `;
}


function renderLogEditForm(log) {

    const suffix = log.task_log_id;

    return `
        <div class="wm-inline-edit-form wm-inline-edit-form-full" style="margin-left:34px;">

            <div class="wm-edit-field-row wm-edit-field-row-split">
                <div>
                    <label>Date</label>
                    <input type="date" id="wmEditLogDate_${suffix}" value="${log.task_date || ""}">
                </div>
                <div>
                    <label>Minutes</label>
                    <input type="number" id="wmEditLogMinutes_${suffix}" value="${log.minutes_spent || 0}" min="1">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Description</label>
                <input type="text" id="wmEditLogDesc_${suffix}" value="${(log.task_description || "").replace(/"/g, "&quot;")}">
            </div>

            <div class="wm-edit-field-row">
                <label>ToDo (move this log)</label>
                <div class="activity-picker-row">
                    <select id="wmEditLogTodo_${suffix}" onchange="wmLogTodoPickerChanged('${suffix}')"></select>
                    <input type="search" id="wmEditLogTodoSearch_${suffix}" placeholder="Filter ToDos..." onkeyup="wmFilterLogTodoPicker('${suffix}')">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Context</label>
                <div class="activity-context-box" id="wmEditLogTodoContext_${suffix}">—</div>
            </div>

            <div class="wm-inline-edit-actions">
                <button type="button" class="btn btn-primary" onclick="saveLogEdit('${suffix}')">Save</button>
                <button type="button" class="btn btn-secondary" onclick="cancelEditLog()">Cancel</button>
            </div>
        </div>
    `;
}


// ======================================================
// SELECT / COLLAPSE
// ======================================================

function selectMilestone(milestoneId) {

    wmSelectedMilestoneId =
        (wmSelectedMilestoneId === milestoneId) ? null : milestoneId;

    wmEditingTodoId = null;
    wmAddingLogForTodoId = null;
    wmEditingLogId = null;

    renderWorkMap();
}


// ======================================================
// MILESTONE EDIT
// ======================================================

function editMilestone(milestoneId) {

    const milestone =
        wmMilestones.find(m => m.milestone_id === milestoneId);

    if (!milestone) {
        return;
    }

    document.getElementById("wmModalMilestoneId").value = milestone.milestone_id;
    document.getElementById("wmModalStatus").value = milestone.status;
    document.getElementById("wmModalTargetDate").value = milestone.target_date || "";

    openModal("wmMilestoneModal");
}


async function saveMilestoneEdit() {

    const milestoneId = document.getElementById("wmModalMilestoneId").value;
    const status = document.getElementById("wmModalStatus").value;
    const targetDate = document.getElementById("wmModalTargetDate").value;

    try {

        await updateData("milestone", "milestone_id", milestoneId, {
            status: status,
            target_date: targetDate || null,
            updated_by: getCurrentUser()
        });

        closeModal("wmMilestoneModal");

        await refreshWorkMap();

        showSuccess("Milestone updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update milestone");
    }
}


// ======================================================
// TODO INLINE EDIT / DELETE
// ======================================================

function editTodoInline(todoId) {

    wmEditingTodoId = todoId;
    wmAddingLogForTodoId = null;
    wmEditingLogId = null;

    renderWorkMap();
}


function cancelEditTodo() {

    wmEditingTodoId = null;

    renderWorkMap();
}


async function saveTodoEdit(todoId) {

    const text = document.getElementById(`wmEditTodoText_${todoId}`).value.trim();
    const status = document.getElementById(`wmEditTodoStatus_${todoId}`).value;
    const dueDate = document.getElementById(`wmEditTodoDue_${todoId}`).value;
    const milestoneId = document.getElementById(`wmEditTodoMilestone_${todoId}`).value;
    const notes = document.getElementById(`wmEditTodoNotes_${todoId}`).value.trim();

    if (!text) {
        showError("ToDo text can't be empty");
        return;
    }

    try {

        await updateData("todo", "todo_id", todoId, {
            todo_text: text,
            status: status,
            due_date: dueDate || null,
            milestone_id: milestoneId || null,
            notes: notes || null,
            updated_by: getCurrentUser()
        });

        wmEditingTodoId = null;

        await refreshWorkMap();

        showSuccess("ToDo updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update ToDo");
    }
}


// ======================================================
// MILESTONE PICKER (inside ToDo edit form)
// Mirrors the picker pattern from the ToDo modal:
// dropdown + search filter + read-only context line.
// ======================================================

function populateOpenEditPickers() {

    if (wmEditingTodoId) {

        populateWmMilestonePicker(wmEditingTodoId, "");

        const todo = wmTodos.find(t => t.todo_id === wmEditingTodoId);

        if (todo) {

            const select = document.getElementById(`wmEditTodoMilestone_${wmEditingTodoId}`);

            if (select) {
                select.value = todo.milestone_id || "";
            }

            updateWmMilestoneContext(wmEditingTodoId, todo.milestone_id);
        }
    }

    if (wmEditingLogId) {

        populateWmLogTodoPicker(wmEditingLogId, "");

        const log = wmTaskLogs.find(l => l.task_log_id === wmEditingLogId);

        if (log) {

            const select = document.getElementById(`wmEditLogTodo_${wmEditingLogId}`);

            if (select) {
                select.value = log.todo_id || "";
            }

            updateWmLogTodoContext(wmEditingLogId, log.todo_id);
        }
    }
}


function populateWmMilestonePicker(suffix, searchText) {

    const select = document.getElementById(`wmEditTodoMilestone_${suffix}`);

    if (!select) {
        return;
    }

    const search = (searchText || "").toLowerCase();

    const filtered =
        wmMilestones.filter(m =>
            !search ||
            (m.milestone_name || "").toLowerCase().includes(search) ||
            (m.project_name || "").toLowerCase().includes(search) ||
            (m.portfolio_name || "").toLowerCase().includes(search)
        );

    const currentValue = select.value;

    select.innerHTML =
        `<option value="">⭐ Standalone / Unassigned Action</option>` +
        filtered
            .map(m => `<option value="${m.milestone_id}">${m.project_name ? m.project_name + " → " : ""}${m.milestone_name}</option>`)
            .join("");

    select.value = currentValue;
}


function wmFilterMilestonePicker(suffix) {

    const searchText =
        document.getElementById(`wmEditTodoMilestoneSearch_${suffix}`).value;

    populateWmMilestonePicker(suffix, searchText);
}


function wmMilestonePickerChanged(suffix) {

    const value =
        document.getElementById(`wmEditTodoMilestone_${suffix}`).value;

    updateWmMilestoneContext(suffix, value);
}


function updateWmMilestoneContext(suffix, milestoneId) {

    const box = document.getElementById(`wmEditTodoMilestoneContext_${suffix}`);

    if (!box) {
        return;
    }

    if (!milestoneId) {
        box.textContent = "Standalone Action";
        return;
    }

    const milestone =
        wmMilestones.find(m => m.milestone_id === milestoneId);

    box.textContent =
        milestone
            ? `${milestone.portfolio_name || ""} | ${milestone.project_name || ""} | ${milestone.milestone_name}`
            : "Standalone Action";
}


async function deleteTodoInline(todoId) {

    if (!confirmAction("Delete this ToDo? Any task logs against it will be kept but unlinked.")) {
        return;
    }

    try {

        await deleteData("todo", "todo_id", todoId);

        await refreshWorkMap();

        showSuccess("ToDo deleted");

    } catch (error) {

        console.error(error);
        showError("Unable to delete ToDo — make sure the task_log FK is set to ON DELETE SET NULL");
    }
}


// ======================================================
// TASK LOG INLINE ADD / DELETE
// ======================================================

function showAddLogForm(todoId) {

    wmAddingLogForTodoId = todoId;
    wmEditingTodoId = null;
    wmEditingLogId = null;

    renderWorkMap();
}


function cancelAddLog() {

    wmAddingLogForTodoId = null;

    renderWorkMap();
}


async function saveNewLog(todoId) {

    const date = document.getElementById(`wmNewLogDate_${todoId}`).value;
    const description = document.getElementById(`wmNewLogDesc_${todoId}`).value.trim();
    const minutes = parseInt(document.getElementById(`wmNewLogMinutes_${todoId}`).value, 10);

    if (!description || !minutes || minutes <= 0) {
        showError("Please add a description and minutes spent");
        return;
    }

    try {

        await insertData("task_log", {
            todo_id: todoId,
            task_date: date || getToday(),
            task_description: description,
            minutes_spent: minutes,
            created_by: getCurrentUser(),
            updated_by: getCurrentUser()
        });

        wmAddingLogForTodoId = null;

        await refreshWorkMap();

        showSuccess("Task log added");

    } catch (error) {

        console.error(error);
        showError("Unable to add task log");
    }
}


async function deleteLogInline(taskLogId) {

    if (!confirmAction("Delete this task log?")) {
        return;
    }

    try {

        await deleteData("task_log", "task_log_id", taskLogId);

        await refreshWorkMap();

        showSuccess("Task log deleted");

    } catch (error) {

        console.error(error);
        showError("Unable to delete task log");
    }
}


function editLogInline(taskLogId) {

    wmEditingLogId = taskLogId;
    wmEditingTodoId = null;
    wmAddingLogForTodoId = null;

    renderWorkMap();
}


function cancelEditLog() {

    wmEditingLogId = null;

    renderWorkMap();
}


async function saveLogEdit(taskLogId) {

    const date = document.getElementById(`wmEditLogDate_${taskLogId}`).value;
    const description = document.getElementById(`wmEditLogDesc_${taskLogId}`).value.trim();
    const minutes = parseInt(document.getElementById(`wmEditLogMinutes_${taskLogId}`).value, 10);
    const todoId = document.getElementById(`wmEditLogTodo_${taskLogId}`).value;

    if (!description || !minutes || minutes <= 0) {
        showError("Please add a description and minutes spent");
        return;
    }

    if (!todoId) {
        showError("A task log must be mapped to a ToDo");
        return;
    }

    try {

        await updateData("task_log", "task_log_id", taskLogId, {
            task_date: date || getToday(),
            task_description: description,
            minutes_spent: minutes,
            todo_id: todoId,
            updated_by: getCurrentUser()
        });

        wmEditingLogId = null;

        await refreshWorkMap();

        showSuccess("Task log updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update task log");
    }
}


// ======================================================
// TODO PICKER (inside Task Log edit form) — lets a log be
// reassigned to a different ToDo entirely, in case it was
// logged against the wrong one.
// ======================================================

function populateWmLogTodoPicker(suffix, searchText) {

    const select = document.getElementById(`wmEditLogTodo_${suffix}`);

    if (!select) {
        return;
    }

    const search = (searchText || "").toLowerCase();

    const filtered =
        wmTodos.filter(t =>
            !search ||
            (t.todo_text || "").toLowerCase().includes(search) ||
            (t.milestone_name || "").toLowerCase().includes(search)
        );

    const currentValue = select.value;

    select.innerHTML =
        filtered
            .map(t => `<option value="${t.todo_id}">${t.milestone_name ? t.milestone_name + " → " : "(No milestone) → "}${t.todo_text}</option>`)
            .join("");

    select.value = currentValue;
}


function wmFilterLogTodoPicker(suffix) {

    const searchText =
        document.getElementById(`wmEditLogTodoSearch_${suffix}`).value;

    populateWmLogTodoPicker(suffix, searchText);
}


function wmLogTodoPickerChanged(suffix) {

    const value =
        document.getElementById(`wmEditLogTodo_${suffix}`).value;

    updateWmLogTodoContext(suffix, value);
}


function updateWmLogTodoContext(suffix, todoId) {

    const box = document.getElementById(`wmEditLogTodoContext_${suffix}`);

    if (!box) {
        return;
    }

    const todo =
        wmTodos.find(t => t.todo_id === todoId);

    box.textContent =
        todo
            ? `${todo.portfolio_name || ""} | ${todo.project_name || ""} | ${todo.milestone_name || "No Milestone"} | ${todo.todo_text}`
            : "—";
}


// ======================================================
// UTIL
// ======================================================

function formatMinutesAsHours(minutes) {

    if (!minutes) {
        return "0h";
    }

    return `${(minutes / 60).toFixed(1)}h`;
}


function updateWorkMapSummary(total, critical) {

    document.getElementById("wmSummaryTotal").textContent =
        `${total} Milestone(s)`;

    document.getElementById("wmSummaryCritical").textContent =
        critical > 0
            ? `⚠️ ${critical} need attention`
            : `All caught up`;
}
