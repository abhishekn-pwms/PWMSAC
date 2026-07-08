// AC v1.5 - TASK LOG ANALYSIS

// ======================================================
// Task Log Analysis — a flat, sortable, filterable table
// over every task log, Excel-AutoFilter style. Filters
// combine (AND); sorting is click-to-toggle per column;
// export writes exactly what's currently visible (filtered
// + sorted), not the whole dataset.
// ======================================================

let tlaAllLogs = [];

let tlaSortColumn = "task_date";
let tlaSortDirection = "desc";


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        await loadTlaData();

        populateTlaDropdowns();

        renderTla();
    }
);


// ======================================================
// DATA LOADING
// All logs, including ones with no ToDo — shown as
// "(Unlinked)" rather than silently excluded.
// ======================================================

async function loadTlaData() {

    const logs = await getData("vw_task_log_details?order=task_date.desc");

    tlaAllLogs = Array.isArray(logs) ? logs : [];
}


async function refreshTla() {

    await loadTlaData();

    populateTlaDropdowns();

    renderTla();
}


function populateTlaDropdowns() {

    const milestoneSelect = document.getElementById("tlaFilterMilestone");
    const projectSelect = document.getElementById("tlaFilterProject");

    const currentMilestone = milestoneSelect.value;
    const currentProject = projectSelect.value;

    const milestones = [...new Set(tlaAllLogs.map(l => l.milestone_name).filter(Boolean))].sort();
    const projects = [...new Set(tlaAllLogs.map(l => l.project_name).filter(Boolean))].sort();

    milestoneSelect.innerHTML =
        `<option value="">All</option><option value="__unlinked__">(Unlinked)</option>` +
        milestones.map(m => `<option value="${m}">${m}</option>`).join("");

    projectSelect.innerHTML =
        `<option value="">All</option><option value="__unlinked__">(Unlinked)</option>` +
        projects.map(p => `<option value="${p}">${p}</option>`).join("");

    milestoneSelect.value = currentMilestone;
    projectSelect.value = currentProject;
}


// ======================================================
// FILTER + SORT
// ======================================================

function getTlaFilteredSortedRows() {

    const singleDate = document.getElementById("tlaFilterDate").value;
    const fromDate = document.getElementById("tlaFilterFrom").value;
    const toDate = document.getElementById("tlaFilterTo").value;
    const descFilter = document.getElementById("tlaFilterDescription").value.toLowerCase().trim();
    const todoFilter = document.getElementById("tlaFilterTodo").value.toLowerCase().trim();
    const milestoneFilter = document.getElementById("tlaFilterMilestone").value;
    const projectFilter = document.getElementById("tlaFilterProject").value;

    let rows = tlaAllLogs.filter(l => {

        if (singleDate && l.task_date !== singleDate) return false;
        if (fromDate && l.task_date < fromDate) return false;
        if (toDate && l.task_date > toDate) return false;

        if (descFilter && !(l.task_description || "").toLowerCase().includes(descFilter)) return false;
        if (todoFilter && !(l.todo_text || "").toLowerCase().includes(todoFilter)) return false;

        if (milestoneFilter === "__unlinked__" && l.milestone_name) return false;
        if (milestoneFilter && milestoneFilter !== "__unlinked__" && l.milestone_name !== milestoneFilter) return false;

        if (projectFilter === "__unlinked__" && l.project_name) return false;
        if (projectFilter && projectFilter !== "__unlinked__" && l.project_name !== projectFilter) return false;

        return true;
    });

    rows = rows.slice().sort((a, b) => {

        let valA = a[tlaSortColumn];
        let valB = b[tlaSortColumn];

        if (tlaSortColumn === "minutes_spent") {
            valA = valA || 0;
            valB = valB || 0;
        } else {
            valA = (valA || "").toString().toLowerCase();
            valB = (valB || "").toString().toLowerCase();
        }

        if (valA < valB) return (tlaSortDirection === "asc") ? -1 : 1;
        if (valA > valB) return (tlaSortDirection === "asc") ? 1 : -1;
        return 0;
    });

    return rows;
}


function setTlaSort(column) {

    if (tlaSortColumn === column) {
        tlaSortDirection = (tlaSortDirection === "asc") ? "desc" : "asc";
    } else {
        tlaSortColumn = column;
        tlaSortDirection = "asc";
    }

    renderTla();
}


function clearTlaFilters() {

    document.getElementById("tlaFilterDate").value = "";
    document.getElementById("tlaFilterFrom").value = "";
    document.getElementById("tlaFilterTo").value = "";
    document.getElementById("tlaFilterDescription").value = "";
    document.getElementById("tlaFilterTodo").value = "";
    document.getElementById("tlaFilterMilestone").value = "";
    document.getElementById("tlaFilterProject").value = "";

    renderTla();
}


// ======================================================
// RENDER
// ======================================================

function renderTla() {

    const rows = getTlaFilteredSortedRows();

    const tbody = document.getElementById("tlaTableBody");

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="wb-empty-state">No task logs match these filters.</td></tr>`;
    } else {
        tbody.innerHTML = rows.map(l => renderTlaRow(l)).join("");
    }

    const totalMinutes = rows.reduce((sum, l) => sum + (l.minutes_spent || 0), 0);
    const totalHours = totalMinutes ? Math.round((totalMinutes / 60) * 100) / 100 : 0;

    document.getElementById("tlaRecordCount").textContent =
        `Showing ${rows.length} of ${tlaAllLogs.length} records`;

    document.getElementById("tlaTotalHours").textContent =
        `Total: ${totalHours}h`;

    updateTlaSortIcons();
}


function renderTlaRow(l) {

    const hours = l.minutes_spent ? Math.round((l.minutes_spent / 60) * 100) / 100 : 0;

    return `
        <tr>
            <td>${formatDate(l.task_date)}</td>
            <td>${l.task_description || ""}</td>
            <td>${l.todo_text || `<span class="tla-unlinked">(Unlinked)</span>`}</td>
            <td>${l.milestone_name || `<span class="tla-unlinked">(Unlinked)</span>`}</td>
            <td>${l.project_name || "—"}</td>
            <td>${l.start_time ? formatTime(l.start_time) : ""}</td>
            <td>${l.end_time ? formatTime(l.end_time) : ""}</td>
            <td class="tla-col-hours">${hours}h</td>
        </tr>
    `;
}


function updateTlaSortIcons() {

    const columns = ["task_date", "task_description", "todo_text", "milestone_name", "project_name", "start_time", "end_time", "minutes_spent"];

    columns.forEach(col => {

        const icon = document.getElementById(`tlaSortIcon_${col}`);

        if (col === tlaSortColumn) {
            icon.textContent = (tlaSortDirection === "asc") ? "▲" : "▼";
        } else {
            icon.textContent = "";
        }
    });
}


// ======================================================
// EXPORT — writes exactly what's currently visible
// (filtered + sorted), not the full dataset.
// ======================================================

function exportTlaToExcel() {

    const rows = getTlaFilteredSortedRows();

    if (rows.length === 0) {
        showError("No rows to export — adjust your filters first");
        return;
    }

    const exportRows = rows.map(l => ({
        "Date": formatDate(l.task_date),
        "Description": l.task_description || "",
        "ToDo": l.todo_text || "(Unlinked)",
        "Milestone": l.milestone_name || "(Unlinked)",
        "Project": l.project_name || "",
        "Start": l.start_time ? formatTime(l.start_time) : "",
        "End": l.end_time ? formatTime(l.end_time) : "",
        "Hours": l.minutes_spent ? Math.round((l.minutes_spent / 60) * 100) / 100 : 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Task Logs");

    const today = getToday();

    XLSX.writeFile(workbook, `Task_Log_Analysis_${today}.xlsx`);

    showSuccess(`Exported ${rows.length} rows`);
}
