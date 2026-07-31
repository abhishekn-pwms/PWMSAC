// AC v1.7e UPDATEPREPATTACH

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
    "- When meetings, workshops, demonstrations, document reviews or similar activities contribute to a broader objective, report the resulting workstream or outcome (for example assessment, implementation planning, commercial refinement or solution scoping) rather than the activities themselves. Mention the individual activities only when they represent the primary accomplishment of the reporting period. \n" +
    "- Where directly supported by the raw data or previous project continuity, briefly state the immediate purpose of the work (for example \"to finalize partner selection\", \"to evaluate migration feasibility\" or \"to support commercial closure\"). Do not infer downstream business impact or client sentiment.\n" +
    "- The bold status sentence should describe the most significant accomplishment or current state, synthesizing related activities into one outcome where appropriate, but do not infer progress, maturity or completion beyond what the evidence supports.\n" +
    "- Clearly distinguish what has been completed from what remains in progress or pending.\n" +
    "- Use dependency or risk framing only when it materially affects the next step, timeline or decision, not on every project and not simply to sound more executive.\n\n" +
    "#### Weekly Progression & Continuity\n" +
    "- Treat each weekly update as a continuation of the previous manager review, not as a standalone status report.\n" +
    "- The bold status sentence must describe only what changed during the current reporting period, always grounded in THIS PERIOD'S RAW DATA — never in the history line or the previous update's narrative. Avoid repeating information already captured in the history line unless necessary to explain the current update.\n" +
    "- The bracketed history line should normally be carried forward from the previous manager review, and only replaced when the current period establishes a new workstream or a significant shift in direction.\n" +
    "- Re-evaluate the history line's anchor date every period rather than copying it by default — carrying forward the same reference without checking whether it's still the most useful one is a failure, not a safe choice. When several projects genuinely share no new activity, each one's history line must still reflect that project's own most recent meaningful anchor, not a single repeated block across projects.\n\n" +
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
    "- When meetings, workshops, demonstrations, document reviews or similar activities contribute to a broader objective, summarize the resulting workstream or outcome in the \"Key highlights of this week\" (for example assessment, implementation planning, commercial refinement or solution scoping) rather than the individual activities. Mention the activities only when they themselves represent the primary accomplishment of the reporting period. \n" +
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
    "- Cover every project in the same order. For each project, explain what changed during the current reporting period, the current state and the immediate next step where relevant, using 1-3 concise sentences.\n" +
    "- Where relevant, naturally connect the current update to the previous reporting period so the listener understands how the work has progressed. Do not repeat historical details unless they help explain the current status or next step.\n" +
    "- Lead each project update with the most significant milestone or current state achieved during the reporting period before describing work that remains in progress or pending.\n" +
    "- Sound natural when presented verbally during a leadership review, rather than reading the report word-for-word.\n" +
    "- Speak like a senior leader giving a progress briefing rather than a presenter reading project notes.\n" +
    "- Use simple, confident, executive-level language suitable for senior leadership.\n" +
    "- Clearly distinguish what has been completed from what remains in progress or pending.\n" +
    "- Complement the written report rather than paraphrasing it. Explain the progression of each project in a natural, conversational manner suitable for verbal delivery.\n" +
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
        await loadReferenceAttachments();

        const pasteZone = document.getElementById("upAttachmentPasteZone");
        if (pasteZone) {
            pasteZone.addEventListener("paste", handleUpAttachmentPaste);
        }
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
    await loadReferenceAttachments();
}


function onUpdatePrepPeriodChanged() {

    rebuildUpdatePrepPrompt();

    loadLastSavedTimestamp();
    loadExistingHistoryIntoBoxes();
    loadReferenceAttachments();
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
    loadReferenceAttachments();

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
        await loadExistingUpAttachment(null);
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

    await loadExistingUpAttachment(existingId);
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

        const historyId = await ensureCurrentHistoryRow(extraFields);

        if (finishedUpdate && upStagedAttachment) {
            await uploadStagedUpAttachment(historyId);
        }

        showSuccess("Saved to history");

        await loadLastSavedTimestamp();
        await loadExistingUpAttachment(historyId);

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


// ======================================================
// SCREENSHOT ATTACHMENT — written update only, one file
// per saved update_prep_history row (replace, not add).
// Mirrors ToDo's attachment pattern but single-file, and
// only ever uploads once a history row genuinely exists.
// ======================================================

let upStagedAttachment = null;
let upStagedAttachmentPreviewUrl = null;
let upStagedAttachmentLabel = "";
let upExistingAttachmentPreview = null;

const UP_ATTACHMENT_BUCKET = "updateprep-attachments";
const UP_ATTACHMENT_MAX_MB = 49;


function sanitizeUpFileNameForPath(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}


function formatUpDateForLabel(dateStr) {

    if (!dateStr) return "";

    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;

    const [year, month, day] = parts;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(month, 10) - 1;

    if (monthIndex < 0 || monthIndex > 11) return dateStr;

    return `${day} ${months[monthIndex]} ${year}`;
}


function buildDefaultUpAttachmentLabel() {

    const formatLabel = upCurrentFormat === "manager" ? "Manager" : "CSAIO";
    const fromDate = document.getElementById("upFromDate").value;
    const toDate = document.getElementById("upToDate").value;

    return `${formatLabel} ${formatUpDateForLabel(fromDate)} to ${formatUpDateForLabel(toDate)}`;
}


function escapeUpAttrValue(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}


function addStagedUpAttachment(input) {

    const file = input.files[0];
    input.value = "";

    if (!file) {
        return;
    }

    stageUpAttachmentFile(file);
}


function stageUpAttachmentFile(file) {

    const sizeMB = file.size / (1024 * 1024);

    if (sizeMB > UP_ATTACHMENT_MAX_MB) {
        showError(`"${file.name}" (${sizeMB.toFixed(1)} MB) is too large — max ${UP_ATTACHMENT_MAX_MB} MB`);
        return;
    }

    if (upStagedAttachmentPreviewUrl) {
        URL.revokeObjectURL(upStagedAttachmentPreviewUrl);
    }

    upStagedAttachment = file;
    upStagedAttachmentPreviewUrl = URL.createObjectURL(file);
    upStagedAttachmentLabel = buildDefaultUpAttachmentLabel();

    renderStagedUpAttachment();
}


function handleUpAttachmentPaste(event) {

    const items = (event.clipboardData || window.clipboardData).items;

    for (const item of items) {

        if (item.type.indexOf("image/") === 0) {

            const file = item.getAsFile();

            if (file) {
                const renamedFile = new File([file], `snip-${Date.now()}.png`, { type: file.type });
                stageUpAttachmentFile(renamedFile);
            }

            event.preventDefault();
            break;
        }
    }
}


function updateStagedUpAttachmentLabel(value) {
    upStagedAttachmentLabel = value;
}


function renderStagedUpAttachment() {

    const container = document.getElementById("upStagedAttachment");
    if (!container) return;

    if (!upStagedAttachment) {
        container.innerHTML = "";
        return;
    }

    const sizeMB = upStagedAttachment.size / (1024 * 1024);

    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; padding:6px 8px; background:var(--surface-alt); border-radius:6px; margin-top:6px;">
            <img src="${upStagedAttachmentPreviewUrl}" style="width:48px; height:48px; object-fit:cover; border-radius:4px; border:1px solid var(--border); cursor:pointer; flex-shrink:0;" onclick="openScreenshotModal(-1)">
            <div style="flex:1; min-width:0;">
                <input type="text" value="${escapeUpAttrValue(upStagedAttachmentLabel)}" oninput="updateStagedUpAttachmentLabel(this.value)" style="width:100%; font-size:0.78rem; font-weight:600; border:0.5px solid var(--border); border-radius:4px; padding:3px 6px; background:var(--surface); box-sizing:border-box;">
                <div style="font-size:0.66rem; color:var(--text-muted); margin-top:3px;">${sizeMB.toFixed(1)} MB · click thumbnail to check it before saving · saves with next "Save to History"</div>
            </div>
            <span style="color:var(--danger); cursor:pointer; font-size:0.85rem; flex-shrink:0;" onclick="clearStagedUpAttachment()">✕</span>
        </div>
    `;
}


function clearStagedUpAttachment() {

    if (upStagedAttachmentPreviewUrl) {
        URL.revokeObjectURL(upStagedAttachmentPreviewUrl);
    }

    upStagedAttachment = null;
    upStagedAttachmentPreviewUrl = null;
    upStagedAttachmentLabel = "";

    renderStagedUpAttachment();
}


async function loadExistingUpAttachment(historyId) {

    const container = document.getElementById("upExistingAttachment");
    const pickerLabel = document.getElementById("upAttachmentPickerLabel");

    if (!container) return;

    if (!historyId) {
        container.innerHTML = "";
        if (pickerLabel) pickerLabel.textContent = "Add Screenshot";
        upExistingAttachmentPreview = null;
        return;
    }

    const rows = await getData(`update_prep_attachments?history_id=eq.${historyId}`);
    const attachment = (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;

    if (!attachment) {
        container.innerHTML = "";
        if (pickerLabel) pickerLabel.textContent = "Add Screenshot";
        upExistingAttachmentPreview = null;
        return;
    }

    if (pickerLabel) pickerLabel.textContent = "Replace Screenshot";

    const { data: signedData } = await supabaseClient
        .storage
        .from(UP_ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, 3600);

    const url = signedData ? signedData.signedUrl : null;
    const sizeMB = attachment.file_size ? (attachment.file_size / (1024 * 1024)).toFixed(1) : "?";
    const displayLabel = attachment.label || attachment.file_name;

    upExistingAttachmentPreview = { url, label: displayLabel };

    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; padding:6px 8px; border-bottom:1px solid var(--border); margin-top:6px;">
            <img src="${url}" style="width:48px; height:48px; object-fit:cover; border-radius:4px; border:1px solid var(--border); cursor:pointer;" onclick="openScreenshotModal(-2)">
            <div style="flex:1;">
                <div style="font-size:0.78rem; font-weight:600;">${displayLabel}</div>
                <div style="font-size:0.66rem; color:var(--text-muted);">${sizeMB} MB</div>
            </div>
            <span style="color:var(--danger); cursor:pointer; font-size:0.8rem;" onclick="deleteUpAttachment('${attachment.attachment_id}', '${attachment.storage_path}', '${historyId}')">🗑️</span>
        </div>
    `;
}


async function deleteUpAttachment(attachmentId, storagePath, historyId) {

    if (!confirmAction("Delete this screenshot?")) {
        return;
    }

    try {
        await supabaseClient.storage.from(UP_ATTACHMENT_BUCKET).remove([storagePath]);
        await deleteData("update_prep_attachments", "attachment_id", attachmentId);
        await loadExistingUpAttachment(historyId);
        showSuccess("Screenshot deleted");
    } catch (error) {
        console.error(error);
        showError("Unable to delete screenshot");
    }
}


async function uploadStagedUpAttachment(historyId) {

    if (!upStagedAttachment || !historyId) {
        return;
    }

    // Enforce "one per history row" at the app level too —
    // replace whatever is already there rather than adding.
    const existingRows = await getData(`update_prep_attachments?history_id=eq.${historyId}`);

    if (Array.isArray(existingRows) && existingRows.length > 0) {

        const existing = existingRows[0];

        await supabaseClient.storage.from(UP_ATTACHMENT_BUCKET).remove([existing.storage_path]);
        await deleteData("update_prep_attachments", "attachment_id", existing.attachment_id);
    }

    const uniquePrefix = crypto.randomUUID();
    const safeName = sanitizeUpFileNameForPath(upStagedAttachment.name);
    const storagePath = `${historyId}/${uniquePrefix}-${safeName}`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from(UP_ATTACHMENT_BUCKET)
        .upload(storagePath, upStagedAttachment);

    if (uploadError) {
        console.error(uploadError);
        showError(`Failed to upload screenshot — the update itself was still saved`);
        clearStagedUpAttachment();
        return;
    }

    await insertData("update_prep_attachments", {
        history_id: historyId,
        file_name: upStagedAttachment.name,
        storage_path: storagePath,
        file_size: upStagedAttachment.size,
        label: upStagedAttachmentLabel || null,
        uploaded_by: getCurrentUser()
    });

    clearStagedUpAttachment();
}


// ======================================================
// REFERENCE SCREENSHOTS PANEL — last 2 saved screenshots
// per format (Manager, CSAIO), newest first, so the user
// no longer has to reopen last period's slide/doc and
// re-snip it manually before drafting this period's update.
// ======================================================

let upReferenceSlots = [];


async function loadReferenceAttachments() {

    const container = document.getElementById("upReferenceAttachments");
    if (!container) return;

    const fromDate = document.getElementById("upFromDate").value;

    upReferenceSlots = [];

    const formatSections = [
        { key: "manager", label: "Manager" },
        { key: "csaio", label: "CSAIO" }
    ];

    const sectionsHtml = [];

    for (const section of formatSections) {

        let historyRows = [];

        if (fromDate) {

            const rows = await getData(
                `update_prep_history?format=eq.${section.key}&period_from=lt.${fromDate}&order=period_from.desc&limit=2`
            );

            historyRows = Array.isArray(rows) ? rows : [];
        }

        const slotsHtml = [];

        for (let i = 0; i < 2; i++) {

            const row = historyRows[i];

            if (!row) {
                slotsHtml.push(buildEmptyReferenceSlot(null));
                continue;
            }

            const attachmentRows = await getData(`update_prep_attachments?history_id=eq.${row.history_id}`);
            const attachment = (Array.isArray(attachmentRows) && attachmentRows.length > 0) ? attachmentRows[0] : null;

            if (!attachment) {
                slotsHtml.push(buildEmptyReferenceSlot(row));
                continue;
            }

            const { data: signedData } = await supabaseClient
                .storage
                .from(UP_ATTACHMENT_BUCKET)
                .createSignedUrl(attachment.storage_path, 3600);

            const url = signedData ? signedData.signedUrl : null;

            if (!url) {
                slotsHtml.push(buildEmptyReferenceSlot(row));
                continue;
            }

            const captionLabel = attachment.label || formatUpPeriodLabel(row);

            const slotIndex = upReferenceSlots.length;
            upReferenceSlots.push({ url, label: `${section.label} — ${captionLabel}` });

            slotsHtml.push(buildFilledReferenceSlot(captionLabel, slotIndex));
        }

        sectionsHtml.push(`
            <div>
                <div style="font-size:0.85rem; font-weight:600; margin-bottom:8px;">${section.label}</div>
                <div style="display:flex; gap:10px;">
                    ${slotsHtml.join("")}
                </div>
            </div>
        `);
    }

    container.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; width:100%;">
            ${sectionsHtml.join("")}
        </div>
    `;
}


function formatUpPeriodLabel(row) {
    if (!row) return "No record";
    return `${row.period_from} to ${row.period_to}`;
}


function buildEmptyReferenceSlot(row) {

    return `
        <div style="flex:1;">
            <div style="aspect-ratio:4/3; background:var(--surface-alt); border:1px dashed var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.65rem; color:var(--text-muted); text-align:center; padding:4px;">
                No record
            </div>
            <div style="font-size:0.66rem; color:var(--text-muted); text-align:center; margin-top:4px;">${formatUpPeriodLabel(row)}</div>
        </div>
    `;
}


function buildFilledReferenceSlot(captionLabel, slotIndex) {

    const slot = upReferenceSlots[slotIndex];

    return `
        <div style="flex:1;">
            <div style="aspect-ratio:4/3; border-radius:6px; overflow:hidden; border:1px solid var(--border); cursor:pointer;" onclick="openScreenshotModal(${slotIndex})">
                <img src="${slot.url}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="font-size:0.66rem; color:var(--text-secondary); text-align:center; margin-top:4px;">${captionLabel}</div>
        </div>
    `;
}


// ======================================================
// FULL-SIZE SCREENSHOT MODAL — used by staged (-1),
// currently saved (-2), and reference panel (0+) thumbnails
// ======================================================

let upScreenshotModalCurrentUrl = null;


function openScreenshotModal(index) {

    let url = null;
    let label = "";

    if (index === -1) {

        if (!upStagedAttachmentPreviewUrl) return;

        url = upStagedAttachmentPreviewUrl;
        label = "Staged screenshot (not yet saved)";

    } else if (index === -2) {

        if (!upExistingAttachmentPreview || !upExistingAttachmentPreview.url) return;

        url = upExistingAttachmentPreview.url;
        label = upExistingAttachmentPreview.label;

    } else {

        const slot = upReferenceSlots[index];
        if (!slot || !slot.url) return;

        url = slot.url;
        label = slot.label;
    }

    document.getElementById("upScreenshotModalTitle").textContent = label;
    document.getElementById("upScreenshotModalImg").src = url;
    upScreenshotModalCurrentUrl = url;

    openModal("upScreenshotModal");
}


async function copyScreenshotModalImage() {

    if (!upScreenshotModalCurrentUrl) return;

    try {

        const response = await fetch(upScreenshotModalCurrentUrl);
        const blob = await response.blob();

        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
        ]);

        showSuccess("Image copied — paste it into your AI assistant");

    } catch (error) {

        console.error(error);
        showError("Couldn't copy automatically — right-click the image above and choose Copy Image instead");
    }
}
