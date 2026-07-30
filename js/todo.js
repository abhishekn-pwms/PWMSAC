// PWMS AC v1.7d TODOATTACH

/* ==================================
   DATA
================================== */

let todoData = [];

let projectData = []; // To support inline parent project mappings

let milestoneData = [];

let filteredActivityData = [];


/* ==================================
   PAGE LOAD
================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();
        await initializeLayout();
        await loadProjects(); // New method to feed the inline child selector
        await loadMilestones();
        await loadTodos();

        
        // PASS v1.1g4 NEW FAB
        // 🚀 UPDATED: Multi-Route Interceptor for both Universal accelerators and Dashboard Log transitions
        const urlParams = new URLSearchParams(window.location.search);
        const actionType = urlParams.get('action');
        
        if (actionType === 'new' || actionType === 'log') {
            // Instantly fire your form modal open loop
            newTodo(); 
            
            // If it came from the dashboard link, automatically select the right record context
            const targetId = urlParams.get('id');
            if (actionType === 'log' && targetId) {
                // Ensure your local edit function loads the specific task data mapping
                editTodo(targetId);
            }

            // Coming from a Work Map / Work Map Detail "+ New ToDo" link —
            // that milestone is already known, so pre-select it instead of
            // leaving the new ToDo defaulted to Standalone.
            const presetMilestoneId = urlParams.get('milestone_id');
            if (actionType === 'new' && presetMilestoneId) {
                document.getElementById("milestoneId").value = presetMilestoneId;
                milestoneChanged();
            }
        }

        // Clean up the URL string line parameters in the address bar cleanly to safeguard manual page reloads
            window.history.replaceState({}, document.title, window.location.pathname);

        // 🚀 NEW: Instantly ready to search without clicking
        document.getElementById("searchText")?.focus();

    }
);



/* ==================================
   LOAD PROJECTS (For Inline Form Mapping)
================================== */
async function loadProjects() {
    projectData = await getData("project?enabled=eq.true&order=project_name.asc");
    if (!Array.isArray(projectData)) { projectData = []; return; }
    
    const dropdown = document.getElementById("newMilestoneProject");
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">Select Project</option>';
    projectData.forEach(p => {
        dropdown.innerHTML += `<option value="${p.project_id}">${p.project_name}</option>`;
    });
}

/* ==================================
   LOAD MILESTONES (Replaces Load Activities Controls)
================================== */
    async function loadMilestones() {
        // 🎯 FIX: Remove the manual order query suffix to prevent masters.js parser from tripping over it
        milestoneData = await getData("vw_milestone_details?enabled=eq.true");
        if (!Array.isArray(milestoneData)) {
        console.error(milestoneData);
        milestoneData = [];
        showError("Unable to load milestones");
        return;
    }
    filteredMilestoneData = [...milestoneData];
    populateMilestoneDropdown();
    populateMilestoneFilter();
}




/* ==================================
   LOAD TODOS
================================== */

async function loadTodos() {

    todoData =
        await getData(
            "vw_todo?order=status.asc,due_date.asc"
        );

    if (!Array.isArray(todoData)) {

        console.error(
            todoData
        );

        todoData = [];

        showError(
            "Unable to load todos"
        );

        return;
    }

    refreshTodoView();
}





/* ==================================
   FILTER TODOS
================================== */

function getFilteredTodos() {
    const search = document.getElementById("searchText").value.toLowerCase();
    const status = document.getElementById("statusFilter").value;
    const milestoneFilterValue = document.getElementById("milestoneFilter").value;

    return todoData.filter(item => {
    const matchesSearch =

                    (item.todo_text || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (item.notes || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (item.milestone_name || "")
                        .toLowerCase()
                        .includes(search)

                    ||

                    (item.project_name || "")
                        .toLowerCase()
                        .includes(search);

        const matchesStatus =
            (status === "All")
                ? true
                : (status === "OpenAndInProgress")
                    ? (item.status === "Open" || item.status === "In Progress")
                    : item.status === status;
        const matchesMilestone = (milestoneFilterValue === "All") ? true : item.milestone_id === milestoneFilterValue;

        return matchesSearch && matchesStatus && matchesMilestone;
    });
}


/* ==================================
   SUMMARY
================================== */

function updateTodoSummary(
    rows
) {

    const open =
        rows.filter(
            x =>
                x.status ===
                "Open"
        ).length;

    const completed =
        rows.filter(
            x =>
                x.status ===
                "Completed"
        ).length;

    const today =
        getToday();

    const overdue =
        rows.filter(
            x =>

                x.status ===
                    "Open"

                &&

                x.due_date

                &&

                x.due_date <
                    today
        ).length;

    document.getElementById(
        "totalOpen"
    ).textContent =
        `Open: ${open}`;

    document.getElementById(
        "totalCompleted"
    ).textContent =
        `Completed: ${completed}`;

    document.getElementById(
        "totalOverdue"
    ).textContent =
        `Overdue: ${overdue}`;
}


/* ==================================
   GROUP TODOS
================================== */

function groupTodos(
    rows
) {

    const groups = {

        overdue: [],

        today: [],

        thisWeek: [],

        future: [],

        noDueDate: [],

        completed: []
    };

    const today =
        getToday();

    const weekEnd =
        new Date();

    weekEnd.setDate(
        weekEnd.getDate() + 7
    );

    rows.forEach(
        item => {

            if (
                item.status ===
                "Completed"
            ) {

                groups.completed
                    .push(item);

                return;
            }

            if (
                !item.due_date
            ) {

                groups.noDueDate
                    .push(item);

                return;
            }

            if (
                item.due_date <
                today
            ) {

                groups.overdue
                    .push(item);

                return;
            }

            if (
                item.due_date ===
                today
            ) {

                groups.today
                    .push(item);

                return;
            }

            if (
                new Date(
                    item.due_date
                ) <= weekEnd
            ) {

                groups.thisWeek
                    .push(item);

                return;
            }

            groups.future
                .push(item);
        }
    );

    return groups;
}


/* ==================================
   RENDER FEED
================================== */

function renderTodoFeed() {

    const feed =
        document.getElementById(
            "todoFeed"
        );

    if (!feed) {
        return;
    }

    feed.innerHTML = "";

    const rows =
        getFilteredTodos();

    updateTodoSummary(
        rows
    );

    const groups =
        groupTodos(
            rows
        );

    Object.entries(
        groups
    ).forEach(
        (
            [
                title,
                items
            ]
        ) => {

            if (
                items.length === 0
            ) {
                return;
            }



            feed.innerHTML += `
                <div
                    class="todo-group-header">

                    ${title
                        .replace(
                            /([A-Z])/g,
                            " $1"
                        )
                        .toUpperCase()}

                </div>
            `;



            const milestones = {};
            items.forEach(item => {
                const groupKey = item.milestone_name || "Standalone Actions";
                if (!milestones[groupKey]) {
                    milestones[groupKey] = [];
                }
                milestones[groupKey].push(item);
            });

            Object.keys(milestones).forEach(milestoneName => {
                feed.innerHTML += `
                    <div class="todo-activity-header">
                        ${milestoneName}
                    </div>
                `;
                milestones[milestoneName].forEach(item => {
                            feed.innerHTML += `

                                <div
                                    class="todo-item">

                                    <span
                                        class="todo-checkbox"
                                        onclick="
                                            toggleTodoStatus(
                                                '${item.todo_id}'
                                            )">

                                        ${
                                            item.status ===
                                            "Completed"

                                                ?

                                                "☑"

                                                :

                                                "☐"
                                        }

                                    </span>

                                    <span
                                        class="
                                            todo-text
                                            ${
                                                item.status ===
                                                "Completed"

                                                    ?

                                                    "todo-completed"

                                                    :

                                                    ""
                                            }
                                        "
                                        onclick="
                                            editTodo(
                                                '${item.todo_id}'
                                            )">



                                        ${item.todo_text}

                                        ${
                                            item.due_date
                                                ?
                                                `<span class="todo-due">
                                                    ${formatDate(item.due_date)}
                                                </span>`
                                                :
                                                ""
                                        }



                                    </span>

                                </div>
                            `;

                        }
                    );
                }
            );
        }
    );

    if (
        feed.innerHTML === ""
    ) {

        feed.innerHTML =
            "<div class=\"empty-state\">No todos found</div>";
    }
}


/* ==================================
   REFRESH
================================== */

function refreshTodoView() {

    renderTodoFeed();
}






/* ==================================
   FILTER MILESTONE DROPDOWN
================================== */
function populateMilestoneFilter() {
    const dropdown = document.getElementById("milestoneFilter");
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="All">All Milestones</option>';
    milestoneData.forEach(item => {
        dropdown.innerHTML += `<option value="${item.milestone_id}">${item.milestone_name}</option>`;
    });
}

/* ==================================
   FORM MILESTONE PICKER DIRECT SELECTOR
================================== */

function populateMilestoneDropdown() {
    const dropdown = document.getElementById("milestoneId");
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">⭐ Standalone / Unassigned Action</option>';
    filteredMilestoneData.forEach(item => {
        // 🎯 FIX: Bind the actual milestone primary key as the option value
        dropdown.innerHTML += `<option value="${item.milestone_id}">${item.project_name} ➔ ${item.milestone_name}</option>`;
    });

    dropdown.innerHTML += `<option value="NEW_MILESTONE">+ Create New Milestone</option>`;
}




/* ==================================
   FILTER MILESTONES
================================== */
function filterMilestones() {
    const search = document.getElementById("milestoneSearch").value.toLowerCase();
    filteredMilestoneData = milestoneData.filter(item =>
        (item.milestone_name || "").toLowerCase().includes(search) ||
        (item.project_name || "").toLowerCase().includes(search) ||
        (item.portfolio_name || "").toLowerCase().includes(search)
    );
    populateMilestoneDropdown();
}

/* ==================================
   MILESTONE CHANGED VIEW REACTION
================================== */
function milestoneChanged() {
    const milestoneId = document.getElementById("milestoneId").value;
    const section = document.getElementById("newMilestoneSection");
    if (milestoneId === "NEW_MILESTONE") {
        section.style.display = "block";
        document.getElementById("milestoneContext").innerHTML = "New Milestone Setup";
        return;
    }
    section.style.display = "none";
    if (milestoneId === "") {
        document.getElementById("milestoneContext").innerHTML = "Standalone Action";
        return;
    }
    // 🎯 FIX: Locate the matching milestone by its correct primary identifier column key
    const milestone = milestoneData.find(x => x.milestone_id === milestoneId);
    if (!milestone) {
        document.getElementById("milestoneContext").innerHTML = "Standalone Action";
        return;
    }
    document.getElementById("milestoneContext").innerHTML = 
        `${milestone.portfolio_name} | ${milestone.project_name} | ${milestone.milestone_name}`;
}


function resetMilestoneSearch() {
    const searchInput = document.getElementById("milestoneSearch");
    if (searchInput) searchInput.value = "";
    filteredMilestoneData = [...milestoneData];
    populateMilestoneDropdown();
}




/* ==================================
   CREATE INLINE MILESTONE
================================== */
async function createInlineMilestone() {
    const name = document.getElementById("newMilestoneName").value.trim();
    const projectId = document.getElementById("newMilestoneProject").value;
    if (!name || !projectId) {
        showError("Milestone Name and Project are required");
        return null;
    }
    
    const payload = {
        milestone_name: name,
        project_id: projectId,
        target_date: document.getElementById("newMilestoneTargetDate").value || null,
        status: document.getElementById("newMilestoneStatus").value || "Open",
        enabled: true,
        display_order: 100,
        created_by: getCurrentUser(),
        updated_by: getCurrentUser()
    };
    const result = await insertData("milestone", payload);
    await loadMilestones();
    return result?.[0]?.milestone_id;
}




/* ==================================
   NEW TODO
================================== */

// ======================================
// ATTACHMENTS
// Staged files sit in memory only until Save actually succeeds —
// "upload on save", not immediate. Oversized files are rejected the
// moment they're picked and never enter the staged list at all, so
// Save can never be blocked by something that shouldn't have been
// staged in the first place.
// ======================================

let todoStagedAttachments = [];

const TODO_ATTACHMENT_BUCKET = "todo-attachments";
const TODO_ATTACHMENT_MAX_MB = 49;


function sanitizeFileNameForPath(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}


function addStagedAttachment(input) {

    const rejected = [];

    Array.from(input.files).forEach(file => {

        const sizeMB = file.size / (1024 * 1024);

        if (sizeMB > TODO_ATTACHMENT_MAX_MB) {
            rejected.push(`"${file.name}" (${sizeMB.toFixed(1)} MB)`);
            return; // never staged at all
        }

        todoStagedAttachments.push({ file, label: "" });
    });

    renderStagedAttachments(rejected);

    input.value = "";
}


function renderStagedAttachments(rejected) {

    const container = document.getElementById("todoStagedAttachments");
    if (!container) return;

    let html = "";

    todoStagedAttachments.forEach((staged, index) => {

        const sizeMB = staged.file.size / (1024 * 1024);

        html += `
            <div class="staged-attachment-row" style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--surface-alt); border-radius:6px; margin-top:6px;">
                <span style="font-size:0.9rem;">📄</span>
                <span style="font-size:0.78rem; font-weight:600; flex:1;">${staged.file.name}</span>
                <input type="text" placeholder="Label (optional)" value="${staged.label}"
                    style="font-size:0.72rem; padding:3px 6px; border:1px solid var(--border); border-radius:4px; width:130px;"
                    onchange="updateStagedAttachmentLabel(${index}, this.value)">
                <span style="font-size:0.68rem; color:var(--text-muted);">${sizeMB.toFixed(1)} MB</span>
                <span style="color:var(--danger); cursor:pointer; font-size:0.85rem;" onclick="removeStagedAttachment(${index})">✕</span>
            </div>
        `;
    });

    // One capped warning slot, updated in place rather than stacking a
    // new line on every rejected selection attempt.
    let warn = document.getElementById("todoAttachmentWarning");

    if (rejected && rejected.length > 0) {
        html += `<div id="todoAttachmentWarning" style="background:var(--danger-bg); color:var(--danger); font-size:0.72rem; padding:6px 8px; border-radius:4px; margin-top:6px;">⚠️ Too large (over ${TODO_ATTACHMENT_MAX_MB} MB), not attached: ${rejected.join(", ")}</div>`;
    }

    container.innerHTML = html;
}


function updateStagedAttachmentLabel(index, value) {
    if (todoStagedAttachments[index]) {
        todoStagedAttachments[index].label = value;
    }
}


function removeStagedAttachment(index) {
    todoStagedAttachments.splice(index, 1);
    renderStagedAttachments();
}


async function loadExistingAttachments(todoId) {

    const container = document.getElementById("todoExistingAttachments");
    if (!container) return;

    if (!todoId) {
        container.innerHTML = "";
        return;
    }

    const rows = await getData(`todo_attachments?todo_id=eq.${todoId}&order=uploaded_at.asc`);
    const attachments = Array.isArray(rows) ? rows : [];

    if (attachments.length === 0) {
        container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-faint);">No attachments yet.</div>`;
        return;
    }

    let html = "";

    for (const att of attachments) {

        const { data: signedData } = await supabaseClient
            .storage
            .from(TODO_ATTACHMENT_BUCKET)
            .createSignedUrl(att.storage_path, 3600);

        const url = signedData ? signedData.signedUrl : "#";
        const sizeMB = att.file_size ? (att.file_size / (1024 * 1024)).toFixed(1) : "?";

        html += `
            <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid var(--border);">
                <span style="font-size:0.9rem;">📄</span>
                <div style="flex:1;">
                    <a href="${url}" target="_blank" style="font-size:0.78rem; font-weight:600; color:var(--primary); text-decoration:none;">${att.label || att.file_name}</a>
                    <div style="font-size:0.66rem; color:var(--text-muted);">${att.file_name} · ${sizeMB} MB</div>
                </div>
                <span style="color:var(--danger); cursor:pointer; font-size:0.8rem;" onclick="deleteAttachment('${att.attachment_id}', '${att.storage_path}', '${todoId}')">🗑️</span>
            </div>
        `;
    }

    container.innerHTML = html;
}


async function deleteAttachment(attachmentId, storagePath, todoId) {

    if (!confirmAction("Delete this attachment?")) {
        return;
    }

    try {
        await supabaseClient.storage.from(TODO_ATTACHMENT_BUCKET).remove([storagePath]);
        await deleteData("todo_attachments", "attachment_id", attachmentId);
        await loadExistingAttachments(todoId);
        showSuccess("Attachment deleted");
    } catch (error) {
        console.error(error);
        showError("Unable to delete attachment");
    }
}


async function uploadStagedAttachments(todoId) {

    for (const staged of todoStagedAttachments) {

        const uniquePrefix = crypto.randomUUID();
        const safeName = sanitizeFileNameForPath(staged.file.name);
        const storagePath = `${todoId}/${uniquePrefix}-${safeName}`;

        const { error: uploadError } = await supabaseClient
            .storage
            .from(TODO_ATTACHMENT_BUCKET)
            .upload(storagePath, staged.file);

        if (uploadError) {
            console.error(uploadError);
            showError(`Failed to upload "${staged.file.name}" — the ToDo itself was still saved`);
            continue;
        }

        await insertData("todo_attachments", {
            todo_id: todoId,
            file_name: staged.file.name,
            storage_path: storagePath,
            file_size: staged.file.size,
            label: staged.label || null,
            uploaded_by: getCurrentUser()
        });
    }

    todoStagedAttachments = [];
}


function newTodo() {
    document.getElementById("todoId").value = "";
    document.getElementById("todoText").value = "";
    document.getElementById("dueDate").value = "";
    document.getElementById("notes").value = "";
    document.getElementById("todoStatus").value = "Open";

    todoStagedAttachments = [];
    document.getElementById("todoStagedAttachments").innerHTML = "";
    document.getElementById("todoExistingAttachments").innerHTML = "";

    resetMilestoneSearch();
    
    // 🎯 FIX: Forces the form to default to the standalone action option at index 0
    document.getElementById("milestoneId").selectedIndex = 0;
    milestoneChanged();
    
    document.getElementById("deleteTodoButton").style.display = "none";
    openModal("todoModal");
    document.getElementById("todoText").focus();
}


/* ==================================
   EDIT TODO
================================== */

function editTodo(id) {
    const item = todoData.find(x => x.todo_id === id);
    if (!item) return;

    todoStagedAttachments = [];
    document.getElementById("todoStagedAttachments").innerHTML = "";
    loadExistingAttachments(id);

    // 🎯 FIX: Force-populate dropdown items immediately to handle instant URL deep-links safely
    populateMilestoneDropdown();

    document.getElementById("todoId").value = item.todo_id;
    document.getElementById("todoText").value = item.todo_text || "";
    document.getElementById("dueDate").value = formatDateForInput(item.due_date);
    document.getElementById("notes").value = item.notes || "";
    document.getElementById("todoStatus").value = item.status || "Open";
    
    // Clear searches and bind the direct milestone relationship
    resetMilestoneSearch();
    
    // Ensure this exact assignment line is active inside your editTodo function:
    document.getElementById("milestoneId").value = item.milestone_id || "";
    milestoneChanged();

    document.getElementById("deleteTodoButton").style.display = "inline-block";
    openModal("todoModal");
    document.getElementById("todoText").focus();
}


/* ==================================
   SAVE TODO
================================== */

async function saveTodo() {
    let milestoneId = getInputValue("milestoneId");
    const todoId = getInputValue("todoId");
    const todoText = getInputValue("todoText").trim();

    if (!todoText) { showError("ToDo is required"); return; }

    if (milestoneId === "NEW_MILESTONE") {
        milestoneId = await createInlineMilestone();
        if (!milestoneId) return;
    }

    const fallbackActivityId = todoId || "00000000-0000-0000-0000-000000000000";

    // 🎯 FIX: Optional mapping. If value is "", it passes down as null to Supabase
    const payload = {
        milestone_id: milestoneId || null, 
        activity_id: fallbackActivityId,
        todo_text: todoText,
        notes: getInputValue("notes"),
        status: getInputValue("todoStatus"),
        due_date: getInputValue("dueDate") || null,
        display_order: 100,
        enabled: true,
        updated_by: getCurrentUser()
    };

    try {
        let effectiveTodoId = todoId;

        if (!todoId) {
            payload.created_by = getCurrentUser();
            const result = await insertData("todo", payload);
            effectiveTodoId = Array.isArray(result) && result[0] ? result[0].todo_id : null;
        } else {
            await updateData("todo", "todo_id", todoId, payload);
        }

        if (effectiveTodoId && todoStagedAttachments.length > 0) {
            await uploadStagedAttachments(effectiveTodoId);
        }

        closeModal("todoModal");
        await loadTodos();
        showSuccess("ToDo saved successfully");
    } catch (error) {
        console.error(error);
        showError("Unable to save ToDo");
    }
}


/* ==================================
   DELETE TODO
================================== */

async function deleteTodo(id) {

    if (
        !confirmAction(
            "Delete ToDo?"
        )
    ) {
        return;
    }

    try {

        await deleteData(
            "todo",
            "todo_id",
            id
        );

        await loadTodos();

        showSuccess(
            "ToDo deleted"
        );
    }
    catch (error) {

        console.error(
            error
        );

        showError(
            "Unable to delete ToDo"
        );
    }
}



/* ==================================
   DELETE CURRENT TODO
================================== */

function deleteCurrentTodo() {

    const id =
        document.getElementById(
            "todoId"
        ).value;

    if (!id) {
        return;
    }

    deleteTodo(id);

    closeModal(
        "todoModal"
    );
}



/* ==================================
   TOGGLE STATUS
================================== */

async function toggleTodoStatus(id) {

    const item =
        todoData.find(
            x =>
                x.todo_id === id
        );

    if (!item) {
        return;
    }

    const newStatus =

        item.status ===
        "Completed"

            ?

            "Open"

            :

            "Completed";

    try {

        await updateData(
            "todo",
            "todo_id",
            id,
            {

                status:
                    newStatus,

                updated_by:
                    getCurrentUser()
            }
        );

        await loadTodos();
    }
    catch (error) {

        console.error(
            error
        );

        showError(
            "Unable to update ToDo"
        );
    }
}


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {
            closeModal(
                "todoModal"
            );
        }

        // 🚀 ENTER KEY SHORTCUT: Save ToDo form from keyboard
        const modal = document.getElementById("todoModal");
        if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {
            // Safe guard: Ignore Enter if the cursor is active inside the multi-line notes textarea box
            if (event.key === "Enter" && document.activeElement.id !== "notes") {
                event.preventDefault(); // Prevents default form quirk submissions
                saveTodo(); // Triggers your save logic automatically!
            }
        }
    }
);