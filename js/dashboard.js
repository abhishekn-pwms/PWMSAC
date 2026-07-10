// AC v1.6 - TODO NOTES

let dashboardMilestones = [];
let dashboardTodos = [];

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        await requireAuthentication();
        await initializeLayout();
        await refreshFocusDashboard();
    }
);

async function refreshFocusDashboard() {
    try {
        await Promise.all([
            loadDashboardMilestones(),
            loadDashboardTodos(),
            loadDashboardPerformanceCounters()
        ]);
    } catch (error) {
        console.error("Dashboard engine synchronization error:", error);
        showError("Unable to refresh dashboard focus tracks.");
    }
}



// 1. Fetch & Map Strategic Runway (Active Milestones)
async function loadDashboardMilestones() {
    const data = await getData("vw_milestone_details?enabled=eq.true&order=target_date.asc");
    dashboardMilestones = Array.isArray(data) ? data.filter(m => m.status !== "Completed" && m.status !== "Cancelled") : [];
    
    const container = document.getElementById("milestoneRunway");
    document.getElementById("countMilestones").textContent = dashboardMilestones.length;
    document.getElementById("summaryMilestones").textContent = dashboardMilestones.length;
    container.innerHTML = "";

    if (dashboardMilestones.length === 0) {
        container.innerHTML = `<div class="empty-state">No active milestone deliverables.</div>`;
        return;
    }

    dashboardMilestones.forEach(item => {
        // Calculate remaining window
        const today = new Date();
        const target = new Date(item.target_date);
        const daysRemaining = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
        const isAtRisk = daysRemaining <= 10 && daysRemaining >= 0;

        const borderPriorityColor = isAtRisk ? "var(--danger)" : (item.status === "In Progress" ? "#ca8a04" : "#cbd5e1");
        const customBackground = isAtRisk ? "#fef2f2" : "var(--background)";

        container.innerHTML += `
            <div class="stream-item" style="border-left-color: ${borderPriorityColor}; background: ${customBackground}; cursor:pointer;" onclick="window.location.href='workmap-detail.html?milestone_id=${item.milestone_id}'">
                <div class="stream-item-top">
                    <span class="stream-item-title" style="${isAtRisk ? "color: var(--danger);" : ""}">${item.milestone_name}</span>
                    ${isAtRisk ? `<span class="dashboard-badge badge-alert">🚨 AT RISK</span>` : ""}
                </div>
                <div class="item-meta">
                    <span>${item.portfolio_name} | ${item.project_name}</span>
                    <span style="font-weight:600;">📅 ${formatDateWithDay(item.target_date)}</span>
                </div>
            </div>
        `;
    });

    // Focus Mode collapses this list down to one line — populate it here
    // so it's ready the moment the toggle is used, not computed on click.
    const nearest = dashboardMilestones[0];
    const nearestDays = nearest ? Math.ceil((new Date(nearest.target_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    const nearestLabel = nearest ? ` · nearest due in ${nearestDays}d (${nearest.milestone_name})` : "";

    document.getElementById("milestoneSummaryBar").innerHTML =
        `<span>🎯 <b>${dashboardMilestones.length} active</b>${nearestLabel}</span>`;
}









// 2. Fetch & Map Action Desk (Open/In Progress/Overdue ToDos)
async function loadDashboardTodos() {
    // status=not.in.(...) — was status=eq.Open, which silently hid every
    // "In Progress" ToDo from the Dashboard regardless of due date.
    const data = await getData("vw_todo?status=not.in.(Completed,Cancelled)&order=due_date.asc");
    dashboardTodos = Array.isArray(data) ? data : [];

    // Needed to compute "gone cold" — started but no recent activity —
    // distinct from Work Map's "never started at all" flag.
    const logData = await getData("vw_task_log_details?todo_id=not.is.null");
    const allLogs = Array.isArray(logData) ? logData : [];

    const lastLoggedByTodo = {};
    allLogs.forEach(log => {
        const current = lastLoggedByTodo[log.todo_id];
        if (!current || log.task_date > current) {
            lastLoggedByTodo[log.todo_id] = log.task_date;
        }
    });

    const container = document.getElementById("todoActionDesk");
    document.getElementById("countTodos").textContent = dashboardTodos.length;
    document.getElementById("summaryTodos").textContent = dashboardTodos.length;
    container.innerHTML = "";

    if (dashboardTodos.length === 0) {
        container.innerHTML = `<div class="empty-state is-good">Action Desk clear! No open items.</div>`;
        return;
    }

    const todayStr = getToday();
    const urgentItems = dashboardTodos.filter(t => t.due_date && t.due_date <= todayStr);
    const upcomingItems = dashboardTodos.filter(t => !t.due_date || t.due_date > todayStr);

    const GONE_COLD_DAYS = 7;

    function goneColdBadge(todoId) {
        const lastDate = lastLoggedByTodo[todoId];
        if (!lastDate) {
            return "";
        }
        const daysSince = Math.floor((new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
        if (daysSince >= GONE_COLD_DAYS) {
            return `<span style="color:var(--warning); font-weight:bold;">🥶 Inactive ${daysSince}d</span>`;
        }
        return "";
    }

    let html = "";

    // Render Section A: Urgent Tasks
    html += `<div style="font-weight:700; font-size:0.75rem; color:var(--danger); margin: 4px 0 6px 0;">🔥 URGENT DESK (TODAY / OVERDUE)</div>`;
    if (urgentItems.length === 0) {
        html += `<div class="empty-state is-good" style="padding:6px;">✨ No urgent actions!</div>`;
    } else {
        urgentItems.forEach(item => {
            const isOverdue = item.due_date < todayStr;
            const detailUrl = `workmap-detail.html?milestone_id=${item.milestone_id || "__standalone__"}&todo_id=${item.todo_id}`;
            const notesPreview = getNotesPreview(item.notes, 60);
            html += `
                <div class="stream-item" style="border-left-color: var(--danger); margin-bottom:6px; cursor:pointer;" onclick="window.location.href='${detailUrl}'">
                    <div class="stream-item-top">
                        <span class="stream-item-title">${item.todo_text}</span>
                        <span class="stream-log-action" onclick="quickLogToDo('${item.todo_id}', '${item.todo_text.replace(/'/g, "\\'")}')">⏱️ Log</span>
                    </div>
                    <div class="item-meta">
                        <span>🎯 ${item.milestone_name || "Standalone"}</span>
                        <span style="color:var(--danger); font-weight:bold;">${isOverdue ? "⚠️ OVERDUE" : "Due Today"}</span>
                        ${goneColdBadge(item.todo_id)}
                    </div>
                    ${notesPreview ? `<div class="item-notes-preview">📝 ${notesPreview}</div>` : ""}
                </div>
            `;
        });
    }

    // Render Section B: Rest of the Pipeline
    if (upcomingItems.length > 0) {
        html += `<div style="font-weight:700; font-size:0.75rem; color:var(--text-faint); margin: 12px 0 6px 0;">📅 UPCOMING & BACKLOG</div>`;
        upcomingItems.forEach(item => {
            const dateDisplayLabel = item.due_date ? formatDateWithDay(item.due_date) : "No Due Date";
            const detailUrl = `workmap-detail.html?milestone_id=${item.milestone_id || "__standalone__"}&todo_id=${item.todo_id}`;
            const notesPreview = getNotesPreview(item.notes, 60);
            html += `
                <div class="stream-item" style="border-left-color: var(--primary); margin-bottom:6px; cursor:pointer;" onclick="window.location.href='${detailUrl}'">
                    <div class="stream-item-top">
                        <span class="stream-item-title">${item.todo_text}</span>
                        <span class="stream-log-action" onclick="quickLogToDo('${item.todo_id}', '${item.todo_text.replace(/'/g, "\\'")}')">⏱️ Log</span>
                    </div>
                    <div class="item-meta">
                        <span>🎯 ${item.milestone_name || "Standalone"}</span>
                        <span>${dateDisplayLabel}</span>
                        ${goneColdBadge(item.todo_id)}
                    </div>
                    ${notesPreview ? `<div class="item-notes-preview">📝 ${notesPreview}</div>` : ""}
                </div>
            `;
        });
    }

    container.innerHTML = html;
}




// 3. Load Quick Summary performance metrics directly using the calculation structures from review.js
async function loadDashboardPerformanceCounters() {
    const data = await getData("vw_review_time_summary");
    if (Array.isArray(data) && data.length > 0) {
        const timeSummary = data[0];
        document.getElementById("summaryToday").textContent = `${((timeSummary.today_minutes || 0) / 60).toFixed(1)} hrs`;
    }
}


// Intercepts a ToDo item and forwards it straight to your Task Log popup template
function quickLogToDo(todoId, todoText) {
    if (window.event) {
        window.event.stopPropagation(); // Prevents clicking the row from opening todo.html
    }
    sessionStorage.setItem("QUICK_LOG_DESC", `Action Taken: ${todoText}`);
    sessionStorage.setItem("QUICK_LOG_TODO_ID", todoId);
    window.location.href = "task-log.html?action=new";
}


// 🚀 NEW: Flips the dashboard display tree between wide planning and clean execution mode
function toggleDashboardFocusMode() {
    const bodyContainer = document.querySelector(".app-layout");
    const btn = document.getElementById("focusToggleBtn");
    
    if (!bodyContainer || !btn) return;
    
    // Toggle the target active class states
    const isActive = bodyContainer.classList.toggle("focus-mode-active");
    
    if (isActive) {
        btn.classList.add("active");
        btn.textContent = "👁️ Show All";
    } else {
        btn.classList.remove("active");
        btn.textContent = "🎯 Focus Mode";
    }
}
