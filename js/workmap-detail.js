// AC v1.3 Pass 5 WORKMAP ENHANCEMENTS

// ======================================================
// Work Map — Detail Page
// Top strip: search + milestone picker (pills).
// Remaining height: full ToDo/Task Log tree for the
// selected milestone, fully expanded — a "thorough study"
// view, not a quick glance. Includes inline edit/delete
// for the milestone, its ToDos, and its task logs.
// ======================================================

let wmdMilestones = [];
let wmdTodos = [];
let wmdTaskLogs = [];

let wmdSelectedMilestoneId = null;
let wmdEditingTodoId = null;
let wmdAddingLogForTodoId = null;
let wmdEditingLogId = null;

const WMD_CLOSED_STATUSES = ["Completed", "Cancelled"];
const WMD_STANDALONE_ID = "__standalone__";
const WMD_UNLINKED_ID = "__unlinked__";
const WMD_FALLBACK_ACTIVITY_ID = "00000000-0000-0000-0000-000000000000";


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateDetailMilestoneStatusOptions();

        await loadWorkMapDetailData();

        const urlParams = new URLSearchParams(window.location.search);
        const preselect = urlParams.get("milestone_id");
        const preselectTodoId = urlParams.get("todo_id");

        renderMilestonePills();

        if (preselect) {
            selectDetailMilestone(preselect);
        }

        if (preselectTodoId) {
            highlightTodoRow(preselectTodoId);
        }
    }
);


function populateDetailMilestoneStatusOptions() {

    const select = document.getElementById("wmdModalStatus");

    select.innerHTML =
        MASTERS.MILESTONE_STATUS
            .map(s => `<option value="${s}">${s}</option>`)
            .join("");
}


function isDetailMilestoneClosed(status) {

    return WMD_CLOSED_STATUSES.includes(status);
}


// ======================================================
// DATA LOADING (all-time, same rationale as workmap.js)
// ======================================================

async function loadWorkMapDetailData() {

    wmdMilestones =
        await getData(
            "vw_milestone_details?enabled=eq.true&order=target_date.desc"
        );

    if (!Array.isArray(wmdMilestones)) {
        wmdMilestones = [];
    }

    wmdTodos = await getData("vw_todo");

    if (!Array.isArray(wmdTodos)) {
        wmdTodos = [];
    }

    wmdTaskLogs =
        await getData("vw_task_log_details");

    if (!Array.isArray(wmdTaskLogs)) {
        wmdTaskLogs = [];
    }
}


async function refreshWorkMapDetail() {

    await loadWorkMapDetailData();

    renderMilestonePills();

    if (wmdSelectedMilestoneId) {
        renderDetailArea();
    }
}


function getTodosForMilestoneIdDetail(milestoneId) {

    if (milestoneId === WMD_STANDALONE_ID) {
        return wmdTodos.filter(t => !t.milestone_id);
    }

    return wmdTodos.filter(t => t.milestone_id === milestoneId);
}


function getDetailMilestoneStats(milestoneId) {

    const todosForMilestone = getTodosForMilestoneIdDetail(milestoneId);

    let loggedCount = 0;
    let pendingCount = 0;
    let totalMinutes = 0;

    todosForMilestone.forEach(todo => {

        const logs =
            wmdTaskLogs.filter(l => l.todo_id === todo.todo_id);

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


function getDetailDaysRemaining(targetDate) {

    if (!targetDate) {
        return null;
    }

    const today = new Date();
    const target = new Date(targetDate);

    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}


function getDetailNearestDateInfo(milestone, todosForMilestone) {

    const candidates = [];

    if (milestone.target_date) {
        candidates.push({ date: milestone.target_date, source: "milestone" });
    }

    todosForMilestone
        .filter(t =>
            t.due_date &&
            t.status !== "Completed" &&
            t.status !== "Cancelled"
        )
        .forEach(t => {
            candidates.push({ date: t.due_date, source: "todo", text: t.todo_text });
        });

    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => a.date.localeCompare(b.date));

    const nearest = candidates[0];

    return { ...nearest, daysRemaining: getDetailDaysRemaining(nearest.date) };
}


function getDetailHeatTier(daysRemaining) {

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
// TOP SELECTOR BAR
// ======================================================

function renderMilestonePills() {

    const container = document.getElementById("wmdMilestonePills");

    const searchText =
        (document.getElementById("wmdSearchBox").value || "")
            .toLowerCase()
            .trim();

    const visible =
        wmdMilestones.filter(m =>
            !searchText ||
            (m.milestone_name || "").toLowerCase().includes(searchText)
        );

    const standaloneTodos = wmdTodos.filter(t => !t.milestone_id);

    const standaloneMatchesSearch =
        !searchText ||
        "standalone".includes(searchText) ||
        "unassigned".includes(searchText) ||
        standaloneTodos.some(t => (t.todo_text || "").toLowerCase().includes(searchText));

    const milestoneList = visible.slice();

    if (standaloneTodos.length > 0 && standaloneMatchesSearch) {

        milestoneList.push({
            milestone_id: WMD_STANDALONE_ID,
            milestone_name: "Standalone ToDos",
            project_name: "Not tied to any milestone",
            portfolio_name: "",
            status: "Open",
            target_date: null
        });
    }

    const unlinkedLogs = wmdTaskLogs.filter(l => !l.todo_id);

    const unlinkedMatchesSearch =
        !searchText ||
        "unlinked".includes(searchText) ||
        unlinkedLogs.some(l => (l.task_description || "").toLowerCase().includes(searchText));

    const showUnlinkedPill = unlinkedLogs.length > 0 && unlinkedMatchesSearch;

    if (milestoneList.length === 0 && !showUnlinkedPill) {
        container.innerHTML = `<span class="wmd-placeholder" style="height:auto;">No milestones match.</span>`;
        return;
    }

    const withInfo =
        milestoneList.map(m => {

            const todosForMilestone = getTodosForMilestoneIdDetail(m.milestone_id);

            const stats = getDetailMilestoneStats(m.milestone_id);
            const nearest = getDetailNearestDateInfo(m, todosForMilestone);

            return { milestone: m, stats, nearest };
        });

    // Open milestones first (sorted by urgency), closed ones always last.
    withInfo.sort((a, b) => {

        const closedA = isDetailMilestoneClosed(a.milestone.status) ? 1 : 0;
        const closedB = isDetailMilestoneClosed(b.milestone.status) ? 1 : 0;

        if (closedA !== closedB) {
            return closedA - closedB;
        }

        const daysA = a.nearest ? a.nearest.daysRemaining : Infinity;
        const daysB = b.nearest ? b.nearest.daysRemaining : Infinity;

        return daysA - daysB;
    });

    container.innerHTML =
        withInfo
            .map(({ milestone: m, stats, nearest }) => {

                const closed = isDetailMilestoneClosed(m.status);
                const isStandalone = (m.milestone_id === WMD_STANDALONE_ID);

                const activeClass =
                    (m.milestone_id === wmdSelectedMilestoneId) ? "active" : "";

                const criticalClass =
                    (stats.isCritical && !closed) ? "wmd-pill-critical" : "";

                const heatTier = (closed || isStandalone) ? "neutral" : getDetailHeatTier(nearest ? nearest.daysRemaining : null);

                const heatClass =
                    heatTier !== "neutral" ? `wmd-heat-${heatTier}` : "";

                return `
                    <button type="button"
                        class="wmd-pill ${activeClass} ${criticalClass} ${heatClass}"
                        onclick="selectDetailMilestone('${m.milestone_id}')">
                        ${(stats.isCritical && !closed) ? "⚠️ " : ""}${isStandalone ? "📎 " : ""}${m.milestone_name}
                    </button>
                `;
            })
            .join("");

    if (showUnlinkedPill) {

        const activeClass =
            (wmdSelectedMilestoneId === WMD_UNLINKED_ID) ? "active" : "";

        container.innerHTML += `
            <button type="button"
                class="wmd-pill ${activeClass}"
                onclick="selectDetailMilestone('${WMD_UNLINKED_ID}')">
                📎 Unlinked Task Logs
            </button>
        `;
    }
}


function selectDetailMilestone(milestoneId) {

    wmdSelectedMilestoneId = milestoneId;
    wmdEditingTodoId = null;
    wmdAddingLogForTodoId = null;
    wmdEditingLogId = null;

    renderMilestonePills();

    renderDetailArea();
}


function highlightTodoRow(todoId) {

    // renderDetailArea() runs synchronously above, so the row should
    // already be in the DOM — but give the browser one paint cycle
    // before scrolling, so scrollIntoView measures the final layout.
    setTimeout(() => {

        const row =
            document.getElementById(`wmdTodoRow_${todoId}`);

        if (!row) {
            return;
        }

        row.scrollIntoView({ behavior: "smooth", block: "center" });

        row.classList.add("wm-todo-row-highlighted");

        setTimeout(() => {
            row.classList.remove("wm-todo-row-highlighted");
        }, 2500);

    }, 50);
}


// ======================================================
// MAIN DETAIL AREA — full tree, fully expanded
// ======================================================

function renderDetailArea() {

    const area = document.getElementById("wmdDetailArea");

    if (wmdSelectedMilestoneId === WMD_UNLINKED_ID) {
        renderUnlinkedDetailArea(area);
        return;
    }

    let milestone =
        wmdMilestones.find(m => m.milestone_id === wmdSelectedMilestoneId);

    if (!milestone && wmdSelectedMilestoneId === WMD_STANDALONE_ID) {

        milestone = {
            milestone_id: WMD_STANDALONE_ID,
            milestone_name: "Standalone ToDos",
            project_name: "Not tied to any milestone",
            portfolio_name: "",
            status: "Open",
            target_date: null
        };
    }

    if (!milestone) {
        area.innerHTML = `<div class="wmd-placeholder">Select a milestone above to study it in detail.</div>`;
        return;
    }

    const stats = getDetailMilestoneStats(milestone.milestone_id);

    const todosForMilestone = getTodosForMilestoneIdDetail(milestone.milestone_id);

    const nearest = getDetailNearestDateInfo(milestone, todosForMilestone);

    const daysRemaining = nearest ? nearest.daysRemaining : null;

    const daysLabel =
        daysRemaining === null
            ? "No target date"
            : daysRemaining < 0
                ? `${Math.abs(daysRemaining)}d overdue`
                : `${daysRemaining}d left`;

    const nearestNote =
        nearest && nearest.source === "todo"
            ? ` &nbsp;|&nbsp; 📌 Nearest ToDo due ${formatDate(nearest.date)}: "${nearest.text}"`
            : "";

    const isStandalone = (milestone.milestone_id === WMD_STANDALONE_ID);

    const todos =
        getTodosForMilestoneIdDetail(milestone.milestone_id)
            .slice()
            .sort((a, b) => {

                const dateA = a.due_date || "9999-12-31";
                const dateB = b.due_date || "9999-12-31";

                return dateA.localeCompare(dateB);
            });

    const todoTreeHtml =
        todos.length === 0
            ? `<div class="wb-empty-state">No ToDos under this milestone yet.</div>`
            : todos.map(todo => renderDetailTodoBlock(todo)).join("");

    area.innerHTML = `

        <div class="wmd-detail-header">

            <div>
                <div class="wmd-detail-name">
                    ${milestone.milestone_name}
                    ${isStandalone ? "" : `<button type="button" class="wmd-edit-icon" title="Edit milestone" onclick="editDetailMilestone('${milestone.milestone_id}')">✏️</button>`}
                </div>
                <div class="wmd-detail-context">
                    ${milestone.project_name || ""}${milestone.portfolio_name ? " · " + milestone.portfolio_name : ""}
                    &nbsp;|&nbsp; ${isStandalone ? `<span class="badge-pill badge-status-not-started">Standalone</span>` : statusBadgeHtml(milestone.status)}
                    ${isStandalone ? "" : `&nbsp;|&nbsp; 📅 ${formatDate(milestone.target_date) || "—"} (${daysLabel})`}${nearestNote}
                </div>
            </div>

            <div class="wmd-detail-stats">
                <div class="wmd-detail-stat">
                    <div class="wmd-detail-stat-value">${stats.todoCount}</div>
                    <div class="wmd-detail-stat-label">ToDos</div>
                </div>
                <div class="wmd-detail-stat">
                    <div class="wmd-detail-stat-value" style="color: var(--success);">${stats.loggedCount}</div>
                    <div class="wmd-detail-stat-label">Logged</div>
                </div>
                <div class="wmd-detail-stat">
                    <div class="wmd-detail-stat-value" style="color: ${stats.pendingCount > 0 ? "var(--danger-strong)" : "var(--text-faint)"};">${stats.pendingCount}</div>
                    <div class="wmd-detail-stat-label">Pending</div>
                </div>
                <div class="wmd-detail-stat">
                    <div class="wmd-detail-stat-value">${formatMinutesAsHoursDetail(stats.totalMinutes)}</div>
                    <div class="wmd-detail-stat-label">Total Logged</div>
                </div>
            </div>

        </div>

        <div class="wb-tree-container">
            ${todoTreeHtml}
        </div>
    `;

    populateDetailOpenEditPickers();
}


function renderUnlinkedDetailArea(area) {

    const unlinkedLogs = wmdTaskLogs.filter(l => !l.todo_id);

    const totalMinutes = unlinkedLogs.reduce((sum, l) => sum + (l.minutes_spent || 0), 0);

    const sorted =
        unlinkedLogs.slice().sort((a, b) => {

                const dateCompare = (b.task_date || "").localeCompare(a.task_date || "");
                if (dateCompare !== 0) return dateCompare;

                if (!a.start_time && !b.start_time) return 0;
                if (!a.start_time) return 1;
                if (!b.start_time) return -1;

                return b.start_time.localeCompare(a.start_time);
            });

    const logsHtml =
        sorted.length === 0
            ? `<div class="wb-empty-state">No unlinked task logs.</div>`
            : sorted.map(log => renderDetailLogRow(log)).join("");

    const isAddingHere = (wmdAddingLogForTodoId === WMD_UNLINKED_ID);

    const addLogSection =
        isAddingHere
            ? renderDetailAddLogForm(WMD_UNLINKED_ID)
            : `<button type="button" class="wm-add-log-btn" onclick="showDetailAddLogForm('${WMD_UNLINKED_ID}')">+ Add Task Log</button>`;

    area.innerHTML = `

        <div class="wmd-detail-header">

            <div>
                <div class="wmd-detail-name">📎 Unlinked Task Logs</div>
                <div class="wmd-detail-context">
                    Not tied to any ToDo &nbsp;|&nbsp; <span class="badge-pill badge-status-not-started">Housekeeping</span>
                </div>
            </div>

            <div class="wmd-detail-stats">
                <div class="wmd-detail-stat">
                    <div class="wmd-detail-stat-value">${unlinkedLogs.length}</div>
                    <div class="wmd-detail-stat-label">Unlinked Logs</div>
                </div>
                <div class="wmd-detail-stat">
                    <div class="wmd-detail-stat-value">${formatMinutesAsHoursDetail(totalMinutes)}</div>
                    <div class="wmd-detail-stat-label">Total Logged</div>
                </div>
            </div>

        </div>

        <div class="wb-tree-container">
            ${logsHtml}
            ${addLogSection}
        </div>
    `;

    populateDetailOpenEditPickers();
}


function renderDetailTodoBlock(todo) {

    const logs =
        wmdTaskLogs
            .filter(l => l.todo_id === todo.todo_id)
            .slice()
            .sort((a, b) => {

                const dateCompare = (b.task_date || "").localeCompare(a.task_date || "");
                if (dateCompare !== 0) return dateCompare;

                if (!a.start_time && !b.start_time) return 0;
                if (!a.start_time) return 1;
                if (!b.start_time) return -1;

                return b.start_time.localeCompare(a.start_time);
            });

    const todoMinutes =
        logs.reduce((sum, l) => sum + (l.minutes_spent || 0), 0);

    const flagClass =
        logs.length === 0 &&
        (todo.status === "Open" || todo.status === "In Progress")
            ? "wm-todo-row-flagged"
            : "";

    const isEditingThisTodo = (wmdEditingTodoId === todo.todo_id);
    const isAddingLogHere = (wmdAddingLogForTodoId === todo.todo_id);

    const headerHtml = `
        <div class="wb-todo-header" style="cursor:default;">
            <div class="wb-todo-text">${todo.todo_text}</div>
            ${statusBadgeHtml(todo.status)}
            <div class="wb-todo-stats">
                <span>${logs.length} log(s)</span>
                <span>${formatMinutesAsHoursDetail(todoMinutes)}</span>
            </div>
            <div class="wm-row-actions">
                <button type="button" class="wm-icon-btn" title="Edit ToDo" onclick="editDetailTodoInline('${todo.todo_id}')">✏️</button>
                <button type="button" class="wm-icon-btn wm-icon-btn-danger" title="Delete ToDo" onclick="deleteDetailTodoInline('${todo.todo_id}')">🗑️</button>
            </div>
        </div>
    `;

    const editPanelHtml =
        isEditingThisTodo
            ? renderDetailTodoEditForm(todo)
            : "";

    const logsHtml =
        logs
            .map(log => renderDetailLogRow(log))
            .join("");

    const addLogSection =
        isAddingLogHere
            ? renderDetailAddLogForm(todo.todo_id)
            : `<button type="button" class="wm-add-log-btn" onclick="showDetailAddLogForm('${todo.todo_id}')">+ Add Task Log</button>`;

    return `
        <div class="wb-todo-row ${flagClass}" id="wmdTodoRow_${todo.todo_id}" style="margin-left:0;">
            ${headerHtml}
            ${editPanelHtml}
            <div class="wb-todo-body" style="display:block;">
                ${logs.length > 0 ? logsHtml : `<div class="wb-empty-state wb-empty-state-small">Not started — no task logs yet.</div>`}
                ${addLogSection}
            </div>
        </div>
    `;
}


function renderDetailLogRow(log) {

    if (wmdEditingLogId === log.task_log_id) {
        return renderDetailLogEditForm(log);
    }

    const durationHtml =
        (log.start_time && log.end_time)
            ? `${formatMinutesAsHoursDetail(log.minutes_spent || 0)}<br><small style="font-weight:600; color:var(--text-muted);">[ ${formatTime(log.start_time)} - ${formatTime(log.end_time)} ]</small>`
            : formatMinutesAsHoursDetail(log.minutes_spent || 0);

    return `
        <div class="wb-task-log-row">
            <div class="wb-task-log-date">${formatDate(log.task_date)}</div>
            <div class="wb-task-log-desc">${log.task_description || ""}</div>
            <div class="wb-task-log-minutes">${durationHtml}</div>
            <div class="wm-row-actions">
                <button type="button" class="wm-icon-btn" title="Edit log" onclick="editDetailLogInline('${log.task_log_id}')">✏️</button>
                <button type="button" class="wm-icon-btn wm-icon-btn-danger" title="Delete log" onclick="deleteDetailLogInline('${log.task_log_id}')">🗑️</button>
            </div>
        </div>
    `;
}


function renderDetailTodoEditForm(todo) {

    const suffix = todo.todo_id;

    return `
        <div class="wm-inline-edit-form wm-inline-edit-form-full">

            <div class="wm-edit-field-row">
                <label>ToDo</label>
                <input type="text" id="wmdEditTodoText_${suffix}" value="${(todo.todo_text || "").replace(/"/g, "&quot;")}" maxlength="200">
            </div>

            <div class="wm-edit-field-row wm-edit-field-row-split">
                <div>
                    <label>Status</label>
                    <select id="wmdEditTodoStatus_${suffix}">
                        <option value="Open" ${todo.status === "Open" ? "selected" : ""}>Open</option>
                        <option value="In Progress" ${todo.status === "In Progress" ? "selected" : ""}>In Progress</option>
                        <option value="Completed" ${todo.status === "Completed" ? "selected" : ""}>Completed</option>
                        <option value="Cancelled" ${todo.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                    </select>
                </div>
                <div>
                    <label>Due Date</label>
                    <input type="date" id="wmdEditTodoDue_${suffix}" value="${todo.due_date || ""}">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Milestone</label>
                <div class="activity-picker-row">
                    <select id="wmdEditTodoMilestone_${suffix}" onchange="wmdMilestonePickerChanged('${suffix}')"></select>
                    <input type="search" id="wmdEditTodoMilestoneSearch_${suffix}" placeholder="Filter milestones..." onkeyup="wmdFilterMilestonePicker('${suffix}')">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Context</label>
                <div class="activity-context-box" id="wmdEditTodoMilestoneContext_${suffix}">Standalone Action</div>
            </div>

            <div class="wm-edit-field-row">
                <label>Notes</label>
                <textarea id="wmdEditTodoNotes_${suffix}" rows="2">${todo.notes || ""}</textarea>
            </div>

            <div class="wm-inline-edit-actions">
                <button type="button" class="btn btn-primary" onclick="saveDetailTodoEdit('${suffix}')">Save</button>
                <button type="button" class="btn btn-secondary" onclick="cancelDetailEditTodo()">Cancel</button>
            </div>
        </div>
    `;
}


function renderDetailAddLogForm(todoId) {

    return `
        <div class="wm-add-log-form">
            <input type="date" id="wmdNewLogDate_${todoId}" value="${getToday()}">
            <input type="text" id="wmdNewLogDesc_${todoId}" placeholder="What did you do?">
            <input type="time" id="wmdNewLogStart_${todoId}" onchange="wmdCalcNewLogTime('${todoId}')" title="Start time">
            <input type="number" id="wmdNewLogMinutes_${todoId}" placeholder="Minutes" min="1" onchange="wmdCalcNewLogTime('${todoId}')">
            <input type="time" id="wmdNewLogEnd_${todoId}" onchange="wmdCalcNewLogTime('${todoId}')" title="End time">
            <div class="wm-inline-edit-actions">
                <button type="button" class="btn btn-primary" onclick="saveDetailNewLog('${todoId}')">Save</button>
                <button type="button" class="btn btn-secondary" onclick="cancelDetailAddLog()">Cancel</button>
            </div>
        </div>
    `;
}


function renderDetailLogEditForm(log) {

    const suffix = log.task_log_id;

    return `
        <div class="wm-inline-edit-form wm-inline-edit-form-full" style="margin-left:34px;">

            <div class="wm-edit-field-row wm-edit-field-row-split">
                <div>
                    <label>Date</label>
                    <input type="date" id="wmdEditLogDate_${suffix}" value="${log.task_date || ""}">
                </div>
                <div>
                    <label>Minutes</label>
                    <input type="number" id="wmdEditLogMinutes_${suffix}" value="${log.minutes_spent || 0}" min="1" onchange="wmdCalcEditLogTime('${suffix}')">
                </div>
            </div>

            <div class="wm-edit-field-row wm-edit-field-row-split">
                <div>
                    <label>Start</label>
                    <input type="time" id="wmdEditLogStart_${suffix}" value="${log.start_time || ""}" onchange="wmdCalcEditLogTime('${suffix}')">
                </div>
                <div>
                    <label>End</label>
                    <input type="time" id="wmdEditLogEnd_${suffix}" value="${log.end_time || ""}" onchange="wmdCalcEditLogTime('${suffix}')">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Description</label>
                <input type="text" id="wmdEditLogDesc_${suffix}" value="${(log.task_description || "").replace(/"/g, "&quot;")}">
            </div>

            <div class="wm-edit-field-row">
                <label>ToDo (move this log)</label>
                <div class="activity-picker-row">
                    <select id="wmdEditLogTodo_${suffix}" onchange="wmdLogTodoPickerChanged('${suffix}')"></select>
                    <input type="search" id="wmdEditLogTodoSearch_${suffix}" placeholder="Filter ToDos..." onkeyup="wmdFilterLogTodoPicker('${suffix}')">
                </div>
            </div>

            <div class="wm-edit-field-row">
                <label>Context</label>
                <div class="activity-context-box" id="wmdEditLogTodoContext_${suffix}">—</div>
            </div>

            <div class="wm-inline-edit-actions">
                <button type="button" class="btn btn-primary" onclick="saveDetailLogEdit('${suffix}')">Save</button>
                <button type="button" class="btn btn-secondary" onclick="cancelDetailEditLog()">Cancel</button>
            </div>
        </div>
    `;
}


// ======================================================
// MILESTONE EDIT
// ======================================================

function editDetailMilestone(milestoneId) {

    const milestone =
        wmdMilestones.find(m => m.milestone_id === milestoneId);

    if (!milestone) {
        return;
    }

    document.getElementById("wmdModalMilestoneId").value = milestone.milestone_id;
    document.getElementById("wmdModalStatus").value = milestone.status;
    document.getElementById("wmdModalTargetDate").value = milestone.target_date || "";

    openModal("wmdMilestoneModal");
}


async function saveDetailMilestoneEdit() {

    const milestoneId = document.getElementById("wmdModalMilestoneId").value;
    const status = document.getElementById("wmdModalStatus").value;
    const targetDate = document.getElementById("wmdModalTargetDate").value;

    try {

        await updateData("milestone", "milestone_id", milestoneId, {
            status: status,
            target_date: targetDate || null,
            updated_by: getCurrentUser()
        });

        closeModal("wmdMilestoneModal");

        await refreshWorkMapDetail();

        showSuccess("Milestone updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update milestone");
    }
}


// ======================================================
// TODO INLINE EDIT / DELETE
// ======================================================

function editDetailTodoInline(todoId) {

    wmdEditingTodoId = todoId;
    wmdAddingLogForTodoId = null;
    wmdEditingLogId = null;

    renderDetailArea();
}


function cancelDetailEditTodo() {

    wmdEditingTodoId = null;

    renderDetailArea();
}


async function saveDetailTodoEdit(todoId) {

    const text = document.getElementById(`wmdEditTodoText_${todoId}`).value.trim();
    const status = document.getElementById(`wmdEditTodoStatus_${todoId}`).value;
    const dueDate = document.getElementById(`wmdEditTodoDue_${todoId}`).value;
    const milestoneId = document.getElementById(`wmdEditTodoMilestone_${todoId}`).value;
    const notes = document.getElementById(`wmdEditTodoNotes_${todoId}`).value.trim();

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

        wmdEditingTodoId = null;

        await refreshWorkMapDetail();

        showSuccess("ToDo updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update ToDo");
    }
}


// ======================================================
// MILESTONE PICKER (inside ToDo edit form)
// ======================================================

function populateDetailOpenEditPickers() {

    if (wmdEditingTodoId) {

        populateWmdMilestonePicker(wmdEditingTodoId, "");

        const todo = wmdTodos.find(t => t.todo_id === wmdEditingTodoId);

        if (todo) {

            const select = document.getElementById(`wmdEditTodoMilestone_${wmdEditingTodoId}`);

            if (select) {
                select.value = todo.milestone_id || "";
            }

            updateWmdMilestoneContext(wmdEditingTodoId, todo.milestone_id);
        }
    }

    if (wmdEditingLogId) {

        populateWmdLogTodoPicker(wmdEditingLogId, "");

        const log = wmdTaskLogs.find(l => l.task_log_id === wmdEditingLogId);

        if (log) {

            const select = document.getElementById(`wmdEditLogTodo_${wmdEditingLogId}`);

            if (select) {
                select.value = log.todo_id || "";
            }

            updateWmdLogTodoContext(wmdEditingLogId, log.todo_id);
        }
    }
}


function populateWmdMilestonePicker(suffix, searchText) {

    const select = document.getElementById(`wmdEditTodoMilestone_${suffix}`);

    if (!select) {
        return;
    }

    const search = (searchText || "").toLowerCase();

    const filtered =
        wmdMilestones.filter(m =>
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


function wmdFilterMilestonePicker(suffix) {

    const searchText =
        document.getElementById(`wmdEditTodoMilestoneSearch_${suffix}`).value;

    populateWmdMilestonePicker(suffix, searchText);
}


function wmdMilestonePickerChanged(suffix) {

    const value =
        document.getElementById(`wmdEditTodoMilestone_${suffix}`).value;

    updateWmdMilestoneContext(suffix, value);
}


function updateWmdMilestoneContext(suffix, milestoneId) {

    const box = document.getElementById(`wmdEditTodoMilestoneContext_${suffix}`);

    if (!box) {
        return;
    }

    if (!milestoneId) {
        box.textContent = "Standalone Action";
        return;
    }

    const milestone =
        wmdMilestones.find(m => m.milestone_id === milestoneId);

    box.textContent =
        milestone
            ? `${milestone.portfolio_name || ""} | ${milestone.project_name || ""} | ${milestone.milestone_name}`
            : "Standalone Action";
}


async function deleteDetailTodoInline(todoId) {

    if (!confirmAction("Delete this ToDo? Any task logs against it will be kept but unlinked.")) {
        return;
    }

    try {

        await deleteData("todo", "todo_id", todoId);

        await refreshWorkMapDetail();

        showSuccess("ToDo deleted");

    } catch (error) {

        console.error(error);
        showError("Unable to delete ToDo — make sure the task_log FK is set to ON DELETE SET NULL");
    }
}


// ======================================================
// TASK LOG INLINE ADD / DELETE
// ======================================================

function showDetailAddLogForm(todoId) {

    wmdAddingLogForTodoId = todoId;
    wmdEditingTodoId = null;
    wmdEditingLogId = null;

    renderDetailArea();
}


function cancelDetailAddLog() {

    wmdAddingLogForTodoId = null;

    renderDetailArea();
}


async function saveDetailNewLog(todoId) {

    const date = document.getElementById(`wmdNewLogDate_${todoId}`).value;
    const description = document.getElementById(`wmdNewLogDesc_${todoId}`).value.trim();
    const minutes = parseInt(document.getElementById(`wmdNewLogMinutes_${todoId}`).value, 10);
    const startTime = document.getElementById(`wmdNewLogStart_${todoId}`).value || null;
    const endTime = document.getElementById(`wmdNewLogEnd_${todoId}`).value || null;

    // The Unlinked bucket reuses this same form with a sentinel "todoId" —
    // that's a DOM-id suffix only, not a real ToDo, so it saves as null.
    const realTodoId = (todoId === WMD_UNLINKED_ID) ? null : todoId;

    if (!description || !minutes || minutes <= 0) {
        showError("Please add a description and minutes spent");
        return;
    }

    try {

        await insertData("task_log", {
            todo_id: realTodoId,
            activity_id: realTodoId || WMD_FALLBACK_ACTIVITY_ID,
            task_date: date || getToday(),
            task_description: description,
            minutes_spent: minutes,
            start_time: startTime,
            end_time: endTime,
            created_by: getCurrentUser(),
            updated_by: getCurrentUser()
        });

        wmdAddingLogForTodoId = null;

        await refreshWorkMapDetail();

        showSuccess("Task log added");

    } catch (error) {

        console.error(error);
        showError("Unable to add task log");
    }
}


async function deleteDetailLogInline(taskLogId) {

    if (!confirmAction("Delete this task log?")) {
        return;
    }

    try {

        await deleteData("task_log", "task_log_id", taskLogId);

        await refreshWorkMapDetail();

        showSuccess("Task log deleted");

    } catch (error) {

        console.error(error);
        showError("Unable to delete task log");
    }
}


function editDetailLogInline(taskLogId) {

    wmdEditingLogId = taskLogId;
    wmdEditingTodoId = null;
    wmdAddingLogForTodoId = null;

    renderDetailArea();
}


function cancelDetailEditLog() {

    wmdEditingLogId = null;

    renderDetailArea();
}


async function saveDetailLogEdit(taskLogId) {

    const date = document.getElementById(`wmdEditLogDate_${taskLogId}`).value;
    const description = document.getElementById(`wmdEditLogDesc_${taskLogId}`).value.trim();
    const minutes = parseInt(document.getElementById(`wmdEditLogMinutes_${taskLogId}`).value, 10);
    const todoId = document.getElementById(`wmdEditLogTodo_${taskLogId}`).value || null;
    const startTime = document.getElementById(`wmdEditLogStart_${taskLogId}`).value || null;
    const endTime = document.getElementById(`wmdEditLogEnd_${taskLogId}`).value || null;

    if (!description || !minutes || minutes <= 0) {
        showError("Please add a description and minutes spent");
        return;
    }

    try {

        await updateData("task_log", "task_log_id", taskLogId, {
            task_date: date || getToday(),
            task_description: description,
            minutes_spent: minutes,
            todo_id: todoId,
            activity_id: todoId || WMD_FALLBACK_ACTIVITY_ID,
            start_time: startTime,
            end_time: endTime,
            updated_by: getCurrentUser()
        });

        wmdEditingLogId = null;

        await refreshWorkMapDetail();

        showSuccess("Task log updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update task log");
    }
}


// ======================================================
// TODO PICKER (inside Task Log edit form)
// ======================================================

function populateWmdLogTodoPicker(suffix, searchText) {

    const select = document.getElementById(`wmdEditLogTodo_${suffix}`);

    if (!select) {
        return;
    }

    const search = (searchText || "").toLowerCase();

    const filtered =
        wmdTodos.filter(t =>
            !search ||
            (t.todo_text || "").toLowerCase().includes(search) ||
            (t.milestone_name || "").toLowerCase().includes(search)
        );

    const currentValue = select.value;

    select.innerHTML =
        `<option value="">⭐ General / Standalone Task (No ToDo Link)</option>` +
        filtered
            .map(t => `<option value="${t.todo_id}">${t.milestone_name ? t.milestone_name + " → " : "(No milestone) → "}${t.todo_text}</option>`)
            .join("");

    select.value = currentValue;
}


function wmdFilterLogTodoPicker(suffix) {

    const searchText =
        document.getElementById(`wmdEditLogTodoSearch_${suffix}`).value;

    populateWmdLogTodoPicker(suffix, searchText);
}


function wmdLogTodoPickerChanged(suffix) {

    const value =
        document.getElementById(`wmdEditLogTodo_${suffix}`).value;

    updateWmdLogTodoContext(suffix, value);
}


function updateWmdLogTodoContext(suffix, todoId) {

    const box = document.getElementById(`wmdEditLogTodoContext_${suffix}`);

    if (!box) {
        return;
    }

    const todo =
        wmdTodos.find(t => t.todo_id === todoId);

    box.textContent =
        todo
            ? `${todo.portfolio_name || ""} | ${todo.project_name || ""} | ${todo.milestone_name || "No Milestone"} | ${todo.todo_text}`
            : "Standalone Entry";
}


// ======================================================
// TIME FIELD AUTO-CALC — mirrors Task Log page exactly.
// ======================================================

function wmdApplyTimeCalc(startEl, endEl, minutesEl) {

    if (!startEl || !endEl || !minutesEl) {
        return;
    }

    const start = startEl.value;
    const end = endEl.value;
    const minutes = parseInt(minutesEl.value || 0);

    if (start && end) {

        minutesEl.value = Math.round(
            (new Date(`2000-01-01T${end}`) - new Date(`2000-01-01T${start}`)) / 60000
        );

        return;
    }

    if (start && minutes > 0 && !end) {

        const d = new Date(`2000-01-01T${start}`);
        d.setMinutes(d.getMinutes() + minutes);
        endEl.value = d.toTimeString().substring(0, 5);

        return;
    }

    if (end && minutes > 0 && !start) {

        const d = new Date(`2000-01-01T${end}`);
        d.setMinutes(d.getMinutes() - minutes);
        startEl.value = d.toTimeString().substring(0, 5);
    }
}


function wmdCalcNewLogTime(todoId) {

    wmdApplyTimeCalc(
        document.getElementById(`wmdNewLogStart_${todoId}`),
        document.getElementById(`wmdNewLogEnd_${todoId}`),
        document.getElementById(`wmdNewLogMinutes_${todoId}`)
    );
}


function wmdCalcEditLogTime(logId) {

    wmdApplyTimeCalc(
        document.getElementById(`wmdEditLogStart_${logId}`),
        document.getElementById(`wmdEditLogEnd_${logId}`),
        document.getElementById(`wmdEditLogMinutes_${logId}`)
    );
}


function formatMinutesAsHoursDetail(minutes) {

    if (!minutes) {
        return "0h";
    }

    return `${(minutes / 60).toFixed(1)}h`;
}
