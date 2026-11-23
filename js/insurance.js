// AC v2.0 BANKNDEPOSITS

// Insurance policies: what you hold, when the next premium falls due, and
// whether the RDs saved for it will cover it. Every date and every
// "covered / short / late" line is worked out here from today's date and the
// RDs linked on the Deposits page (deposit.insurance_policy_id) -- nothing
// about due dates is stored. The date logic lives in insurance-schedule.js.
//
// Policy files (documents, medical records, receipts...) use the shared
// Attachments section from attachments.js.

let policyData = [];
let personData = [];
let linkedRdData = [];
let attachmentCounts = {};

let insAttachments = null;
let personEditingId = null;

const INS_ALERT_HORIZON_DAYS = 180;


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateInsuranceSelects();

        insAttachments = createAttachmentSection({
            containerId: "insAttachments",
            parentColumn: "insurance_policy_id",
            folder: "insurance_policy",
            docTypes: MASTERS.ATTACHMENT_DOC_TYPES.insurance_policy
        });

        await refreshInsurance();

        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get("action") === "new") {
            newPolicy();
        }

        // A link from the Invest dashboard: ?open=<policy id> opens that policy
        const openId = urlParams.get("open");

        if (openId) {
            editPolicy(openId);
        }

        window.history.replaceState({}, document.title, window.location.pathname);

        if (!openId) {
            document.getElementById("insSearch")?.focus();
        }
    }
);


// ======================================================
// SMALL HELPERS
// ======================================================

function esc(value) {

    return String(value === null || value === undefined ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function plural(n, word) {

    return `${n} ${word}${n === 1 ? "" : "s"}`;
}


function formatInr(value) {

    if (value === null || value === undefined || value === "") {
        return "&mdash;";
    }

    return "\u20B9" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}


function relDays(n) {

    if (n === 0) {
        return "today";
    }

    return n > 0 ? `in ${plural(n, "day")}` : `${plural(-n, "day")} ago`;
}


// "in 42 days" for near dates, "in 2 yr 7 mo" once it is a year and a half away
function relLong(days) {

    if (days < 540) {
        return relDays(days);
    }

    const months = Math.round(days / 30.4375);

    return `in ${Math.floor(months / 12)} yr ${months % 12} mo`;
}


// "25 Dec" for this year, "1 Jan 2027" for any other year
function shortDate(iso, todayIso) {

    const { y, m, d } = insParts(iso);

    const text = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
        timeZone: "UTC", day: "numeric", month: "short"
    });

    return y === insParts(todayIso).y ? text : `${text} ${y}`;
}


function last4(value) {

    return String(value || "").slice(-4);
}


function personById(id) {

    return personData.find(p => p.person_id === id);
}


function premiumText(p) {

    if (p.premium_amount === null || p.premium_amount === undefined) {
        return "&mdash;";
    }

    const amount = formatInr(p.premium_amount);

    switch (p.premium_mode) {
        case "Annual": return `${amount} a year`;
        case "Half Yearly": return `${amount} half-yearly`;
        case "Quarterly": return `${amount} a quarter`;
        case "Monthly": return `${amount} a month`;
        case "Single payment":
            return p.term_years ? `${amount} every ${plural(Number(p.term_years), "year")}` : `${amount} once`;
        default: return amount;
    }
}


async function fetchAll(path) {

    const PAGE = 1000;
    let all = [];
    let offset = 0;

    while (true) {

        const sep = path.includes("?") ? "&" : "?";

        const page = await getData(`${path}${sep}limit=${PAGE}&offset=${offset}`);

        if (!Array.isArray(page)) {
            console.error(page);
            return null;
        }

        all = all.concat(page);

        if (page.length < PAGE) {
            break;
        }

        offset += PAGE;
    }

    return all;
}


function assertSaved(result, fallbackMessage) {

    // insertData / updateData hand back the raw response, so a rejected
    // request arrives as an error object, not an array.
    if (Array.isArray(result)) {
        return result;
    }

    const detail = result && (result.message || result.hint || result.details);

    throw new Error(detail ? `${fallbackMessage} \u2014 ${detail}` : fallbackMessage);
}


// ======================================================
// DROPDOWNS
// ======================================================

function populateInsuranceSelects() {

    const options = list => list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");

    document.getElementById("polType").innerHTML = options(MASTERS.INSURANCE_TYPES);
    document.getElementById("polStatus").innerHTML = options(MASTERS.INSURANCE_STATUS);
    document.getElementById("polMode").innerHTML = options(MASTERS.PREMIUM_MODES);

    document.getElementById("insTypeFilter").innerHTML =
        `<option value="All">All types</option>` + options(MASTERS.INSURANCE_TYPES);
}


function populatePersonDropdown() {

    document.getElementById("polPerson").innerHTML =
        personData
            .map(p => `<option value="${p.person_id}">${esc(p.full_name)}${p.relationship ? ` (${esc(p.relationship.toLowerCase())})` : ""}</option>`)
            .join("");
}


// ======================================================
// LOAD
// ======================================================

async function loadPeople() {

    const rows = await getData("person?order=full_name.asc");

    if (!Array.isArray(rows)) {

        console.error(rows);

        personData = [];

        showError("Unable to load people");

        return;
    }

    personData = rows;

    populatePersonDropdown();
}


async function loadPolicies() {

    const rows = await fetchAll("insurance_policy?order=policy_name.asc");

    if (rows === null) {

        policyData = [];

        showError("Unable to load policies");

    } else {

        policyData = rows;
    }

    // RDs that fund a policy, and the file counts for the paperclips
    const rds = await fetchAll(
        "deposit?select=deposit_id,purpose,status,maturity_date,maturity_amount,needed_by,insurance_policy_id&insurance_policy_id=not.is.null&order=maturity_date.asc"
    );

    linkedRdData = rds === null ? [] : rds;

    attachmentCounts = await fetchAttachmentCounts("insurance_policy_id");

    renderInsuranceFeed();
}


// The refresh button: reloads from the database, not just a re-render.
async function refreshInsurance() {

    await loadPeople();

    await loadPolicies();
}


// ======================================================
// SUMMARY, FILTER, SORT, RENDER
// ======================================================

function buildContext() {

    return {
        today: getToday(),
        rds: linkedRdData,
        counts: attachmentCounts
    };
}


function computeInsuranceSummary(policies, ctx) {

    const active = policies.filter(p => p.status === "Active");

    let due = 0;
    let short = 0;
    let none = 0;

    active.forEach(p => {

        const next = insNextDue(p, ctx.today);

        if (!next) {
            return;
        }

        if (!next.overdue && next.days <= 60) {
            due++;
        }

        // A passed renewal date has its own warning on the card; it is not
        // a funding question.
        if (!next.overdue && next.days <= INS_ALERT_HORIZON_DAYS) {

            const f = insFunding(p, ctx.rds, ctx.today);

            if (f.status === "short" || f.status === "late") short++;
            if (f.status === "none") none++;
        }
    });

    return { active: active.length, due, short, none };
}


function setChip(id, text, warn) {

    const el = document.getElementById(id);

    if (!el) {
        return;
    }

    el.textContent = text;
    el.classList.toggle("ins-chip-warn", !!warn);
}


function updateInsuranceSummary(ctx) {

    const s = computeInsuranceSummary(policyData, ctx);

    setChip("insChipActive", `Active policies: ${s.active}`);
    setChip("insChipDue", `Due in 60 days: ${s.due}`);
    setChip("insChipShort", `Funding short: ${s.short}`, s.short > 0);
    setChip("insChipNoRd", `No RD for next due: ${s.none}`, s.none > 0);
}


function getFilteredPolicies(ctx) {

    const status = getInputValue("insStatusFilter") || "Active";
    const type = getInputValue("insTypeFilter") || "All";
    const search = getInputValue("insSearch").trim().toLowerCase();

    const rows = policyData.filter(p => {

        if (status !== "All" && p.status !== status) return false;
        if (type !== "All" && p.policy_type !== type) return false;

        if (search) {
            const haystack = `${p.policy_name || ""} ${p.insurer || ""} ${p.policy_no || ""} ${p.notes || ""}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });

    if ((getInputValue("insSort") || "due") === "name") {
        return rows.sort((a, b) => a.policy_name.localeCompare(b.policy_name));
    }

    // Next due soonest first (a passed renewal date counts as soonest);
    // policies with nothing due, and closed ones, after.
    const key = p => {
        const next = insNextDue(p, ctx.today);
        return next ? next.days : Infinity;
    };

    return rows.sort((a, b) => {

        if ((a.status === "Closed") !== (b.status === "Closed")) {
            return a.status === "Closed" ? 1 : -1;
        }

        const ka = key(a);
        const kb = key(b);

        if (ka !== kb) {
            return ka < kb ? -1 : 1;
        }

        return a.policy_name.localeCompare(b.policy_name);
    });
}


function rdsText(rds, todayIso) {

    const dates = rds.map(r => shortDate(r.maturity_date, todayIso));

    return `${plural(rds.length, "RD")} mature${rds.length === 1 ? "s" : ""} ${dates.join(" and ")}`;
}


function fundingLineHtml(p, ctx) {

    if (p.status === "Closed") {
        return "";
    }

    const next = insNextDue(p, ctx.today);

    if (!next) {
        return `<div class="ins-funding ins-funding-muted">No further premiums due.</div>`;
    }

    if (next.overdue) {
        return `<div class="ins-funding ins-funding-warn">&#9888; The renewal date has passed. Update it once you have renewed.</div>`;
    }

    const f = insFunding(p, ctx.rds, ctx.today);

    switch (f.status) {

        case "covered":
            return `<div class="ins-funding ins-funding-ok">&#10003; ${esc(rdsText(f.rds, ctx.today))} &middot; ${formatInr(f.total)} covers ${formatInr(f.premium)}${f.gap > 0 ? ` (${formatInr(f.gap)} spare)` : ""}</div>`;

        case "short":
            return `<div class="ins-funding ins-funding-warn">&#9888; ${esc(rdsText(f.rds, ctx.today))} &middot; ${formatInr(f.total)} is ${formatInr(-f.gap)} short of ${formatInr(f.premium)}</div>`;

        case "late":
            return `<div class="ins-funding ins-funding-warn">&#9888; ${esc(rdsText(f.rds, ctx.today))} &middot; the latest matures ${plural(f.lateDays, "day")} after the due date</div>`;

        case "unknown":
            return `<div class="ins-funding ins-funding-muted">${esc(rdsText(f.rds, ctx.today))}</div>`;

        default:
            return `<div class="ins-funding ins-funding-none">No RD is saving for this due date.</div>`;
    }
}


function buildPolicyCardHtml(p, ctx) {

    const id = p.insurance_policy_id;
    const person = personById(p.person_id);
    const next = insNextDue(p, ctx.today);
    const count = ctx.counts[id] || 0;
    const single = p.premium_mode === "Single payment";

    // first fact: whichever best describes the cover
    let fact1;

    if (p.sum_assured !== null && p.sum_assured !== undefined) {
        fact1 = ["Sum assured", formatInr(p.sum_assured)];
    } else if (p.tax_section) {
        fact1 = ["Tax section", esc(p.tax_section)];
    } else {
        fact1 = ["Term", p.term_years ? plural(Number(p.term_years), "year") : "&mdash;"];
    }

    // third fact: when the next premium (or renewal) falls
    let dueValue;

    if (p.status === "Closed") {
        dueValue = "Closed";
    } else if (!next) {
        dueValue = "None left";
    } else if (next.overdue) {
        dueValue = `${esc(formatDate(next.date))} <span class="ins-sub ins-sub-warn">passed ${plural(-next.days, "day")} ago</span>`;
    } else {
        dueValue = `${esc(formatDate(next.date))} <span class="ins-sub">${relLong(next.days)}</span>`;
    }

    const typeClass = `ins-type ins-type-${esc(String(p.policy_type).toLowerCase())}`;

    return `
        <div class="ins-card${p.status === "Closed" ? " ins-card-closed" : ""}">
            <div class="ins-card-head">
                <div>
                    <div class="ins-name">${esc(p.policy_name)} <span class="${typeClass}">${esc(p.policy_type)}</span></div>
                    <div class="ins-sub">${esc(p.insurer || "")}${p.insurer ? " &middot; " : ""}policy &bull;&bull;${esc(last4(p.policy_no))}${person ? ` &middot; insured ${esc(person.full_name.split(" ")[0])}` : ""}</div>
                </div>
                <div class="ins-card-actions">
                    <span class="ins-clip${count === 0 ? " ins-clip-zero" : ""}" title="Attached files">&#128206; ${count}</span>
                    <button type="button" class="ins-icon-btn" title="Edit" onclick="editPolicy('${id}')">&#9999;&#65039;</button>
                </div>
            </div>
            <div class="ins-facts">
                <div><div class="ins-fact-label">${fact1[0]}</div><div class="ins-fact-value">${fact1[1]}</div></div>
                <div><div class="ins-fact-label">Premium</div><div class="ins-fact-value">${premiumText(p)}</div></div>
                <div><div class="ins-fact-label">${single ? "Renews" : "Next due"}</div><div class="ins-fact-value">${dueValue}</div></div>
            </div>
            ${fundingLineHtml(p, ctx)}
        </div>
    `;
}


function renderInsuranceFeed() {

    const feed = document.getElementById("insuranceFeed");

    if (!feed) {
        return;
    }

    const ctx = buildContext();

    updateInsuranceSummary(ctx);

    const rows = getFilteredPolicies(ctx);

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">No policies found</div>`;
        return;
    }

    feed.innerHTML = rows.map(p => buildPolicyCardHtml(p, ctx)).join("");
}


// ======================================================
// POLICY FORM
// ======================================================

function updateDueHint() {

    const el = document.getElementById("polDueHint");

    if (!el) {
        return;
    }

    const mode = getInputValue("polMode");

    const draft = {
        status: "Active",
        premium_mode: mode,
        first_due_date: getInputValue("polFirstDue") || null,
        issue_date: getInputValue("polIssue") || null,
        premium_term_years: Number(getInputValue("polPremTerm")) || null,
        maturity_date: getInputValue("polMaturity") || null,
        premium_amount: null
    };

    if (mode === "Single payment") {
        el.textContent = "A single-payment policy falls due again on its Matures or renews date.";
        return;
    }

    const next = insNextDue(draft, getToday());

    el.textContent = next
        ? `Every due date is worked out from this, the mode and the paying term. Next: ${formatDate(next.date)}.`
        : "No further premiums are due (the paying term is over, or no first due date is set).";
}


function renderFundedBy(p) {

    const box = document.getElementById("polFundedBy");

    if (!p) {
        box.innerHTML = "";
        return;
    }

    const linked = linkedRdData.filter(r => r.insurance_policy_id === p.insurance_policy_id);
    const active = linked.filter(r => r.status === "Active");
    const closed = linked.length - active.length;

    let html = `<div class="ins-fundedby-title">Funded by</div>`;

    if (active.length === 0) {
        html += `<div class="ins-fundedby-row ins-sub">No active RD is linked yet.</div>`;
    } else {
        active.forEach(r => {
            html += `<div class="ins-fundedby-row"><span>${esc(r.purpose)}</span><span class="ins-sub">matures ${esc(formatDate(r.maturity_date))} &middot; ${formatInr(r.maturity_amount)}</span></div>`;
        });
    }

    if (closed > 0) {
        html += `<div class="ins-fundedby-row ins-sub">plus ${plural(closed, "completed or closed RD")}</div>`;
    }

    html += `<div class="ins-sub">Link an RD from the deposit form, with Funds policy.</div>`;

    box.innerHTML = html;
}


function defaultPersonId() {

    const self = personData.find(p => p.relationship === "Self");

    return self ? self.person_id : (personData[0] ? personData[0].person_id : "");
}


function fillPolicyForm(p) {

    const v = p || {};

    setInputValue("polId", p ? v.insurance_policy_id : "");
    setInputValue("polName", v.policy_name || "");
    setInputValue("polType", v.policy_type || MASTERS.INSURANCE_TYPES[0]);
    setInputValue("polStatus", v.status || MASTERS.INSURANCE_STATUS[0]);
    setInputValue("polInsurer", v.insurer || "");
    setInputValue("polNo", v.policy_no || "");
    setInputValue("polPerson", v.person_id || defaultPersonId());
    setInputValue("polSum", v.sum_assured);
    setInputValue("polIssue", formatDateForInput(v.issue_date));
    setInputValue("polMaturity", formatDateForInput(v.maturity_date));
    setInputValue("polTerm", v.term_years);
    setInputValue("polPremTerm", v.premium_term_years);
    setInputValue("polMode", v.premium_mode || MASTERS.PREMIUM_MODES[0]);
    setInputValue("polPremium", v.premium_amount);
    setInputValue("polFirstDue", formatDateForInput(v.first_due_date));
    setInputValue("polNominee", v.nominee || "");
    setInputValue("polVia", v.purchased_via || "");
    setInputValue("polContact", v.linked_contact || "");
    setInputValue("polTax", v.tax_section || "");
    setInputValue("polNotes", v.notes || "");

    document.getElementById("polModalTitle").textContent = p ? "Edit policy" : "New policy";

    updateDueHint();
    renderFundedBy(p);
}


function newPolicy() {

    fillPolicyForm(null);

    insAttachments.reset();

    openModal("policyModal");

    document.getElementById("polName").focus();
}


function editPolicy(id) {

    const p = policyData.find(x => x.insurance_policy_id === id);

    if (!p) {
        return;
    }

    fillPolicyForm(p);

    insAttachments.load(id);

    openModal("policyModal");

    document.getElementById("polName").focus();
}


function collectPolicyPayload() {

    const text = id => getInputValue(id).trim();
    const optionalText = id => text(id) || null;

    const numberOrNull = (id, label, { integer = false } = {}) => {

        const raw = getInputValue(id);

        if (raw === "") {
            return null;
        }

        const n = Number(raw);

        if (!(n >= 0) || (integer && !Number.isInteger(n))) {
            throw new Error(`${label} must be ${integer ? "a whole number" : "a number"} of zero or more`);
        }

        return n;
    };

    const name = text("polName");
    const policyNo = text("polNo");
    const personId = getInputValue("polPerson");
    const issue = getInputValue("polIssue");
    const maturity = getInputValue("polMaturity");
    const firstDue = getInputValue("polFirstDue");

    if (!name) throw new Error("Policy name is required");
    if (!policyNo) throw new Error("Policy number is required");
    if (!personById(personId)) throw new Error("Choose who is insured");
    if (!issue) throw new Error("Issue date is required");

    if (maturity && maturity < issue) throw new Error("The matures or renews date can't be before the issue date");
    if (firstDue && firstDue < issue) throw new Error("The first due date can't be before the issue date");

    return {
        policy_type: getInputValue("polType"),
        policy_name: name,
        insurer: optionalText("polInsurer"),
        policy_no: policyNo,
        person_id: personId,
        status: getInputValue("polStatus"),
        sum_assured: numberOrNull("polSum", "Sum assured"),
        issue_date: issue,
        maturity_date: maturity || null,
        term_years: numberOrNull("polTerm", "Term", { integer: true }),
        premium_term_years: numberOrNull("polPremTerm", "Premium paying term", { integer: true }),
        premium_mode: getInputValue("polMode") || null,
        premium_amount: numberOrNull("polPremium", "Premium amount"),
        first_due_date: firstDue || null,
        nominee: optionalText("polNominee"),
        purchased_via: optionalText("polVia"),
        linked_contact: optionalText("polContact"),
        tax_section: optionalText("polTax"),
        notes: optionalText("polNotes"),
        updated_by: getCurrentUser()
    };
}


async function savePolicy() {

    let payload;

    try {
        payload = collectPolicyPayload();
    } catch (error) {
        showError(error.message);
        return false;
    }

    const id = getInputValue("polId");

    try {

        let recordId = id;

        if (id) {

            payload.updated_at = new Date().toISOString();

            assertSaved(await updateData("insurance_policy", "insurance_policy_id", id, payload), "Unable to save policy");

        } else {

            payload.created_by = getCurrentUser();

            const inserted = assertSaved(await insertData("insurance_policy", payload), "Unable to save policy");

            recordId = inserted[0] ? inserted[0].insurance_policy_id : null;
        }

        // Upload any staged files now that the policy has an id. A failed
        // upload is reported by the section but never undoes the policy.
        if (recordId) {
            await insAttachments.commit(recordId);
        }

        closeModal("policyModal");

        await loadPolicies();

        showSuccess("Policy saved");

        return true;

    } catch (error) {

        console.error(error);
        showError(error.message || "Unable to save policy");

        return false;
    }
}


// ======================================================
// PEOPLE PANEL
// ======================================================

function openPeople() {

    personEditingId = null;

    renderPeople();

    openModal("peopleModal");
}


function addPerson() {

    personEditingId = "NEW";

    renderPeople();
}


function editPerson(id) {

    personEditingId = id;

    renderPeople();
}


function cancelPersonEdit() {

    personEditingId = null;

    renderPeople();
}


function personSummaryHtml(p) {

    const count = policyData.filter(x => x.person_id === p.person_id).length;

    const detail = [
        p.relationship,
        plural(count, "policy").replace(/policys/, "policies")
    ].filter(Boolean).map(esc).join(" &middot; ");

    return `
        <div class="ins-person-card">
            <div>
                <div class="ins-person-name">${esc(p.full_name)}</div>
                <div class="ins-sub">${detail}</div>
            </div>
            <button type="button" class="ins-icon-btn" title="Edit" onclick="editPerson('${p.person_id}')">&#9999;&#65039;</button>
        </div>
    `;
}


function personFormHtml(p) {

    const v = p || {};

    return `
        <div class="ins-person-card ins-person-editing">
            <div class="ins-person-name">${p ? esc(p.full_name) : "New person"}</div>
            <div class="ins-person-grid">
                <div>
                    <label>Full name</label>
                    <input id="pp_name" value="${esc(v.full_name)}">
                </div>
                <div>
                    <label>Relationship</label>
                    <select id="pp_rel">
                        <option value="">&mdash;</option>
                        ${MASTERS.PERSON_RELATIONSHIPS.map(r => `<option value="${esc(r)}"${r === v.relationship ? " selected" : ""}>${esc(r)}</option>`).join("")}
                    </select>
                </div>
                <div>
                    <label>Date of birth</label>
                    <input type="date" id="pp_dob" value="${esc(formatDateForInput(v.date_of_birth))}">
                </div>
                <div>
                    <label>Notes</label>
                    <input id="pp_notes" value="${esc(v.notes)}">
                </div>
            </div>
            <div class="ins-person-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="cancelPersonEdit()">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="savePerson()">Save</button>
            </div>
        </div>
    `;
}


function renderPeople() {

    const box = document.getElementById("peopleList");

    const cards = [];

    if (personEditingId === "NEW") {
        cards.push(personFormHtml(null));
    }

    personData.forEach(p => {
        cards.push(personEditingId === p.person_id ? personFormHtml(p) : personSummaryHtml(p));
    });

    box.innerHTML = cards.length ? cards.join("") : `<div class="empty-state">No people yet</div>`;
}


async function savePerson() {

    const name = getInputValue("pp_name").trim();

    if (!name) {
        showError("Full name is required");
        return;
    }

    const payload = {
        full_name: name,
        relationship: getInputValue("pp_rel") || null,
        date_of_birth: getInputValue("pp_dob") || null,
        notes: getInputValue("pp_notes").trim() || null,
        updated_by: getCurrentUser()
    };

    try {

        if (personEditingId === "NEW") {

            payload.created_by = getCurrentUser();

            assertSaved(await insertData("person", payload), "Unable to save person");

        } else {

            payload.updated_at = new Date().toISOString();

            assertSaved(await updateData("person", "person_id", personEditingId, payload), "Unable to save person");
        }

        personEditingId = null;

        await loadPeople();

        renderPeople();

        renderInsuranceFeed();

        showSuccess("Person saved");

    } catch (error) {

        console.error(error);
        showError(error.message || "Unable to save person");
    }
}


// ======================================================
// KEYBOARD
// ======================================================

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeModal("policyModal");
            closeModal("peopleModal");
            return;
        }

        const modal = document.getElementById("policyModal");

        if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {

            const active = document.activeElement;

            const inNotes = active && active.id === "polNotes";
            const inFiles = active && active.closest && active.closest("#insAttachments");
            const onButton = active && (active.tagName === "BUTTON" || active.tagName === "SELECT" || active.tagName === "A");

            // Enter saves -- except in the notes box, in the attachments
            // section, or on a button, dropdown or link.
            if (event.key === "Enter" && !inNotes && !inFiles && !onButton) {
                event.preventDefault();
                savePolicy();
            }
        }
    }
);
