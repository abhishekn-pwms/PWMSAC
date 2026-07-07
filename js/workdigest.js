// ======================================================
// Work Digest — collate work by Milestone for a date
// range, so it can be read and turned into manager/CSAIO
// update bullets. This is a FEED, not a report generator:
// it surfaces raw ToDos + Task Logs, narrative judgment
// stays with the person writing the actual update.
//
// Two windows per milestone:
//   Primary    = the chosen From/To (this period's work)
//   Historical = the 14 days before Primary's From date
//                (context only — e.g. "no material change
//                since [date]" cases)
//
// Collapsed state = card grid (3-per-row on desktop).
// Clicking a card expands it to the full grid row width,
// same mechanic as Work Map, so long log lists never need
// their own nested scrollbar.
// ======================================================

let wdMilestones = [];
let wdTodos = [];
let wdTaskLogs = [];

const WD_STANDALONE_ID = "__standalone__";
const WD_HISTORICAL_LOOKBACK_DAYS = 14;
const WD_LAST_TO_DATE_KEY = "PWMS_WD_LAST_TO_DATE";

let wdExpandedMilestoneId = null;
let wdExpandedHistorical = new Set();


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        initializeWorkDigestRange();

        await loadWorkDigestData();

        renderWorkDigest();
    }
);


// ======================================================
// RANGE INITIALIZATION + MEMORY
// ======================================================

function initializeWorkDigestRange() {

    const today = getToday();

    const lastToDate = localStorage.getItem(WD_LAST_TO_DATE_KEY);

    let fromDate;

    if (lastToDate && lastToDate < today) {

        const next = new Date(lastToDate);
        next.setDate(next.getDate() + 1);
        fromDate = next.toISOString().split("T")[0];

    } else {

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 6);
        fromDate = weekAgo.toISOString().split("T")[0];
    }

    document.getElementById("wdFromDate").value = fromDate;
    document.getElementById("wdToDate").value = today;
}


function setWorkDigestPreset(preset) {

    const today = getToday();

    if (preset === "week") {

        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((day + 6) % 7));

        document.getElementById("wdFromDate").value = monday.toISOString().split("T")[0];
        document.getElementById("wdToDate").value = today;
    }

    if (preset === "7days") {

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 6);

        document.getElementById("wdFromDate").value = weekAgo.toISOString().split("T")[0];
        document.getElementById("wdToDate").value = today;
    }

    if (preset === "sincelast") {

        const lastToDate = localStorage.getItem(WD_LAST_TO_DATE_KEY);

        if (lastToDate) {

            const next = new Date(lastToDate);
            next.setDate(next.getDate() + 1);

            document.getElementById("wdFromDate").value = next.toISOString().split("T")[0];
            document.getElementById("wdToDate").value = today;

        } else {
            showError("No previous digest recorded yet");
        }
    }

    applyWorkDigestFilters();
}


// ======================================================
// DATA LOADING
// ======================================================

async function loadWorkDigestData() {

    wdMilestones =
        await getData("vw_milestone_details?enabled=eq.true");

    if (!Array.isArray(wdMilestones)) {
        wdMilestones = [];
    }

    wdTodos = await getData("vw_todo");

    if (!Array.isArray(wdTodos)) {
        wdTodos = [];
    }

    wdTaskLogs =
        await getData("vw_task_log_details?todo_id=not.is.null");

    if (!Array.isArray(wdTaskLogs)) {
        wdTaskLogs = [];
    }
}


async function refreshWorkDigest() {

    await loadWorkDigestData();

    renderWorkDigest();
}


function applyWorkDigestFilters() {

    renderWorkDigest();
}


function getTodosForMilestone(milestoneId) {

    if (milestoneId === WD_STANDALONE_ID) {
        return wdTodos.filter(t => !t.milestone_id);
    }

    return wdTodos.filter(t => t.milestone_id === milestoneId);
}


// ======================================================
// BUILD DIGEST DATA
// ======================================================

function buildWorkDigestGroups() {

    const primaryFrom = document.getElementById("wdFromDate").value;
    const primaryTo = document.getElementById("wdToDate").value;

    if (!primaryFrom || !primaryTo) {
        return { groups: [], primaryFrom, primaryTo, historicalFrom: null, historicalTo: null };
    }

    const histTo = new Date(primaryFrom);
    histTo.setDate(histTo.getDate() - 1);
    const historicalTo = histTo.toISOString().split("T")[0];

    const histFrom = new Date(primaryFrom);
    histFrom.setDate(histFrom.getDate() - WD_HISTORICAL_LOOKBACK_DAYS);
    const historicalFrom = histFrom.toISOString().split("T")[0];

    const milestoneGroups = wdMilestones.slice();

    const standaloneTodos = wdTodos.filter(t => !t.milestone_id);

    if (standaloneTodos.length > 0) {
        milestoneGroups.push({
            milestone_id: WD_STANDALONE_ID,
            milestone_name: "Standalone ToDos",
            project_name: "Not tied to any milestone",
            portfolio_name: "",
            status: "Open",
            target_date: null
        });
    }

    const built = milestoneGroups.map(milestone => {

        const todos = getTodosForMilestone(milestone.milestone_id);
        const todoIds = todos.map(t => t.todo_id);

        const allLogs = wdTaskLogs.filter(l => todoIds.includes(l.todo_id));

        const primaryLogs =
            allLogs.filter(l => l.task_date >= primaryFrom && l.task_date <= primaryTo)
                .sort((a, b) => {

                    const dateCompare = (b.task_date || "").localeCompare(a.task_date || "");
                    if (dateCompare !== 0) return dateCompare;

                    if (!a.start_time && !b.start_time) return 0;
                    if (!a.start_time) return 1;
                    if (!b.start_time) return -1;

                    return b.start_time.localeCompare(a.start_time);
                });

        const historicalLogs =
            allLogs.filter(l => l.task_date >= historicalFrom && l.task_date <= historicalTo)
                .sort((a, b) => (b.task_date || "").localeCompare(a.task_date || ""));

        const openTodos =
            todos.filter(t => t.status === "Open" || t.status === "In Progress")
                .sort((a, b) => {
                    const dateA = a.due_date || "9999-12-31";
                    const dateB = b.due_date || "9999-12-31";
                    return dateA.localeCompare(dateB);
                });

        const totalMinutes = primaryLogs.reduce((sum, l) => sum + (l.minutes_spent || 0), 0);

        const mostRecentPrimaryDate =
            primaryLogs.length > 0 ? primaryLogs[0].task_date : null;

        const mostRecentHistoricalDate =
            historicalLogs.length > 0 ? historicalLogs[0].task_date : null;

        return {
            milestone,
            primaryLogs,
            historicalLogs,
            openTodos,
            totalMinutes,
            mostRecentPrimaryDate,
            mostRecentHistoricalDate,
            hasActivity: primaryLogs.length > 0 || historicalLogs.length > 0,
            noNewActivity: primaryLogs.length === 0 && historicalLogs.length > 0
        };

    }).filter(g => g.hasActivity);

    // Active-this-period milestones always rank above no-new-activity ones,
    // regardless of how recent the historical-only activity happens to be.
    // Within each group, most recently worked-on first.
    built.sort((a, b) => {

        if (a.noNewActivity !== b.noNewActivity) {
            return a.noNewActivity ? 1 : -1;
        }

        const dateA = a.mostRecentPrimaryDate || a.mostRecentHistoricalDate || "";
        const dateB = b.mostRecentPrimaryDate || b.mostRecentHistoricalDate || "";

        return dateB.localeCompare(dateA);
    });

    return { groups: built, primaryFrom, primaryTo, historicalFrom, historicalTo };
}


// ======================================================
// RENDER
// ======================================================

function renderWorkDigest() {

    const { groups, primaryFrom, primaryTo, historicalFrom, historicalTo } = buildWorkDigestGroups();

    if (!primaryFrom || !primaryTo) {
        return;
    }

    document.getElementById("wdHistoricalNote").textContent =
        `Historical context shown: ${formatDate(historicalFrom)} – ${formatDate(historicalTo)}`;

    localStorage.setItem(WD_LAST_TO_DATE_KEY, primaryTo);

    const container = document.getElementById("wdDigestList");

    if (groups.length === 0) {
        container.innerHTML = `<div class="wb-empty-state">No task logs found in this date range or the 14 days before it.</div>`;
        updateWorkDigestSummary(0, 0, 0);
        return;
    }

    container.innerHTML =
        groups
            .map(g => {

                const isExpanded = (g.milestone.milestone_id === wdExpandedMilestoneId);

                return isExpanded
                    ? renderExpandedCard(g)
                    : renderCollapsedCard(g);
            })
            .join("");

    const totalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0);
    const noMovementCount = groups.filter(g => g.noNewActivity).length;

    updateWorkDigestSummary(groups.length, totalMinutes, noMovementCount);
}


function getMilestoneContext(milestone) {

    if (milestone.milestone_id === WD_STANDALONE_ID) {
        return milestone.project_name;
    }

    return milestone.project_name || "";
}


function renderCollapsedCard(g) {

    const m = g.milestone;

    const cardClass =
        g.noNewActivity ? "wd-card-no-movement" : (g.primaryLogs.length > 0 ? "wd-card-active" : "wd-card-quiet");

    const statsHtml =
        g.noNewActivity
            ? `<div class="wd-card-no-movement-tag">No new activity this period</div>`
            : `
                <div class="wd-card-stats-row">
                    <div class="wd-card-stat">
                        <div class="wd-card-stat-value">${g.primaryLogs.length}</div>
                        <div class="wd-card-stat-label">Logs</div>
                    </div>
                    <div class="wd-card-stat">
                        <div class="wd-card-stat-value">${formatDigestHours(g.totalMinutes)}</div>
                        <div class="wd-card-stat-label">Hours</div>
                    </div>
                    <div class="wd-card-stat">
                        <div class="wd-card-stat-value" style="color:${g.openTodos.length > 0 ? "var(--danger-strong)" : "var(--text-faint)"};">${g.openTodos.length}</div>
                        <div class="wd-card-stat-label">Open</div>
                    </div>
                </div>
            `;

    return `
        <div class="wd-card ${cardClass}" onclick="toggleWorkDigestCard('${m.milestone_id}')">
            <div class="wd-card-name">${m.milestone_name}</div>
            <div class="wd-card-context">${getMilestoneContext(m)}</div>
            ${statsHtml}
        </div>
    `;
}


function renderExpandedCard(g) {

    const m = g.milestone;
    const isHistExpanded = wdExpandedHistorical.has(m.milestone_id);

    const primaryHtml =
        g.primaryLogs.length === 0
            ? `<div class="wb-empty-state wb-empty-state-small">No new task logs in this period.</div>`
            : g.primaryLogs.map(l => renderDigestLogLine(l)).join("");

    const openTodosHtml =
        g.openTodos.length === 0
            ? `<div class="wd-next-empty">No open ToDos.</div>`
            : g.openTodos.map(t => `
                <div class="wd-next-item">
                    <span>${t.todo_text}</span>
                    ${t.due_date ? `<span class="wd-next-due">📅 ${formatDate(t.due_date)}</span>` : ""}
                </div>
            `).join("");

    const historicalHtml =
        g.historicalLogs.length === 0
            ? `<div class="wb-empty-state wb-empty-state-small">No logs in the historical window either.</div>`
            : g.historicalLogs.map(l => renderDigestLogLine(l)).join("");

    return `
        <div class="wd-expanded-card ${g.noNewActivity ? "wd-card-no-movement" : ""}">

            <div class="wd-expanded-header" onclick="toggleWorkDigestCard('${m.milestone_id}')">
                <div>
                    <div class="wd-expanded-name">${m.milestone_name}</div>
                    <div class="wd-expanded-context">${getMilestoneContext(m)}</div>
                </div>
                <div class="wd-expanded-tags">
                    ${g.noNewActivity ? `<span class="wd-tag-no-movement">No new activity this period</span>` : ""}
                    <span class="wd-collapse-link">Click to collapse ▾</span>
                </div>
            </div>

            <div class="wd-expanded-body">

                <div class="wd-section">
                    <div class="wd-section-title">This Period</div>
                    ${primaryHtml}
                </div>

                <div class="wd-section">
                    <div class="wd-section-title">Next (Open ToDos)</div>
                    ${openTodosHtml}
                </div>

                <div class="wd-historical-toggle" onclick="event.stopPropagation(); toggleWorkDigestHistorical('${m.milestone_id}')">
                    ${isHistExpanded ? "▾" : "▸"} Historical (D-14 context) — ${g.historicalLogs.length} log(s)
                </div>

                <div class="wd-historical-body" style="display:${isHistExpanded ? "block" : "none"};">
                    ${historicalHtml}
                </div>

            </div>

        </div>
    `;
}


function renderDigestLogLine(log) {

    const todo = wdTodos.find(t => t.todo_id === log.todo_id);

    return `
        <div class="wd-log-line">
            <span class="wd-log-date">${formatDate(log.task_date)}</span>
            <span class="wd-log-desc">${log.task_description || ""}</span>
            ${todo ? `<span class="wd-log-todo-tag">${todo.todo_text}</span>` : ""}
        </div>
    `;
}


function toggleWorkDigestCard(milestoneId) {

    wdExpandedMilestoneId =
        (wdExpandedMilestoneId === milestoneId) ? null : milestoneId;

    renderWorkDigest();
}


function toggleWorkDigestHistorical(milestoneId) {

    if (wdExpandedHistorical.has(milestoneId)) {
        wdExpandedHistorical.delete(milestoneId);
    } else {
        wdExpandedHistorical.add(milestoneId);
    }

    renderWorkDigest();
}


function formatDigestHours(minutes) {

    if (!minutes) {
        return "0h";
    }

    const hours = Math.round((minutes / 60) * 100) / 100;

    return `${hours}h`;
}


function updateWorkDigestSummary(milestoneCount, totalMinutes, noMovementCount) {

    document.getElementById("wdSummaryMilestones").textContent =
        `${milestoneCount} Milestone(s) with activity`;

    document.getElementById("wdSummaryHours").textContent =
        `${formatDigestHours(totalMinutes)} logged this period`;

    document.getElementById("wdSummaryNoMovement").textContent =
        noMovementCount > 0 ? `${noMovementCount} with no new activity` : `All have new activity`;
}
