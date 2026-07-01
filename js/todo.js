// PWMS AC

/* ==================================
   DATA
================================== */

let todoData = [];

let activityData = [];

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

        await loadMilestones();

        populatePriorityDropdown();

        await loadActivities();

        await loadTodos();

        // 🚀 NEW: Instantly ready to search without clicking
        document.getElementById("searchText")?.focus();


        // 🚀 NEW: Auto-open form if launched from the universal accelerator button
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            newTodo(); // Instantly fire your form modal open loop
        }

    }
);


/* ==================================
   LOAD ACTIVITIES
================================== */

async function loadActivities() {

    activityData =
        await getData(
            "vw_activity_details?enabled=eq.true&order=activity_name.asc"
        );

    if (!Array.isArray(activityData)) {

        console.error(
            activityData
        );

        activityData = [];

        showError(
            "Unable to load activities"
        );

        return;
    }

    filteredActivityData =
        [...activityData];

    populateActivityDropdown();

    populateActivityFilter();

    populateMilestoneDropdown();
}


/* ==================================
   LOAD MILESTONES
================================== */

async function loadMilestones() {

    milestoneData =
        await getData(
            "vw_milestone_details?enabled=eq.true&order=milestone_name.asc"
        );

    populateMilestoneDropdown();
}


/* ==================================
   PRIORITY
================================== */

function populatePriorityDropdown() {

    const dropdown =
        document.getElementById(
            "newActivityPriority"
        );

    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = "";

    MASTERS.ACTIVITY_PRIORITY
        .forEach(
            item => {

                dropdown.innerHTML += `
                    <option value="${item}">
                        ${item}
                    </option>
                `;
            }
        );
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
   FILTER ACTIVITY
================================== */

function populateActivityFilter() {

    const dropdown =
        document.getElementById(
            "activityFilter"
        );

    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = `
        <option value="All">
            All Activities
        </option>
    `;

    activityData.forEach(
        item => {

            dropdown.innerHTML += `
                <option value="${item.activity_id}">
                    ${item.activity_name}
                </option>
            `;
        }
    );
}


/* ==================================
   FILTER TODOS
================================== */

function getFilteredTodos() {

    const search =
        document
            .getElementById(
                "searchText"
            )
            .value
            .toLowerCase();

    const status =
        document
            .getElementById(
                "statusFilter"
            )
            .value;

    const activity =
        document
            .getElementById(
                "activityFilter"
            )
            .value;

    return todoData.filter(
        item => {

            const matchesSearch =

                (item.todo_text || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.notes || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.activity_name || "")
                    .toLowerCase()
                    .includes(search);

            let matchesStatus =
                true;

            if (
                status !== "All"
            ) {

                matchesStatus =
                    item.status ===
                    status;
            }

            let matchesActivity =
                true;

            if (
                activity !== "All"
            ) {

                matchesActivity =
                    item.activity_id ===
                    activity;
            }

            return (

                matchesSearch

                &&

                matchesStatus

                &&

                matchesActivity
            );
        }
    );
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



            const activities =
                {};

            items.forEach(
                item => {

                    if (
                        !activities[
                            item.activity_name
                        ]
                    ) {

                        activities[
                            item.activity_name
                        ] = [];
                    }

                    activities[
                        item.activity_name
                    ].push(
                        item
                    );
                }
            );

            Object.keys(
                activities
            ).forEach(
                activity => {

                    feed.innerHTML += `
                        <div
                            class="todo-activity-header">

                            ${activity}

                        </div>
                    `;

                    activities[
                        activity
                    ].forEach(
                        item => {


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
   ACTIVITY DROPDOWN
================================== */

function populateActivityDropdown() {

    const dropdown =
        document.getElementById(
            "activityId"
        );

    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = `
        <option value="">
            Select Activity
        </option>
    `;

    filteredActivityData
        .forEach(
            item => {

                dropdown.innerHTML += `
                    <option
                        value="${item.activity_id}">

                        ${item.activity_name}

                    </option>
                `;
            }
        );

    dropdown.innerHTML += `
        <option
            value="NEW_ACTIVITY">

            + Create New Activity

        </option>
    `;
}


/* ==================================
   MILESTONE DROPDOWN
================================== */

function populateMilestoneDropdown() {

    const dropdown =
        document.getElementById(
            "newActivityMilestone"
        );

    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = `
        <option value="">
            Standalone Activity
        </option>
    `;

    milestoneData
        .forEach(
            item => {

                dropdown.innerHTML += `
                    <option
                        value="${item.milestone_id}">

                        ${item.portfolio_name}
                        |
                        ${item.project_name}
                        |
                        ${item.milestone_name}

                    </option>
                `;
            }
        );
}


/* ==================================
   FILTER ACTIVITIES
================================== */

function filterActivities() {

    const search =
        document
            .getElementById(
                "activitySearch"
            )
            .value
            .toLowerCase();

    filteredActivityData =
        activityData.filter(
            item =>

                (item.activity_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.milestone_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.project_name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (item.portfolio_name || "")
                    .toLowerCase()
                    .includes(search)
        );

    populateActivityDropdown();
}


/* ==================================
   ACTIVITY CHANGED
================================== */

function activityChanged() {

    const activityId =
        document
            .getElementById(
                "activityId"
            )
            .value;

    const section =
        document
            .getElementById(
                "newActivitySection"
            );

    if (
        activityId ===
        "NEW_ACTIVITY"
    ) {

        section.style.display =
            "block";

        document
            .getElementById(
                "activityContext"
            )
            .innerHTML =
                "New Activity";

        return;
    }

    section.style.display =
        "none";

    const activity =
        activityData.find(
            x =>
                x.activity_id ===
                activityId
        );

    if (!activity) {

        document
            .getElementById(
                "activityContext"
            )
            .innerHTML =
                "Select Activity";

        return;
    }

    document
        .getElementById(
            "activityContext"
        )
        .innerHTML =

        activity.milestone_id

            ?

            `${activity.portfolio_name}
             |
             ${activity.project_name}
             |
             ${activity.milestone_name}`

            :

            "Standalone Activity";
}


/* ==================================
   RESET SEARCH
================================== */

function resetActivitySearch() {

    document
        .getElementById(
            "activitySearch"
        )
        .value = "";

    filteredActivityData =
        [...activityData];

    populateActivityDropdown();
}


/* ==================================
   CREATE INLINE ACTIVITY
================================== */

async function createInlineActivity() {

    const activityName =
        getInputValue(
            "newActivityName"
        )
        .trim();

    if (!activityName) {

        showError(
            "Activity Name is required"
        );

        return null;
    }

    const payload = {

        activity_name:
            activityName,

        milestone_id:
            getInputValue(
                "newActivityMilestone"
            ) || null,

        target_date:
            getInputValue(
                "newActivityTargetDate"
            ) || null,

        priority:
            getInputValue(
                "newActivityPriority"
            ) || "Medium",

        status:
            "Not Started",

        display_order:
            100,

        enabled:
            true,

        created_by:
            getCurrentUser(),

        updated_by:
            getCurrentUser()
    };

    const result =
        await insertData(
            "activity",
            payload
        );

    await loadActivities();

    return result?.[0]
        ?.activity_id;
}


/* ==================================
   NEW TODO
================================== */

function newTodo() {

    document
        .getElementById(
            "todoId"
        )
        .value = "";

    document
        .getElementById(
            "todoText"
        )
        .value = "";

    document
        .getElementById(
            "dueDate"
        )
        .value = "";

    document
        .getElementById(
            "notes"
        )
        .value = "";

    document
        .getElementById(
            "todoStatus"
        )
        .value = "Open";

    resetActivitySearch();

    document
        .getElementById(
            "activityId"
        )
        .selectedIndex = 0;

    activityChanged();


    document.getElementById(
        "deleteTodoButton"
    ).style.display =
        "none";


    openModal(
        "todoModal"
    );

    document
        .getElementById(
            "todoText"
        )
        .focus();
}


/* ==================================
   EDIT TODO
================================== */

function editTodo(id) {

    const item =
        todoData.find(
            x =>
                x.todo_id === id
        );

    if (!item) {
        return;
    }

    document.getElementById(
        "todoId"
    ).value =
        item.todo_id;

    document.getElementById(
        "todoText"
    ).value =
        item.todo_text || "";

    document.getElementById(
        "dueDate"
    ).value =
        formatDateForInput(
            item.due_date
        );

    document.getElementById(
        "notes"
    ).value =
        item.notes || "";

    document.getElementById(
        "todoStatus"
    ).value =
        item.status || "Open";

    resetActivitySearch();

    document.getElementById(
        "activityId"
    ).value =
        item.activity_id;

    activityChanged();



    document.getElementById(
        "deleteTodoButton"
    ).style.display =
        "inline-block";



    openModal(
        "todoModal"
    );

    document.getElementById(
        "todoText"
    ).focus();
}


/* ==================================
   SAVE TODO
================================== */

async function saveTodo() {

    let activityId =
        getInputValue(
            "activityId"
        );

    const todoId =
        getInputValue(
            "todoId"
        );

    const todoText =
        getInputValue(
            "todoText"
        ).trim();

    if (!todoText) {

        showError(
            "ToDo is required"
        );

        return;
    }

    if (
        activityId ===
        "NEW_ACTIVITY"
    ) {

        activityId =
            await createInlineActivity();

        if (!activityId) {
            return;
        }
    }

    if (!activityId) {

        showError(
            "Activity is required"
        );

        return;
    }

    const payload = {

        activity_id:
            activityId,

        todo_text:
            todoText,

        notes:
            getInputValue(
                "notes"
            ),

        status:
            getInputValue(
                "todoStatus"
            ),

        due_date:
            getInputValue(
                "dueDate"
            ) || null,

        display_order:
            100,

        enabled:
            true,

        updated_by:
            getCurrentUser()
    };

    try {

        if (!todoId) {

            payload.created_by =
                getCurrentUser();

            await insertData(
                "todo",
                payload
            );
        }
        else {

            await updateData(
                "todo",
                "todo_id",
                todoId,
                payload
            );
        }

        closeModal(
            "todoModal"
        );

        await loadTodos();

        showSuccess(
            "ToDo saved successfully"
        );
    }
    catch (error) {

        console.error(
            error
        );

        showError(
            "Unable to save ToDo"
        );
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