// AC v1.6 TODO NOTES

// ======================================================
// Update Prep — assembles copy-ready prompts (written +
// spoken) from Work Digest's data model, your own style
// rules, and a reusable "last period" template. No API
// integration, no cost — you paste these into an AI
// assistant yourself, and paste the result back in for
// your own record-keeping.
//
// Settings (style/template/attachment-mode/recency, per
// format; spoken style, shared) persist in Supabase via
// update_prep_settings — a generic key/value table, so
// they follow you across devices instead of one browser.
//
// Every "Save to History" writes a row to
// update_prep_history — a genuine browsable record of
// every update produced, not just "the last one."
// ======================================================

let upMilestones = [];
let upTodos = [];
let upTaskLogs = [];

let upCurrentFormat = "manager";

const UP_STANDALONE_ID = "__standalone__";
const UP_HISTORICAL_LOOKBACK_DAYS = 14;


const UP_DEFAULT_STYLE_MANAGER =
    "### STYLE INSTRUCTIONS FOR MANAGER\n" +
    "- Write in clear, confident, executive-level language. Focus on the primary accomplishment or current state reached during the reporting period, not a list of meetings or conversations.\n" +
    "- Where multiple activities contribute to the same objective, synthesize them into a single project-level update rather than describing each activity separately.\n" +
    "- Prefer project-level language (for example assessment, evaluation, validation, commercial discussions, migration planning or deployment readiness) over activity-level language (for example discussed, reviewed, emailed or met), unless the activity itself is the only meaningful progress during the period.\n" +
    "- Where directly supported by the raw data or previous project continuity, briefly state the immediate purpose of the work (for example \"to finalize partner selection\", \"to evaluate migration feasibility\" or \"to support commercial closure\"). Do not infer downstream business impact or client sentiment.\n" +
    "- The bold status sentence should describe the most significant accomplishment or current state, synthesizing related activities into one outcome where appropriate, but do not infer progress, maturity or completion beyond what the evidence supports.\n" +
    "- Clearly distinguish what has been completed from what remains in progress or pending.\n" +
    "- Use dependency or risk framing only when it materially affects the next step, timeline or decision, not on every project and not simply to sound more executive.\n" +
    "- The Next: sentence should state the immediate next action, naming the specific dependency only when one genuinely exists.\n" +
    "- For the bracketed history line, retain whichever date is the most meaningful reference point for continuity. This may be older than the current reporting period and is not necessarily the most recent activity. Introduce a new history date only when the current period establishes a new workstream or a significant shift in direction.\n" +
    "- If there is no material activity during the reporting period, state this explicitly (for example, \"No material change this period...\") rather than omitting the project.\n\n" +
    "### DATA INTEGRITY RULES (Apply Before Style)\n" +
    "1. Synthesis must stay strictly grounded in the raw data provided. Do not infer downstream business impact, sentiment or progress (for example, strengthened the pipeline, accelerated closure or increased client confidence) unless explicitly supported by the task logs. It is acceptable to summarize related activities into the immediate outcome achieved during the reporting period.\n" +
    "2. Any dated activity within the current reporting period counts as this period's activity, even if it appears in an Open ToDos or brief-mention line. Never label a project \"No material progress this period\" if any dated activity from within the reporting period exists.\n" +
    "3. If a project name this period is a plausible continuation of a differently named project in LAST PERIOD'S UPDATE (same client or same initiative), treat them as the same project and carry forward relevant history. If genuinely uncertain, flag the ambiguity explicitly rather than silently choosing one interpretation.\n" +
    "4. It is acceptable to summarize multiple related activities into a higher-level workstream when they clearly support the same objective. The summary must remain fully supported by the raw data and must not introduce additional progress, outcomes or business impact.";


const UP_DEFAULT_STYLE_CSAIO =
    "### STYLE INSTRUCTIONS FOR CSAIO\n" +
    "- Write in clear, confident, executive-level language. Focus on the primary accomplishment or current state reached during the reporting period, not a list of meetings or conversations.\n" +
    "- Where multiple activities contribute to the same objective, synthesize them into a single project-level update rather than describing each activity separately.\n" +
    "- Prefer project-level language (for example assessment, evaluation, validation, commercial discussions, migration planning or deployment readiness) over activity-level language (for example discussed, reviewed, emailed or met), unless the activity itself is the only meaningful progress during the period.\n" +
    "- Where directly supported by the raw data or previous project continuity, briefly state the immediate purpose of the work (for example \"to finalize partner selection\", \"to evaluate migration feasibility\" or \"to support commercial closure\"). Do not infer downstream business impact or client sentiment.\n" +
    "- Each \"Key highlights of this week\" bullet should describe the accomplishment or current state for that project, synthesizing related activities into one outcome where appropriate, but do not infer progress, maturity or completion beyond what the evidence supports.\n" +
    "- Clearly distinguish what has been completed from what remains in progress or pending.\n" +
    "- Use dependency or risk framing only when it materially affects the next step, timeline or decision, not on every project and not simply to sound more executive.\n" +
    "- Each \"Key priorities for next week\" bullet should state the immediate next action for that project, naming the specific dependency only when one genuinely exists.\n" +
    "- There is no bracketed history line in this format, but check LAST PERIOD'S UPDATE for continuity — do not drop a recurring item without reason if it remains relevant this week.\n" +
    "- If there is no material activity during the reporting period, state this explicitly (for example, \"No material change this period...\") rather than omitting the project.\n\n" +
    "### DATA INTEGRITY RULES (Apply Before Style)\n" +
    "1. Synthesis must stay strictly grounded in the raw data provided. Do not infer downstream business impact, sentiment or progress (for example, strengthened the pipeline, accelerated closure or increased client confidence) unless explicitly supported by the task logs. It is acceptable to summarize related activities into the immediate outcome achieved during the reporting period.\n" +
    "2. Any dated activity within the current reporting period counts as this period's activity, even if it appears in an Open ToDos or brief-mention line. Never label a project \"No material progress this period\" if any dated activity from within the reporting period exists.\n" +
    "3. If a project name this period is a plausible continuation of a differently named project in LAST PERIOD'S UPDATE (same client or same initiative), treat them as the same project and carry forward relevant history. If genuinely uncertain, flag the ambiguity explicitly rather than silently choosing one interpretation.\n" +
    "4. It is acceptable to summarize multiple related activities into a higher-level workstream when they clearly support the same objective. The summary must remain fully supported by the raw data and must not introduce additional progress, outcomes or business impact.";


const UP_DEFAULT_SPOKEN_STYLE =
    "Based on the attached final update, provide a Speaking Version.\n" +
    "## INSTRUCTIONS\n" +
    "- Follow the same project sequence as the report.\n" +
    "- Cover every project included in the report in the same order, summarizing each in 1-3 concise sentences that cover the most significant accomplishment or current state, what remains in progress or pending and the immediate next step where relevant.\n" +
    "- Where it helps the listener understand the current update, briefly incorporate relevant historical context from the report to provide continuity. Do not repeat historical details unless they help explain the current status or next step.\n" +
    "- Sound natural when presented verbally during a leadership review, rather than reading the report word-for-word.\n" +
    "- Use simple, confident, executive-level language suitable for senior leadership.\n" +
    "- Clearly distinguish what has been completed from what remains in progress or pending.\n" +
    "- Complement the written report rather than repeating it verbatim.\n" +
    "- Do not introduce any new information, assumptions or business impact beyond what is supported by the written report.\n" +
    "- Ensure the overall flow is concise, conversational and suitable for presenting directly in the meeting.";


const UP_TEMPLATE_TWO_ATTACHMENTS =
`- Attachment 1: Previous update of the same report type. Use this as the reference for report structure, writing style and continuity for this report type.
- Attachment 2: Previous update prepared in the other reporting format, covering many of the same projects. Use this only to cross-check project continuity where relevant.
- Most recent previous update for project continuity: Attachment [__RECENCY__].
- Use the most recent previous update to preserve the latest project continuity where it does not conflict with THIS PERIOD'S RAW DATA, which always takes precedence.
- Always follow the FORMAT section for the output. Never mix the format or presentation style of the two report types.
- In addition to project continuity, use the most recent previous update as the primary reference for the reporting style, level of abstraction and project narrative.
- When the current period contains incremental activities on an ongoing initiative, continue the project narrative from the previous report rather than rewriting it solely from the individual task logs.
- Prefer evolving the previous executive summary using this period's evidence instead of producing an entirely new summary from scratch. The current period's raw data always takes precedence where there is any conflict.
- Where the previous report already established the project's objective (for example partner comparison, migration feasibility or commercial closure), retain that objective if it remains consistent with the current raw data instead of restating the underlying activities.
- When deciding between describing individual activities and describing the overall workstream, prefer the workstream if both are equally supported by the available evidence.`;


const UP_TEMPLATE_ONE_ATTACHMENT =
`- One previous update is attached for reference.
- Attachment 1: Previous update of the same report type. Use this as the reference for report structure, writing style and continuity for this report type.
- Use it only to preserve continuity where it does not conflict with THIS PERIOD'S RAW DATA, which always takes precedence.
- Always follow the FORMAT section for the output.
- When the current period contains incremental activities on an ongoing initiative, continue the project narrative from the previous report rather than rewriting it solely from the individual task logs.
- Prefer evolving the previous executive summary using this period's evidence instead of producing an entirely new summary from scratch. The current period's raw data always takes precedence where there is any conflict.
- Where the previous report already established the project's objective (for example partner comparison, migration feasibility or commercial closure), retain that objective if it remains consistent with the current raw data instead of restating the underlying activities.
- When deciding between describing individual activities and describing the overall workstream, prefer the workstream if both are equally supported by the available evidence.`;


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        initializeUpdatePrepRange();

        await loadUpdatePrepStyleIntoBox();
        await loadUpdatePrepTemplateIntoBox();
        await loadUpdatePrepSpokenStyleIntoBox();

        updateFormatLabels();

        await loadUpdatePrepData();

        rebuildUpdatePrepPrompt();

        await loadLastSavedTimestamp();
        await loadExistingHistoryIntoBoxes();
    }
);


// ======================================================
// GENERIC SETTINGS (Supabase-backed key/value store)
// ======================================================

async function getSetting(key, defaultValue) {

    const rows = await getData(`update_prep_settings?setting_key=eq.${key}`);

    if (Array.isArray(rows) && rows.length > 0 && rows[0].setting_value) {
        return rows[0].setting_value;
    }

    // First time this key is ever read — persist the default so the
    // table actually reflects what's on screen, not just showing it
    // from memory each time.
    await saveSetting(key, defaultValue);

    return defaultValue;
}


async function saveSetting(key, value) {

    const rows = await getData(`update_prep_settings?setting_key=eq.${key}`);

    if (Array.isArray(rows) && rows.length > 0) {

        await updateData("update_prep_settings", "setting_key", key, {
            setting_value: value,
            updated_at: new Date().toISOString()
        });

    } else {

        await insertData("update_prep_settings", {
            setting_key: key,
            setting_value: value
        });
    }
}


function getStyleSettingKey() {
    return (upCurrentFormat === "csaio") ? "style_csaio" : "style_manager";
}

function getTemplateSettingKey() {
    return (upCurrentFormat === "csaio") ? "template_csaio" : "template_manager";
}

function getAttachmentModeSettingKey() {
    return (upCurrentFormat === "csaio") ? "attachmentmode_csaio" : "attachmentmode_manager";
}

function getRecencySettingKey() {
    return (upCurrentFormat === "csaio") ? "recency_csaio" : "recency_manager";
}


// ======================================================
// SETUP
// ======================================================

function initializeUpdatePrepRange() {

    const today = getToday();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);

    document.getElementById("upFromDate").value = weekAgo.toISOString().split("T")[0];
    document.getElementById("upToDate").value = today;
}


function updateFormatLabels() {

    const label = (upCurrentFormat === "csaio") ? "(CSAIO)" : "(Manager)";

    document.getElementById("upFormatLabel1").textContent = label;
    document.getElementById("upFormatLabel2").textContent = label;
    document.getElementById("upFormatLabel3").textContent = label;
    document.getElementById("upFormatLabel4").textContent = label;
    document.getElementById("upFormatLabel5").textContent = label;
    document.getElementById("upFormatLabel6").textContent = label;
    document.getElementById("upFormatLabel7").textContent = label;
}


async function loadUpdatePrepStyleIntoBox() {

    const defaultText = (upCurrentFormat === "csaio") ? UP_DEFAULT_STYLE_CSAIO : UP_DEFAULT_STYLE_MANAGER;

    const value = await getSetting(getStyleSettingKey(), defaultText);

    document.getElementById("upStyleInstructions").value = value;
}


async function saveUpdatePrepStyle() {

    await saveSetting(getStyleSettingKey(), document.getElementById("upStyleInstructions").value);

    rebuildUpdatePrepPrompt();
}


async function loadUpdatePrepSpokenStyleIntoBox() {

    const value = await getSetting("spoken_style", UP_DEFAULT_SPOKEN_STYLE);

    document.getElementById("upSpokenStyle").value = value;
}


async function saveUpdatePrepSpokenStyle() {

    await saveSetting("spoken_style", document.getElementById("upSpokenStyle").value);

    rebuildSpokenPrompt();
}


// ======================================================
// LAST PERIOD'S UPDATE TEMPLATE + attachment mode/recency
// The textarea content itself is the source of truth
// (free text, editable, persisted as-is). The dropdowns
// are just quick-fill helpers, same as the date presets —
// changing one explicitly overwrites the box.
// ======================================================

async function loadUpdatePrepTemplateIntoBox() {

    const mode = await getSetting(getAttachmentModeSettingKey(), "two");
    const recency = await getSetting(getRecencySettingKey(), "2");

    document.getElementById("upAttachmentMode").value = mode;
    document.getElementById("upRecencyChoice").value = recency;
    document.getElementById("upRecencyField").style.display = (mode === "two") ? "flex" : "none";

    const defaultTemplate = buildTemplateText(mode, recency);

    const value = await getSetting(getTemplateSettingKey(), defaultTemplate);

    document.getElementById("upLastPeriodText").value = value;
}


function buildTemplateText(mode, recency) {

    if (mode === "one") {
        return UP_TEMPLATE_ONE_ATTACHMENT;
    }

    return UP_TEMPLATE_TWO_ATTACHMENTS.replace("__RECENCY__", recency);
}


async function onAttachmentModeChanged() {

    const mode = document.getElementById("upAttachmentMode").value;
    const recency = document.getElementById("upRecencyChoice").value;

    document.getElementById("upRecencyField").style.display = (mode === "two") ? "flex" : "none";

    document.getElementById("upLastPeriodText").value = buildTemplateText(mode, recency);

    await saveSetting(getAttachmentModeSettingKey(), mode);
    await saveUpdatePrepLastPeriod();
}


async function onRecencyChanged() {

    const mode = document.getElementById("upAttachmentMode").value;
    const recency = document.getElementById("upRecencyChoice").value;

    document.getElementById("upLastPeriodText").value = buildTemplateText(mode, recency);

    await saveSetting(getRecencySettingKey(), recency);
    await saveUpdatePrepLastPeriod();
}


async function saveUpdatePrepLastPeriod() {

    await saveSetting(getTemplateSettingKey(), document.getElementById("upLastPeriodText").value);

    rebuildUpdatePrepPrompt();
}


async function setUpdatePrepFormat(format) {

    upCurrentFormat = format;

    document
        .querySelectorAll(".up-format-tab")
        .forEach(tab => tab.classList.toggle("active", tab.dataset.format === format));

    updateFormatLabels();

    await loadUpdatePrepStyleIntoBox();
    await loadUpdatePrepTemplateIntoBox();

    rebuildUpdatePrepPrompt();
    rebuildSpokenPrompt();

    await loadLastSavedTimestamp();
    await loadExistingHistoryIntoBoxes();
}


function onUpdatePrepPeriodChanged() {

    rebuildUpdatePrepPrompt();

    loadLastSavedTimestamp();
    loadExistingHistoryIntoBoxes();
}


function setUpdatePrepPreset(preset) {

    const today = getToday();

    if (preset === "week") {

        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((day + 6) % 7));

        document.getElementById("upFromDate").value = monday.toISOString().split("T")[0];
        document.getElementById("upToDate").value = today;
    }

    if (preset === "7days") {

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 6);

        document.getElementById("upFromDate").value = weekAgo.toISOString().split("T")[0];
        document.getElementById("upToDate").value = today;
    }

    loadLastSavedTimestamp();
    loadExistingHistoryIntoBoxes();

    rebuildUpdatePrepPrompt();
}


// ======================================================
// DATA LOADING (same model as Work Digest)
// ======================================================

async function loadUpdatePrepData() {

    upMilestones = await getData("vw_milestone_details?enabled=eq.true");

    if (!Array.isArray(upMilestones)) {
        upMilestones = [];
    }

    upTodos = await getData("vw_todo");

    if (!Array.isArray(upTodos)) {
        upTodos = [];
    }

    upTaskLogs = await getData("vw_task_log_details?todo_id=not.is.null");

    if (!Array.isArray(upTaskLogs)) {
        upTaskLogs = [];
    }
}


async function refreshUpdatePrep() {

    await loadUpdatePrepData();

    rebuildUpdatePrepPrompt();
}


function getTodosForMilestoneUP(milestoneId) {

    if (milestoneId === UP_STANDALONE_ID) {
        return upTodos.filter(t => !t.milestone_id);
    }

    return upTodos.filter(t => t.milestone_id === milestoneId);
}


function buildUpdatePrepGroups() {

    const primaryFrom = document.getElementById("upFromDate").value;
    const primaryTo = document.getElementById("upToDate").value;

    if (!primaryFrom || !primaryTo) {
        return { groups: [], primaryFrom, primaryTo, historicalFrom: null, historicalTo: null };
    }

    const histTo = new Date(primaryFrom);
    histTo.setDate(histTo.getDate() - 1);
    const historicalTo = histTo.toISOString().split("T")[0];

    const histFrom = new Date(primaryFrom);
    histFrom.setDate(histFrom.getDate() - UP_HISTORICAL_LOOKBACK_DAYS);
    const historicalFrom = histFrom.toISOString().split("T")[0];

    const milestoneGroups = upMilestones.slice();

    const standaloneTodos = upTodos.filter(t => !t.milestone_id);

    if (standaloneTodos.length > 0) {
        milestoneGroups.push({
            milestone_id: UP_STANDALONE_ID,
            milestone_name: "Standalone ToDos",
            project_name: "Not tied to any milestone",
            portfolio_name: "",
            status: "Open",
            target_date: null
        });
    }

    const built = milestoneGroups.map(milestone => {

        const todos = getTodosForMilestoneUP(milestone.milestone_id);
        const todoIds = todos.map(t => t.todo_id);

        const allLogs = upTaskLogs.filter(l => todoIds.includes(l.todo_id));

        const primaryLogs =
            allLogs.filter(l => l.task_date >= primaryFrom && l.task_date <= primaryTo)
                .sort((a, b) => (b.task_date || "").localeCompare(a.task_date || ""));

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

        return {
            milestone,
            primaryLogs,
            historicalLogs,
            openTodos,
            hasActivity: primaryLogs.length > 0 || historicalLogs.length > 0,
            noNewActivity: primaryLogs.length === 0 && historicalLogs.length > 0
        };

    }).filter(g => g.hasActivity);

    built.sort((a, b) => {

        if (a.noNewActivity !== b.noNewActivity) {
            return a.noNewActivity ? 1 : -1;
        }

        const dateA = (a.primaryLogs[0] || a.historicalLogs[0] || {}).task_date || "";
        const dateB = (b.primaryLogs[0] || b.historicalLogs[0] || {}).task_date || "";

        return dateB.localeCompare(dateA);
    });

    return { groups: built, primaryFrom, primaryTo, historicalFrom, historicalTo };
}


// ======================================================
// WRITTEN PROMPT ASSEMBLY
// ======================================================

function rebuildUpdatePrepPrompt() {

    const { groups, primaryFrom, primaryTo, historicalFrom, historicalTo } = buildUpdatePrepGroups();

    if (!primaryFrom) {
        return;
    }

    document.getElementById("upHistoricalNote").textContent =
        `Historical context window: ${formatDate(historicalFrom)} – ${formatDate(historicalTo)}`;

    const style = document.getElementById("upStyleInstructions").value.trim();
    const lastPeriodText = document.getElementById("upLastPeriodText").value.trim();

    const formatInstructions =
        (upCurrentFormat === "csaio")
            ? UP_CSAIO_FORMAT_INSTRUCTIONS
            : UP_MANAGER_FORMAT_INSTRUCTIONS;

    let prompt = "";

    prompt += `You are helping me draft a status update.\n\n`;
    prompt += `## PERIOD: ${formatDate(primaryFrom)} to ${formatDate(primaryTo)}\n\n`;
    prompt += `## INSTRUCTIONS:\n\n${style}\n\n`;
    prompt += `${formatInstructions}\n\n`;

    if (lastPeriodText) {
        prompt += `## LAST PERIOD'S UPDATE (for continuity — decide what history to carry forward, what to drop, and what's genuinely new):\n${lastPeriodText}\n\n`;
    } else {
        prompt += `## LAST PERIOD'S UPDATE: none available (first time using this, or not yet recorded).\n\n`;
    }

    prompt += `## THIS PERIOD'S RAW DATA (grouped by project/milestone, active-this-period items first):\n\n`;

    if (groups.length === 0) {
        prompt += `(No task logs found in this period or the 14 days before it.)\n`;
    } else {
        groups.forEach(g => {
            prompt += renderGroupAsText(g);
        });
    }

    document.getElementById("upGeneratedPrompt").value = prompt;
}


const UP_MANAGER_FORMAT_INSTRUCTIONS =
`## FORMAT — Manager Update (table with two columns: Active Projects | Updates):
For each active project/milestone, write:
1. One bold status sentence describing what happened or the current state this period.
2. A "Next:" sentence describing the immediate next step.
3. Below that, a bracketed dated history line in the form "[DD-MMM] ..." carried forward from LAST PERIOD'S UPDATE where still relevant — decide whether to roll it forward to this period's date or keep an older, more meaningful anchor date, the same way a person would when the older reference is still the more useful one.
If a project has "no new activity this period" but still has open items or historical relevance, say so explicitly (e.g. "No material change since [date]") rather than omitting it or inventing progress that didn't happen.`;


const UP_CSAIO_FORMAT_INSTRUCTIONS =
`## FORMAT — CSAIO Update (table with Focus Area | Key highlights of this week | Key priorities for next week):
- Focus Areas are: Client updates, Partner updates, Product updates, Any other updates.
- Default every project/milestone into "Client updates" unless it is clearly about partner onboarding/pilots or product feature development — in this data, that will almost always be Client updates.
- Under each Focus Area, list concise bullets for "highlights this week" and separate bullets for "priorities next week."
- Within each Focus Area, order projects to maintain logical flow and continuity with the previous report rather than strictly following the order of the raw data.`;


function renderGroupAsText(g) {

    const m = g.milestone;

    let text = `### ${m.milestone_name}`;
    text += m.milestone_id === UP_STANDALONE_ID ? ` (${m.project_name})` : ` (${m.project_name || "No project"})`;
    text += `\nStatus: ${m.status}${g.noNewActivity ? " — NO NEW ACTIVITY THIS PERIOD" : ""}\n`;

    text += `This Period Task Logs:\n`;
    if (g.primaryLogs.length === 0) {
        text += `- (none)\n`;
    } else {
        g.primaryLogs.forEach(l => {
            text += `- ${formatDate(l.task_date)}: ${l.task_description || ""}\n`;
        });
    }

    text += `Open ToDos (candidates for "Next"):\n`;
    if (g.openTodos.length === 0) {
        text += `- (none)\n`;
    } else {
        g.openTodos.forEach(t => {
            text += `- ${t.todo_text}${t.due_date ? ` (due ${formatDate(t.due_date)})` : ""}\n`;

            const notePreview = getNotesPreview(t.notes);
            if (notePreview) {
                text += `  Notes: ${notePreview}\n`;
            }
        });
    }

    text += `Historical context (${UP_HISTORICAL_LOOKBACK_DAYS} days before this period):\n`;
    if (g.historicalLogs.length === 0) {
        text += `- (none)\n`;
    } else {
        g.historicalLogs.forEach(l => {
            text += `- ${formatDate(l.task_date)}: ${l.task_description || ""}\n`;
        });
    }

    text += `\n`;

    return text;
}


function copyUpdatePrepPrompt() {

    const textarea = document.getElementById("upGeneratedPrompt");

    textarea.select();

    navigator.clipboard
        .writeText(textarea.value)
        .then(() => showSuccess("Prompt copied to clipboard"))
        .catch(() => showError("Unable to copy — please select and copy manually"));
}


// ======================================================
// SPOKEN VERSION
// Source = the finished WRITTEN update you paste in below
// (not raw Work Digest data). CSAIO only gets one extra
// input: last period's saved finished CSAIO update, pulled
// from history, purely for progression/continuity language
// that the CSAIO written format itself doesn't carry —
// Manager's written format already has bracketed history
// lines, so it doesn't need this.
// ======================================================

function syncFinishedUpdateToSpokenSource() {

    // Auto-sync convenience default, per your explicit confirmation — the
    // spoken version is almost always based on the same finished update
    // you just saved above. Still freely editable afterward if you want
    // the spoken version based on different text for a given period.
    document.getElementById("upWrittenSourceForSpoken").value =
        document.getElementById("upFinishedUpdate").value;

    rebuildSpokenPrompt();
}


async function rebuildSpokenPrompt() {

    const spokenStyle = document.getElementById("upSpokenStyle").value.trim();
    const writtenSource = document.getElementById("upWrittenSourceForSpoken").value.trim();

    let prompt = "";

    prompt += `${spokenStyle}\n\n`;

    if (upCurrentFormat === "csaio") {

        const priorCsaio = await getMostRecentFinishedUpdate("csaio");

        if (priorCsaio) {
            prompt += `## ADDITIONAL CONTEXT (CSAIO only)\nLast period's finished CSAIO update is provided below for continuity — use it only to inform historical framing, not as new content to report on.\n${priorCsaio}\n\n`;
        }
    }

    if (writtenSource) {
        prompt += `## FINAL WRITTEN UPDATE (this is what to convert to a speaking version)\n${writtenSource}\n`;
    } else {
        prompt += `## FINAL WRITTEN UPDATE: paste the finished written update above, or attach it as an image alongside this prompt.\n`;
    }

    document.getElementById("upSpokenPrompt").value = prompt;
}


async function getMostRecentFinishedUpdate(format) {

    const primaryTo = document.getElementById("upToDate").value;

    const rows =
        await getData(`update_prep_history?format=eq.${format}&finished_update=not.is.null&period_to=lt.${primaryTo}&order=period_to.desc&limit=1`);

    if (Array.isArray(rows) && rows.length > 0) {
        return rows[0].finished_update;
    }

    return null;
}


function copySpokenPrompt() {

    const textarea = document.getElementById("upSpokenPrompt");

    textarea.select();

    navigator.clipboard
        .writeText(textarea.value)
        .then(() => showSuccess("Spoken prompt copied to clipboard"))
        .catch(() => showError("Unable to copy — please select and copy manually"));
}


// ======================================================
// HISTORY SAVING
// A row is identified by format + exact period dates,
// looked up fresh from the database every time — not
// tracked in a JS variable, so it survives page reloads,
// tab switches, and writing/speaking on different days.
// ======================================================

async function loadExistingHistoryIntoBoxes() {

    const existingId = await findExistingHistoryRow();

    const finishedUpdateBox = document.getElementById("upFinishedUpdate");
    const finishedSpokenBox = document.getElementById("upFinishedSpoken");
    const sourceBox = document.getElementById("upWrittenSourceForSpoken");

    const updateTag = document.getElementById("upRetrievedTagUpdate");
    const spokenTag = document.getElementById("upRetrievedTagSpoken");
    const sourceTag = document.getElementById("upRetrievedTagSource");

    if (!existingId) {
        finishedUpdateBox.value = "";
        finishedSpokenBox.value = "";
        sourceBox.value = "";
        updateTag.style.display = "none";
        spokenTag.style.display = "none";
        sourceTag.style.display = "none";
        rebuildSpokenPrompt();
        return;
    }

    const rows = await getData(`update_prep_history?history_id=eq.${existingId}`);

    if (!Array.isArray(rows) || rows.length === 0) {
        return;
    }

    const savedUpdate = rows[0].finished_update || "";
    const savedSpoken = rows[0].finished_spoken || "";

    finishedUpdateBox.value = savedUpdate;
    finishedSpokenBox.value = savedSpoken;
    sourceBox.value = savedUpdate;

    updateTag.style.display = savedUpdate ? "inline" : "none";
    spokenTag.style.display = savedSpoken ? "inline" : "none";
    sourceTag.style.display = savedUpdate ? "inline" : "none";

    rebuildSpokenPrompt();
}


async function findExistingHistoryRow() {

    const primaryFrom = document.getElementById("upFromDate").value;
    const primaryTo = document.getElementById("upToDate").value;

    const rows = await getData(
        `update_prep_history?format=eq.${upCurrentFormat}&period_from=eq.${primaryFrom}&period_to=eq.${primaryTo}&order=created_at.desc&limit=1`
    );

    return (Array.isArray(rows) && rows.length > 0) ? rows[0].history_id : null;
}


async function ensureCurrentHistoryRow(extraFields) {

    const primaryFrom = document.getElementById("upFromDate").value;
    const primaryTo = document.getElementById("upToDate").value;

    const existingId = await findExistingHistoryRow();

    if (existingId) {

        await updateData("update_prep_history", "history_id", existingId, extraFields);
        return existingId;
    }

    const payload = {
        format: upCurrentFormat,
        period_from: primaryFrom,
        period_to: primaryTo,
        ...extraFields
    };

    const inserted = await insertData("update_prep_history", payload);

    return (Array.isArray(inserted) && inserted.length > 0) ? inserted[0].history_id : null;
}


async function saveUpdatePrepToHistory() {

    const finishedUpdate = document.getElementById("upFinishedUpdate").value.trim();
    const finishedSpoken = document.getElementById("upFinishedSpoken").value.trim();

    if (!finishedUpdate && !finishedSpoken) {
        showError("Nothing to save — paste a finished update or spoken version first");
        return;
    }

    const extraFields = { updated_at: new Date().toISOString() };

    if (finishedUpdate) {
        extraFields.generated_prompt = document.getElementById("upGeneratedPrompt").value;
        extraFields.finished_update = finishedUpdate;
    }

    if (finishedSpoken) {
        extraFields.spoken_prompt = document.getElementById("upSpokenPrompt").value;
        extraFields.finished_spoken = finishedSpoken;
    }

    try {

        await ensureCurrentHistoryRow(extraFields);

        showSuccess("Saved to history");

        await loadLastSavedTimestamp();

    } catch (error) {

        console.error(error);
        showError("Unable to save to history");
    }
}


async function loadLastSavedTimestamp() {

    const label = document.getElementById("upLastSavedLabel");

    const existingId = await findExistingHistoryRow();

    if (!existingId) {
        label.textContent = "Not saved yet for this period";
        return;
    }

    const rows = await getData(`update_prep_history?history_id=eq.${existingId}`);

    if (Array.isArray(rows) && rows.length > 0 && rows[0].updated_at) {
        label.textContent = `Last saved: ${formatDateTime(rows[0].updated_at)}`;
    } else {
        label.textContent = "Not saved yet for this period";
    }
}
