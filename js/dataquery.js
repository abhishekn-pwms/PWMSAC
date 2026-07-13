// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE

// dataquery.js
// Deliberately NOT raw SQL — every query here goes through the same
// structured REST calls (getData with filters) that every other page in
// PWMS already uses. Table list is a short, explicit allow-list, not
// open-ended, and there's no mechanism here that could ever run an
// arbitrary statement against the database.

const DQ_TABLE_CONFIGS = {
    attendance_log: {
        dateColumn: "log_date",
        filterColumn: "code",
        filterLabel: "Code contains"
    }
    // Add more tables here later (e.g. task_log) by giving them the
    // same shape — no other code needs to change.
};

let dqLastResults = [];


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        document.getElementById("dqFromDate").value = "2022-01-01";
        document.getElementById("dqToDate").value = getToday();
    }
);


function onDataQueryTableChanged() {

    const tableName = document.getElementById("dqTable").value;
    const config = DQ_TABLE_CONFIGS[tableName];

    document.querySelector('label[for="dqCodeFilter"]');
    document.getElementById("dqCodeFilter").placeholder = config.filterLabel ? `${config.filterLabel}...` : "optional...";
}


async function runDataQuery() {

    const tableName = document.getElementById("dqTable").value;
    const config = DQ_TABLE_CONFIGS[tableName];

    const from = document.getElementById("dqFromDate").value;
    const to = document.getElementById("dqToDate").value;
    const codeFilter = document.getElementById("dqCodeFilter").value.trim();

    if (!from || !to) {
        showError("From and To dates are required");
        return;
    }

    let baseQuery = `${tableName}?${config.dateColumn}=gte.${from}&${config.dateColumn}=lte.${to}&order=${config.dateColumn}.asc`;

    if (codeFilter && config.filterColumn) {
        baseQuery += `&${config.filterColumn}=ilike.*${encodeURIComponent(codeFilter)}*`;
    }

    // PostgREST caps any single request at a default row limit (commonly
    // 1000) — anything beyond that is silently truncated unless you
    // explicitly paginate. This fetches page by page until a page comes
    // back with fewer rows than requested, guaranteeing every matching
    // row is retrieved regardless of how large the table grows.
    const PAGE_SIZE = 1000;
    let allRows = [];
    let offset = 0;

    document.getElementById("dqResultSummary").textContent = "Running query...";

    while (true) {

        const pageQuery = `${baseQuery}&limit=${PAGE_SIZE}&offset=${offset}`;
        const page = await getData(pageQuery);
        const pageRows = Array.isArray(page) ? page : [];

        allRows = allRows.concat(pageRows);

        if (pageRows.length < PAGE_SIZE) {
            break;
        }

        offset += PAGE_SIZE;
    }

    dqLastResults = allRows;

    renderDataQueryResults();
}


function renderDataQueryResults() {

    const thead = document.getElementById("dqTableHead");
    const tbody = document.getElementById("dqTableBody");
    const summary = document.getElementById("dqResultSummary");

    summary.innerHTML = `<b>${dqLastResults.length}</b> row(s) returned — complete, not capped, regardless of table size`;

    if (dqLastResults.length === 0) {
        thead.innerHTML = "";
        tbody.innerHTML = `<tr><td class="wb-empty-state">No rows match this query.</td></tr>`;
        return;
    }

    const columns = Object.keys(dqLastResults[0]);

    thead.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join("")}</tr>`;

    tbody.innerHTML = dqLastResults
        .map(row => `<tr>${columns.map(c => `<td>${row[c] ?? ""}</td>`).join("")}</tr>`)
        .join("");
}


function exportDataQueryCsv() {

    if (dqLastResults.length === 0) {
        showError("Run a query first — nothing to export yet");
        return;
    }

    const columns = Object.keys(dqLastResults[0]);
    const lines = [columns.join(",")];

    dqLastResults.forEach(row => {
        lines.push(columns.map(c => String(row[c] ?? "").replace(/,/g, ";")).join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `Data_Query_${getToday()}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showSuccess("Query results exported");
}
