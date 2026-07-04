// PWMS AC v1.2 - REMOVE ACTIVITY FROM PWMS

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

        const matchesStatus = (status === "All") ? true : item.status === status;
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

function newTodo() {
    document.getElementById("todoId").value = "";
    document.getElementById("todoText").value = "";
    document.getElementById("dueDate").value = "";
    document.getElementById("notes").value = "";
    document.getElementById("todoStatus").value = "Open";
    
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

    // 🎯 FIX: Optional mapping. If value is "", it passes down as null to Supabase
    const payload = {
        milestone_id: milestoneId || null, 
        todo_text: todoText,
        notes: getInputValue("notes"),
        status: getInputValue("todoStatus"),
        due_date: getInputValue("dueDate") || null,
        display_order: 100,
        enabled: true,
        updated_by: getCurrentUser()
    };

    try {
        if (!todoId) {
            payload.created_by = getCurrentUser();
            await insertData("todo", payload);
        } else {
            await updateData("todo", "todo_id", todoId, payload);
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