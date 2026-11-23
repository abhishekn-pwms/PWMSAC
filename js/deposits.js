// AC v2.0 BANKNDEPOSITS

// A reference list of short-term RDs (and FDs) so no future payment goes
// unfunded. Status is stored and never changes by itself: a deposit past
// its maturity date stays Active until it is deliberately closed, which is
// what keeps it visible as "Matured, not closed". Status changes only
// through the hidden "Close this deposit" section of the edit form.
//
// Everything date-dependent (days left, matures early/late, matured but
// not closed) is worked out here from today's date — nothing is stored.

let depositData = [];
let bankAccountData = [];
let policyData = [];
let attachmentCounts = {};

let depAttachments = null;

let depMaturityTouched = false;
let bankEditingId = null;

const DEP_LAST_BANK_KEY = "pwms_dep_last_bank";


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateDepositSelects();

        depAttachments = createAttachmentSection({
            containerId: "depAttachments",
            parentColumn: "deposit_id",
            folder: "deposit",
            docTypes: MASTERS.ATTACHMENT_DOC_TYPES.deposit
        });

        await loadBankAccounts();

        await loadPolicies();

        await loadDeposits();

        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get("action") === "new") {
            newDeposit();
        }

        // A link from the Invest dashboard: ?open=<deposit id> opens that deposit
        const openId = urlParams.get("open");

        if (openId) {
            editDeposit(openId);
        }

        window.history.replaceState({}, document.title, window.location.pathname);

        if (!openId) {
            document.getElementById("depSearch")?.focus();
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


function isoParts(iso) {

    const [y, m, d] = String(iso).substring(0, 10).split("-").map(Number);

    return { y, m, d };
}


// Whole days from one yyyy-mm-dd date to another (positive = later).
// Uses UTC midnights so daylight-saving never shifts the count.
function daysBetween(fromIso, toIso) {

    const a = isoParts(fromIso);
    const b = isoParts(toIso);

    return Math.round(
        (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000
    );
}


// Same behaviour as Excel's EDATE — the day clamps to the month's last
// day (31 Aug + 6 months -> 28/29 Feb).
function addMonthsIso(iso, months) {

    const { y, m, d } = isoParts(iso);

    const total = (m - 1) + months;
    const ny = y + Math.floor(total / 12);
    const nm = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();

    return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
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


// How the maturity date sits against the needed-by date.
function marginInfo(marginDays) {

    if (marginDays === null || marginDays === undefined) {
        return null;
    }

    if (marginDays > 0) {
        return { text: `matures ${plural(marginDays, "day")} early`, cls: "dep-sub-ok" };
    }

    if (marginDays < 0) {
        return { text: `matures ${plural(-marginDays, "day")} late`, cls: "dep-sub-warn" };
    }

    return { text: "matures on the day", cls: "dep-sub-ok" };
}


function bankAccountById(id) {

    return bankAccountData.find(a => a.bank_account_id === id);
}


function bankAccountLabel(a) {

    return [a.bank, a.branch, a.account_type].filter(Boolean).join(" \u00B7 ");
}


function assertSaved(result, fallbackMessage) {

    // insertData / updateData hand back the raw response, so a rejected
    // request arrives as an error object, not an array — never treat that
    // as saved.
    if (Array.isArray(result)) {
        return result;
    }

    const detail = result && (result.message || result.hint || result.details);

    throw new Error(detail ? `${fallbackMessage} \u2014 ${detail}` : fallbackMessage);
}


function rememberLastBank(id) {

    try {
        localStorage.setItem(DEP_LAST_BANK_KEY, id);
    } catch (e) { /* storage unavailable — harmless */ }
}


function recallLastBank() {

    try {
        return localStorage.getItem(DEP_LAST_BANK_KEY) || "";
    } catch (e) {
        return "";
    }
}


// ======================================================
// DROPDOWNS
// ======================================================

function populateDepositSelects() {

    const typeOptions = MASTERS.DEPOSIT_TYPES
        .map(t => `<option value="${esc(t)}">${esc(t)}</option>`)
        .join("");

    document.getElementById("depType").innerHTML = typeOptions;

    document.getElementById("depTypeFilter").innerHTML =
        `<option value="All">All types</option>${typeOptions}`;

    document.getElementById("depTenure").innerHTML =
        MASTERS.DEPOSIT_TENURES
            .map(n => `<option value="${n}">${n} months</option>`)
            .join("") + `<option value="other">Other</option>`;
}


function populateBankDropdowns() {

    const filter = document.getElementById("depBankFilter");
    const previous = filter.value || "All";

    const banks = [...new Set(bankAccountData.map(a => a.bank))];

    filter.innerHTML =
        `<option value="All">All banks</option>` +
        banks.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("");

    filter.value = banks.includes(previous) ? previous : "All";

    document.getElementById("depBankAccount").innerHTML =
        bankAccountData
            .map(a => `<option value="${a.bank_account_id}">${esc(bankAccountLabel(a))}</option>`)
            .join("");
}


// ======================================================
// LOAD
// ======================================================

async function loadBankAccounts() {

    const rows = await getData("bank_account?order=bank.asc,created_at.asc");

    if (!Array.isArray(rows)) {

        console.error(rows);

        bankAccountData = [];

        showError("Unable to load bank accounts");

        return;
    }

    bankAccountData = rows;

    populateBankDropdowns();
}


// The policies an RD can fund. The schedule fields come too, so the form can
// say whether this RD matures before the premium it is saving for.
async function loadPolicies() {

    const rows = await getData(
        "insurance_policy?select=insurance_policy_id,policy_name,status,premium_amount,premium_mode,first_due_date,issue_date,maturity_date,premium_term_years&order=policy_name.asc"
    );

    if (!Array.isArray(rows)) {

        console.error(rows);

        policyData = [];

        showError("Unable to load insurance policies");

    } else {

        policyData = rows;
    }

    populatePolicyDropdown();
}


function populatePolicyDropdown() {

    const el = document.getElementById("depPolicy");

    if (!el) {
        return;
    }

    el.innerHTML =
        `<option value="">None (fees, taxes, other)</option>` +
        policyData
            .map(p => `<option value="${p.insurance_policy_id}">${esc(p.policy_name)}${p.status === "Closed" ? " (closed)" : ""}</option>`)
            .join("");
}


function policyById(id) {

    return policyData.find(p => p.insurance_policy_id === id);
}


async function loadDeposits() {

    const PAGE_SIZE = 1000;
    let all = [];
    let offset = 0;

    while (true) {

        const page = await getData(`deposit?order=maturity_date.asc&limit=${PAGE_SIZE}&offset=${offset}`);

        if (!Array.isArray(page)) {

            console.error(page);

            depositData = [];

            showError("Unable to load deposits");

            renderDepositFeed();

            return;
        }

        all = all.concat(page);

        if (page.length < PAGE_SIZE) {
            break;
        }

        offset += PAGE_SIZE;
    }

    depositData = all;

    attachmentCounts = await fetchAttachmentCounts("deposit_id");

    renderDepositFeed();
}


// The refresh button — reloads from the database, not just a re-render.
async function refreshDeposits() {

    await loadBankAccounts();

    await loadPolicies();

    await loadDeposits();
}


// ======================================================
// DERIVED VALUES AND SUMMARY
// ======================================================

function computeDepositSummary(rows, today) {

    const active = rows.filter(d => d.status === "Active");

    return {
        active: active.length,
        soon: active.filter(d => {
            const n = daysBetween(today, d.maturity_date);
            return n >= 0 && n <= 30;
        }).length,
        matured: active.filter(d => daysBetween(today, d.maturity_date) < 0).length,
        noDate: active.filter(d => !d.needed_by).length
    };
}


function setChip(id, text, warn) {

    const el = document.getElementById(id);

    if (!el) {
        return;
    }

    el.textContent = text;
    el.classList.toggle("dep-chip-warn", !!warn);
}


function updateDepositSummary(today) {

    const s = computeDepositSummary(depositData, today);

    setChip("depChipActive", `Active: ${s.active}`);
    setChip("depChipSoon", `Maturing in 30 days: ${s.soon}`);
    setChip("depChipMatured", `Matured, not closed: ${s.matured}`, s.matured > 0);
    setChip("depChipNoDate", `No needed-by date: ${s.noDate}`, s.noDate > 0);
}


// ======================================================
// FILTER / SORT / RENDER
// ======================================================

function cmpNullsLast(a, b) {

    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    return a.localeCompare(b);
}


function sortDeposits(rows, mode) {

    const active = rows.filter(d => d.status === "Active");
    const closed = rows.filter(d => d.status !== "Active");

    active.sort(
        mode === "needed"
            ? (a, b) => cmpNullsLast(a.needed_by, b.needed_by) || a.maturity_date.localeCompare(b.maturity_date)
            : (a, b) => a.maturity_date.localeCompare(b.maturity_date) || cmpNullsLast(a.needed_by, b.needed_by)
    );

    // Closed deposits: most recent first.
    closed.sort((a, b) => b.maturity_date.localeCompare(a.maturity_date));

    return active.concat(closed);
}


function getFilteredDeposits() {

    const status = getInputValue("depStatusFilter") || "Active";
    const type = getInputValue("depTypeFilter") || "All";
    const bank = getInputValue("depBankFilter") || "All";
    const search = getInputValue("depSearch").trim().toLowerCase();

    const rows = depositData.filter(d => {

        if (status !== "All" && d.status !== status) return false;
        if (type !== "All" && d.deposit_type !== type) return false;

        if (bank !== "All") {
            const acct = bankAccountById(d.bank_account_id);
            if (!acct || acct.bank !== bank) return false;
        }

        if (search) {
            const haystack = `${d.purpose || ""} ${d.account_no || ""} ${d.notes || ""}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });

    return sortDeposits(rows, getInputValue("depSort") || "maturity");
}


function buildDepositRowHtml(dep, today) {

    const id = dep.deposit_id;
    const acct = bankAccountById(dep.bank_account_id);
    const bankName = acct ? acct.bank : "";
    const last4 = String(dep.account_no || "").slice(-4);
    const isActive = dep.status === "Active";

    const daysToMaturity = daysBetween(today, dep.maturity_date);

    // ---- Matures cell -------------------------------------------------
    let maturesCell = `${esc(formatDate(dep.maturity_date))}`;

    if (isActive && daysToMaturity < 0) {

        maturesCell += `<span class="dep-badge dep-badge-warn">Matured ${plural(-daysToMaturity, "day")} ago</span>`;

    } else if (isActive) {

        maturesCell += `<span class="dep-sub">${relDays(daysToMaturity)}</span>`;

    } else if (dep.status === "Closed early") {

        maturesCell += `<span class="dep-badge dep-badge-neutral">Closed early</span>`;

        if (dep.forced_close_date) {
            maturesCell += `<span class="dep-sub">${esc(formatDate(dep.forced_close_date))}</span>`;
        }

    } else {

        maturesCell += `<span class="dep-badge dep-badge-neutral">${esc(dep.status)}</span>`;
    }

    // ---- Amount cell --------------------------------------------------
    let amountCell = formatInr(dep.maturity_amount);

    if (dep.status === "Closed early") {

        if (dep.final_maturity_amount !== null && dep.final_maturity_amount !== undefined) {
            amountCell = `${formatInr(dep.final_maturity_amount)}<span class="dep-sub">due ${formatInr(dep.maturity_amount)}</span>`;
        } else {
            amountCell = `${formatInr(dep.maturity_amount)}<span class="dep-sub">received amount not recorded</span>`;
        }
    }

    // ---- Needed-by cell -----------------------------------------------
    let neededCell;

    if (!isActive) {

        neededCell = dep.needed_by ? esc(formatDate(dep.needed_by)) : "&mdash;";

    } else {

        const picker =
            `<input type="date" class="dep-date-input" id="nb_${id}" value="${esc(dep.needed_by || "")}" onchange="saveNeededBy('${id}', this.value)">`;

        if (!dep.needed_by) {

            neededCell =
                `<span class="dep-setdate" onclick="openNeededByPicker('${id}')">&#128197; Set date</span>${picker}`;

        } else {

            const margin = marginInfo(daysBetween(dep.maturity_date, dep.needed_by));
            const rel = relDays(daysBetween(today, dep.needed_by));

            neededCell =
                `<span class="dep-needed" title="Click to change" onclick="openNeededByPicker('${id}')">${esc(formatDate(dep.needed_by))}</span>` +
                `<span class="dep-sub">${rel}<span class="${margin.cls}"> &middot; ${margin.text}</span></span>${picker}`;
        }
    }

    // ---- Purpose / type / bank / instalment ---------------------------
    const rate = (dep.interest_rate === null || dep.interest_rate === undefined)
        ? ""
        : ` at ${Number(dep.interest_rate).toFixed(2)}%`;

    const instalment = (dep.deposit_type === "FD" || dep.installment_amount === null || dep.installment_amount === undefined)
        ? "&mdash;"
        : formatInr(dep.installment_amount);

    const policy = dep.insurance_policy_id ? policyById(dep.insurance_policy_id) : null;
    const clips = attachmentCounts[id] || 0;

    return `
        <div class="dep-row">
            <div class="dep-c-purpose">
                <span class="dep-purpose">${esc(dep.purpose)}</span>
                <span class="dep-sub">${plural(Number(dep.tenure_months), "month")}${rate}${policy ? ` &middot; funds ${esc(policy.policy_name)}` : ""}</span>
            </div>
            <div class="dep-c-type" data-label="Type">
                <span class="dep-type dep-type-${esc(String(dep.deposit_type).toLowerCase())}">${esc(dep.deposit_type)}</span>
            </div>
            <div class="dep-c-bank" data-label="Bank">
                ${esc(bankName)}<span class="dep-sub">&bull;&bull;${esc(last4)}</span>
            </div>
            <div class="dep-c-inst" data-label="Instalment">${instalment}</div>
            <div class="dep-c-matures" data-label="Matures">${maturesCell}</div>
            <div class="dep-c-amount" data-label="Maturity amt">${amountCell}</div>
            <div class="dep-c-needed" data-label="Needed by">${neededCell}</div>
            <div class="dep-c-actions">
                <span class="dep-clip${clips === 0 ? " dep-clip-zero" : ""}" title="Attached files">&#128206; ${clips}</span>
                <button type="button" class="dep-icon-btn" title="Edit" onclick="editDeposit('${id}')">&#9999;&#65039;</button>
                <button type="button" class="dep-icon-btn" title="Add similar" onclick="addSimilarDeposit('${id}')">&#128203;</button>
            </div>
        </div>
    `;
}


function renderDepositFeed() {

    const feed = document.getElementById("depositFeed");

    if (!feed) {
        return;
    }

    const today = getToday();

    updateDepositSummary(today);

    const rows = getFilteredDeposits();

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">No deposits found</div>`;
        return;
    }

    feed.innerHTML = `
        <div class="dep-list">
            <div class="dep-head">
                <div>Purpose</div>
                <div>Type</div>
                <div>Bank</div>
                <div>Instalment</div>
                <div>Matures</div>
                <div>Maturity amt</div>
                <div>Needed by</div>
                <div></div>
            </div>
            ${rows.map(d => buildDepositRowHtml(d, today)).join("")}
        </div>
    `;
}


// ======================================================
// INLINE NEEDED-BY EDIT
// ======================================================

function openNeededByPicker(id) {

    const input = document.getElementById(`nb_${id}`);

    if (!input) {
        return;
    }

    if (typeof input.showPicker === "function") {

        try {
            input.showPicker();
            return;
        } catch (e) { /* fall through to focus/click */ }
    }

    input.focus();
    input.click();
}


async function saveNeededBy(id, value) {

    try {

        const result = await updateData("deposit", "deposit_id", id, {
            needed_by: value || null,
            updated_at: new Date().toISOString(),
            updated_by: getCurrentUser()
        });

        assertSaved(result, "Unable to save the needed-by date");

    } catch (error) {

        console.error(error);
        showError(error.message || "Unable to save the needed-by date");
    }

    await loadDeposits();
}


// ======================================================
// DEPOSIT FORM
// ======================================================

function getTenureMonths() {

    if (getInputValue("depTenure") === "other") {
        return parseInt(getInputValue("depTenureOther"), 10) || 0;
    }

    return parseInt(getInputValue("depTenure"), 10) || 0;
}


function onTenureChanged() {

    const other = document.getElementById("depTenureOther");

    other.style.display = getInputValue("depTenure") === "other" ? "" : "none";

    recalcMaturity();
}


function markMaturityTouched() {

    depMaturityTouched = true;

    updateNeededHint();
}


// Fills Matures from start date + tenure — until the maturity date has
// been typed by hand, after which it is left alone.
function recalcMaturity() {

    if (!depMaturityTouched) {

        const start = getInputValue("depStartDate");
        const months = getTenureMonths();

        if (start && months > 0) {
            setInputValue("depMaturityDate", addMonthsIso(start, months));
        }
    }

    updateNeededHint();
}


function onDepositTypeChanged() {

    const isFd = getInputValue("depType") === "FD";
    const instalment = document.getElementById("depInstallment");

    instalment.disabled = isFd;

    if (isFd) {
        instalment.value = "";
        instalment.placeholder = "Not applicable";
    } else {
        instalment.placeholder = "";
    }
}


function updateBankInfo() {

    const el = document.getElementById("depBankInfo");
    const acct = bankAccountById(getInputValue("depBankAccount"));

    el.textContent = acct
        ? `Holder ${acct.holder_name}${acct.rd_nominee ? ` \u00B7 Nominee ${acct.rd_nominee}` : ""}`
        : "";
}


function updateNeededHint() {

    const el = document.getElementById("depNeededHint");

    if (!el) {
        return;
    }

    const needed = getInputValue("depNeededBy");
    const matures = getInputValue("depMaturityDate");

    updatePolicyHint();

    if (!needed || !matures) {
        el.textContent = "";
        el.className = "dep-hint";
        return;
    }

    const margin = daysBetween(matures, needed);

    if (margin > 0) {
        el.textContent = `Matures ${plural(margin, "day")} before it's needed.`;
        el.className = "dep-hint dep-sub-ok";
    } else if (margin < 0) {
        el.textContent = `Matures ${plural(-margin, "day")} after it's needed.`;
        el.className = "dep-hint dep-sub-warn";
    } else {
        el.textContent = "Matures on the day it's needed.";
        el.className = "dep-hint dep-sub-ok";
    }
}


// Says whether this RD matures before the premium it is saving for.
function updatePolicyHint() {

    const el = document.getElementById("depPolicyHint");

    if (!el) {
        return;
    }

    const policy = policyById(getInputValue("depPolicy"));

    el.className = "dep-hint";

    if (!policy) {
        el.textContent = "";
        return;
    }

    const maturity = getInputValue("depMaturityDate");

    if (!maturity) {
        el.textContent = `Funds ${policy.policy_name}.`;
        return;
    }

    const due = insDueForRd(policy, {
        maturity_date: maturity,
        needed_by: getInputValue("depNeededBy") || null
    }, getToday());

    if (!due) {
        el.textContent = `No premium is due on ${policy.policy_name} after this RD matures.`;
        el.className = "dep-hint dep-sub-warn";
        return;
    }

    const gap = insDaysBetween(maturity, due);
    const premium = policy.premium_amount === null || policy.premium_amount === undefined ? "" : `${formatInr(policy.premium_amount)} `;
    const when = formatDate(due);

    if (gap >= 0) {
        el.textContent = `Matures ${plural(gap, "day")} before the ${premium}premium due ${when}.`;
        el.className = "dep-hint dep-sub-ok";
    } else {
        el.textContent = `Matures ${plural(-gap, "day")} after the ${premium}premium due ${when}.`;
        el.className = "dep-hint dep-sub-warn";
    }
}


function renderCloseSection(dep) {

    const wrap = document.getElementById("depCloseSection");
    const box = document.getElementById("depCloseContent");

    wrap.open = false;

    if (!dep) {
        wrap.style.display = "none";
        box.innerHTML = "";
        return;
    }

    wrap.style.display = "";

    if (dep.status === "Completed") {

        box.innerHTML = `
            <div class="dep-close-note">Completed. Maturity amount received.</div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="reopenDeposit()">Reopen</button>
        `;

    } else if (dep.status === "Closed early") {

        const received = (dep.final_maturity_amount === null || dep.final_maturity_amount === undefined)
            ? "Received amount not recorded."
            : `Received ${formatInr(dep.final_maturity_amount)} of ${formatInr(dep.maturity_amount)} expected.`;

        box.innerHTML = `
            <div class="dep-close-note">Closed early on ${esc(formatDate(dep.forced_close_date))}.</div>
            <div class="dep-hint">${received}</div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="reopenDeposit()">Reopen</button>
        `;

    } else {

        box.innerHTML = `
            <div class="dep-close-block">
                <div class="dep-close-title">Matured and received</div>
                <div class="dep-hint">Use once the maturity amount has reached your account.</div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="markDepositCompleted()">Mark completed</button>
            </div>
            <div class="dep-close-block">
                <div class="dep-close-title">Closed before maturity</div>
                <div class="time-row">
                    <div>
                        <label>Date closed</label>
                        <input type="date" id="depForcedDate">
                    </div>
                    <div>
                        <label>Amount received (&#8377;)</label>
                        <input type="number" id="depFinalAmount" min="0" step="0.01">
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeDepositEarly()">Close early</button>
            </div>
        `;
    }
}


// values: a deposit row, or a partial template for "Add similar".
// isEdit: true only when editing an existing deposit.
function fillDepositForm(values, isEdit) {

    const v = values || {};

    setInputValue("depId", isEdit ? v.deposit_id : "");
    setInputValue("depPurpose", v.purpose || "");

    const lastBank = recallLastBank();
    const defaultBank = bankAccountById(lastBank)
        ? lastBank
        : (bankAccountData[0] ? bankAccountData[0].bank_account_id : "");

    setInputValue("depBankAccount", v.bank_account_id || defaultBank);
    updateBankInfo();

    setInputValue("depType", v.deposit_type || MASTERS.DEPOSIT_TYPES[0]);
    setInputValue("depAccountNo", v.account_no || "");
    setInputValue("depStartDate", formatDateForInput(v.start_date));

    const tenure = v.tenure_months ? Number(v.tenure_months) : 12;

    if (MASTERS.DEPOSIT_TENURES.includes(tenure)) {
        setInputValue("depTenure", String(tenure));
        setInputValue("depTenureOther", "");
    } else {
        setInputValue("depTenure", "other");
        setInputValue("depTenureOther", String(tenure));
    }

    document.getElementById("depTenureOther").style.display =
        getInputValue("depTenure") === "other" ? "" : "none";

    setInputValue("depMaturityDate", formatDateForInput(v.maturity_date));
    depMaturityTouched = false;

    setInputValue("depInstallment", v.installment_amount);
    setInputValue("depMaturityAmount", v.maturity_amount);
    setInputValue("depInterestRate", v.interest_rate);
    setInputValue("depNeededBy", formatDateForInput(v.needed_by));
    setInputValue("depPolicy", v.insurance_policy_id || "");
    setInputValue("depNotes", v.notes || "");

    onDepositTypeChanged();
    updateNeededHint();

    renderCloseSection(isEdit ? v : null);

    document.getElementById("depModalTitle").textContent =
        isEdit ? "Edit deposit" : "New deposit";
}


function newDeposit() {

    fillDepositForm(null, false);

    depAttachments.reset();

    openModal("depositModal");

    document.getElementById("depPurpose").focus();
}


function editDeposit(id) {

    const dep = depositData.find(d => d.deposit_id === id);

    if (!dep) {
        return;
    }

    fillDepositForm(dep, true);

    depAttachments.load(id);

    openModal("depositModal");

    document.getElementById("depPurpose").focus();
}


// "Term 2 2026" -> "Term 2 2027"; "2026-27" -> "2027-28";
// "2026-2029" -> "2027-2030". When there are several years it bumps the
// LAST one, so "Fortune Elite 2019 (Jan 2027)" becomes "(Jan 2028)" and
// the plan name is left alone. Only a suggestion — the field stays editable.
function bumpYearInText(text) {

    const out = String(text || "");
    const range = /\b(20\d{2})([-\u2013])(\d{2}|\d{4})\b/;

    if (range.test(out)) {

        return out.replace(range, (m, first, sep, second) => {

            const nextSecond = second.length === 2
                ? String((Number(second) + 1) % 100).padStart(2, "0")
                : String(Number(second) + 1);

            return `${Number(first) + 1}${sep}${nextSecond}`;
        });
    }

    const years = [...out.matchAll(/\b20\d{2}\b/g)];

    if (years.length === 0) {
        return out;
    }

    const last = years[years.length - 1];

    return out.slice(0, last.index) + String(Number(last[0]) + 1) + out.slice(last.index + 4);
}


function addSimilarDeposit(id) {

    const src = depositData.find(d => d.deposit_id === id);

    if (!src) {
        return;
    }

    // Bank, type, tenure, instalment and rate carry over. Account number,
    // dates and amounts are left blank — each new RD has its own.
    fillDepositForm({
        purpose: bumpYearInText(src.purpose),
        bank_account_id: src.bank_account_id,
        deposit_type: src.deposit_type,
        tenure_months: src.tenure_months,
        installment_amount: src.installment_amount,
        interest_rate: src.interest_rate,
        insurance_policy_id: src.insurance_policy_id
    }, false);

    depAttachments.reset();

    openModal("depositModal");

    document.getElementById("depAccountNo").focus();
}


function collectDepositPayload() {

    const purpose = getInputValue("depPurpose").trim();
    const bankId = getInputValue("depBankAccount");
    const type = getInputValue("depType");
    const accountNo = getInputValue("depAccountNo").trim();
    const start = getInputValue("depStartDate");
    const tenure = getTenureMonths();
    const needed = getInputValue("depNeededBy");
    const notes = getInputValue("depNotes").trim();

    let maturity = getInputValue("depMaturityDate");

    const installmentRaw = getInputValue("depInstallment");
    const maturityAmountRaw = getInputValue("depMaturityAmount");
    const rateRaw = getInputValue("depInterestRate");

    if (!purpose) throw new Error("Purpose is required");
    if (!bankAccountById(bankId)) throw new Error("Choose a bank account");
    if (!accountNo) throw new Error("Account number is required");
    if (!start) throw new Error("Start date is required");
    if (!(tenure > 0)) throw new Error("Tenure is required");

    if (!maturity) {
        maturity = addMonthsIso(start, tenure);
    }

    if (maturity < start) throw new Error("Maturity date can't be before the start date");

    const maturityAmount = Number(maturityAmountRaw);

    if (maturityAmountRaw === "" || !(maturityAmount > 0)) {
        throw new Error("Maturity amount is required");
    }

    let installment = null;

    if (type !== "FD") {

        installment = Number(installmentRaw);

        if (installmentRaw === "" || !(installment > 0)) {
            throw new Error("Instalment is required for an RD");
        }
    }

    let rate = null;

    if (rateRaw !== "") {

        rate = Number(rateRaw);

        if (!(rate >= 0 && rate <= 100)) {
            throw new Error("Interest rate must be between 0 and 100");
        }
    }

    return {
        bank_account_id: bankId,
        deposit_type: type,
        purpose: purpose,
        account_no: accountNo,
        start_date: start,
        tenure_months: tenure,
        maturity_date: maturity,
        installment_amount: installment,
        maturity_amount: maturityAmount,
        interest_rate: rate,
        needed_by: needed || null,
        insurance_policy_id: getInputValue("depPolicy") || null,
        notes: notes || null,
        updated_by: getCurrentUser()
    };
}


// One save path for everything. Normal Save passes no extra fields, so it
// never touches status. The three closing actions pass their status fields
// as "extra", so any edits made in the form are saved in the same update.
async function persistDeposit(extra, successMessage) {

    let payload;

    try {
        payload = collectDepositPayload();
    } catch (error) {
        showError(error.message);
        return false;
    }

    Object.assign(payload, extra);

    const id = getInputValue("depId");

    try {

        let result;

        if (id) {
            payload.updated_at = new Date().toISOString();
            result = await updateData("deposit", "deposit_id", id, payload);
        } else {
            payload.created_by = getCurrentUser();
            result = await insertData("deposit", payload);
        }

        const saved = assertSaved(result, "Unable to save deposit");

        rememberLastBank(payload.bank_account_id);

        // Upload any staged files now that the RD has an id. A failed upload
        // is reported by the section but never undoes the saved RD.
        const depositId = id || (saved[0] ? saved[0].deposit_id : null);

        if (depositId) {
            await depAttachments.commit(depositId);
        }

        closeModal("depositModal");

        await loadDeposits();

        showSuccess(successMessage);

        return true;

    } catch (error) {

        console.error(error);
        showError(error.message || "Unable to save deposit");

        return false;
    }
}


async function saveDeposit() {

    await persistDeposit({}, "Deposit saved");
}


// ======================================================
// HIDDEN CLOSING ACTIONS
// ======================================================

async function markDepositCompleted() {

    await persistDeposit(
        { status: "Completed", forced_close_date: null, final_maturity_amount: null },
        "Marked completed"
    );
}


async function closeDepositEarly() {

    const date = getInputValue("depForcedDate");
    const amountRaw = getInputValue("depFinalAmount");

    const start = getInputValue("depStartDate");
    const matures = getInputValue("depMaturityDate");

    if (!date) {
        showError("Enter the date it was closed");
        return;
    }

    if (start && date < start) {
        showError("The closed date can't be before the start date");
        return;
    }

    if (matures && date >= matures) {
        showError("That date is on or after maturity. Use Mark completed instead");
        return;
    }

    let amount = null;

    if (amountRaw !== "") {

        amount = Number(amountRaw);

        if (!(amount >= 0)) {
            showError("Amount received must be zero or more");
            return;
        }
    }

    await persistDeposit(
        { status: "Closed early", forced_close_date: date, final_maturity_amount: amount },
        "Closed early"
    );
}


async function reopenDeposit() {

    await persistDeposit(
        { status: "Active", forced_close_date: null, final_maturity_amount: null },
        "Deposit reopened"
    );
}


// ======================================================
// BANK ACCOUNTS PANEL
// ======================================================

function openBankAccounts() {

    bankEditingId = null;

    renderBankAccounts();

    openModal("bankModal");
}


function addBankAccount() {

    bankEditingId = "NEW";

    renderBankAccounts();
}


function editBankAccount(id) {

    bankEditingId = id;

    renderBankAccounts();
}


function cancelBankEdit() {

    bankEditingId = null;

    renderBankAccounts();
}


function bankSummaryHtml(a) {

    const count = depositData.filter(d => d.bank_account_id === a.bank_account_id).length;

    const detail = [
        a.holder_name,
        a.rd_nominee ? `RD nominee ${a.rd_nominee}` : "",
        plural(count, "deposit")
    ].filter(Boolean).map(esc).join(" &middot; ");

    return `
        <div class="dep-bank-card">
            <div>
                <div class="dep-bank-title">${esc(bankAccountLabel(a))}</div>
                <div class="dep-sub">${detail}</div>
            </div>
            <button type="button" class="dep-icon-btn" title="Edit" onclick="editBankAccount('${a.bank_account_id}')">&#9999;&#65039;</button>
        </div>
    `;
}


function bankFormHtml(a) {

    const v = a || {};

    const field = (id, label, value, placeholder) => `
        <div>
            <label>${label}</label>
            <input id="${id}" value="${esc(value)}" placeholder="${esc(placeholder || "")}">
        </div>
    `;

    return `
        <div class="dep-bank-card dep-bank-editing">
            <div class="dep-bank-title">${a ? esc(bankAccountLabel(a)) : "New bank account"}</div>
            <div class="dep-bank-grid">
                ${field("bk_bank", "Bank", v.bank)}
                ${field("bk_branch", "Branch", v.branch)}
                ${field("bk_type", "Account type", v.account_type)}
                ${field("bk_mobile", "Linked mobile", v.linked_mobile)}
                ${field("bk_holder", "Holder name, as the bank prints it", v.holder_name)}
                ${field("bk_nominee", "RD nominee", v.rd_nominee)}
                ${field("bk_acct", "Account number", v.account_no, "Not set")}
                ${field("bk_ifsc", "IFSC code", v.ifsc_code, "Not set")}
                ${field("bk_cust", "Customer ID", v.customer_id, "Not set")}
                ${field("bk_micr", "MICR code", v.micr_code, "Not set")}
            </div>
            <div class="dep-bank-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="cancelBankEdit()">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="saveBankAccount()">Save</button>
            </div>
        </div>
    `;
}


function renderBankAccounts() {

    const box = document.getElementById("bankList");

    const cards = [];

    if (bankEditingId === "NEW") {
        cards.push(bankFormHtml(null));
    }

    bankAccountData.forEach(a => {
        cards.push(
            bankEditingId === a.bank_account_id ? bankFormHtml(a) : bankSummaryHtml(a)
        );
    });

    box.innerHTML = cards.length
        ? cards.join("")
        : `<div class="empty-state">No bank accounts yet</div>`;
}


async function saveBankAccount() {

    const text = id => getInputValue(id).trim();
    const optional = id => text(id) || null;

    const bank = text("bk_bank");
    const holder = text("bk_holder");

    if (!bank) {
        showError("Bank is required");
        return;
    }

    if (!holder) {
        showError("Holder name is required");
        return;
    }

    const payload = {
        bank: bank,
        branch: optional("bk_branch"),
        account_type: optional("bk_type"),
        holder_name: holder,
        rd_nominee: optional("bk_nominee"),
        linked_mobile: optional("bk_mobile"),
        account_no: optional("bk_acct"),
        ifsc_code: optional("bk_ifsc"),
        customer_id: optional("bk_cust"),
        micr_code: optional("bk_micr"),
        updated_by: getCurrentUser()
    };

    try {

        let result;

        if (bankEditingId === "NEW") {
            payload.created_by = getCurrentUser();
            result = await insertData("bank_account", payload);
        } else {
            payload.updated_at = new Date().toISOString();
            result = await updateData("bank_account", "bank_account_id", bankEditingId, payload);
        }

        assertSaved(result, "Unable to save bank account");

        bankEditingId = null;

        await loadBankAccounts();

        renderBankAccounts();

        renderDepositFeed();

        showSuccess("Bank account saved");

    } catch (error) {

        console.error(error);
        showError(error.message || "Unable to save bank account");
    }
}


// ======================================================
// KEYBOARD
// ======================================================

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeModal("depositModal");
            closeModal("bankModal");
            return;
        }

        const modal = document.getElementById("depositModal");

        if (modal && (modal.style.display === "flex" || modal.style.display === "block")) {

            const active = document.activeElement;

            const inNotes = active && active.id === "depNotes";
            const inCloseSection = active && active.closest && (active.closest("#depCloseSection") || active.closest("#depAttachments"));
            const onButton = active && active.tagName === "BUTTON";

            // Enter saves — except in the notes box, inside the hidden close
            // section or the attachments section (so a closing date or a file
            // choice can't trigger a plain save), or on a button (where Enter
            // already means "press it").
            if (event.key === "Enter" && !inNotes && !inCloseSection && !onButton) {
                event.preventDefault();
                saveDeposit();
            }
        }
    }
);
