// AC v2.0 BANKNDEPOSITS

// Mutual funds: what you hold, what it was last worth, and a one-screen way
// to record today's values.
//
// HOW VALUES ARE KEPT
//   * A holding (mf_holding) says WHAT it is. What it is WORTH lives in dated
//     snapshots (mf_valuation), one per fund per day. Nothing about value or
//     gain is ever stored on the holding itself: it is worked out here.
//   * A snapshot always has a value. It may also have an "invested" figure.
//     For a SIP the invested amount grows with every instalment, so old
//     snapshots cannot be reconstructed; the page uses the most recent
//     invested figure recorded at or before a snapshot, and says so with a "~"
//     when that figure is older than the snapshot it is paired with.
//   * Totals (invested, current, gain) cover only the funds you still hold
//     (Active or Locked) that have BOTH a value and an invested figure, and the
//     page says how many it left out. A redeemed fund shows what was received.
//
// The Update values screen saves one snapshot per fund for one date. Saving
// again for the same date changes that day's snapshot instead of adding a
// second one.

const MF_STALE_DAYS = 30;

// "Sept" because that is how this app's own dates read (formatDate uses en-IN)
const MF_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

let personData = [];
let bankAccountData = [];
let holdingData = [];
let valuationData = [];

// holding id -> its snapshots, newest first
let valuesByHolding = {};

let attCounts = {};

let mfAtts = null;

// Update screen: funds the user has typed into, so changing the date does not
// wipe what they have entered.
let updTouched = {};


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateStaticSelects();

        mfAtts = createAttachmentSection({
            containerId: "mfAttachments", parentColumn: "mf_holding_id",
            folder: "mf_holding", docTypes: MASTERS.ATTACHMENT_DOC_TYPES.mf_holding
        });

        await loadAll();

        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get("action") === "new") {
            newHolding();
        }

        if (urlParams.get("action") === "update") {
            openUpdate();
        }

        window.history.replaceState({}, document.title, window.location.pathname);
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


// whole rupees, Indian digit grouping: 338451 -> "₹3,38,451"
function inr0(value) {

    return "\u20B9" + Math.round(Number(value)).toLocaleString("en-IN");
}


// with paise, for the value history
function inr2(value) {

    if (value === null || value === undefined || value === "") {
        return "&mdash;";
    }

    return "\u20B9" + Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function signedInr0(value) {

    const n = Math.round(Number(value));

    return `${n < 0 ? "\u2212" : "+"}\u20B9${Math.abs(n).toLocaleString("en-IN")}`;
}


function signedPct(value) {

    return `${value < 0 ? "\u2212" : "+"}${Math.abs(value).toFixed(1)}%`;
}


function agoText(days) {

    if (days < 60) {
        return `${plural(days, "day")} ago`;
    }

    if (days < 730) {
        return `${Math.round(days / 30.4375)} months ago`;
    }

    return `${plural(Math.floor(days / 365.25), "year")} ago`;
}


// "2018-06-25" -> "Jun 2018"
function monthYear(iso) {

    const { y, m } = insParts(iso);

    return `${MF_MONTHS[m - 1]} ${y}`;
}


function personById(id) {

    return personData.find(p => p.person_id === id);
}


function firstName(p) {

    return p ? p.full_name.split(" ")[0] : "";
}


function bankById(id) {

    return bankAccountData.find(b => b.bank_account_id === id);
}


function bankLabel(b) {

    return [b.bank, b.branch, b.account_type].filter(Boolean).join(" \u00B7 ");
}


function defaultPersonId() {

    const self = personData.find(p => p.relationship === "Self");

    return self ? self.person_id : (personData[0] ? personData[0].person_id : "");
}


function assertSaved(result, fallbackMessage) {

    if (Array.isArray(result)) {
        return result;
    }

    const detail = result && (result.message || result.hint || result.details);

    throw new Error(detail ? `${fallbackMessage} \u2014 ${detail}` : fallbackMessage);
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


function setChip(id, text, warn) {

    const el = document.getElementById(id);

    if (!el) {
        return;
    }

    el.textContent = text;
    el.classList.toggle("vault-chip-warn", !!warn);
}


function clipHtml(count) {

    return `<span class="vault-clip${count === 0 ? " vault-clip-zero" : ""}" title="Attached files">&#128206; ${count}</span>`;
}


function options(list, selected) {

    return list.map(v => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}


// ======================================================
// DROPDOWNS
// ======================================================

function populateStaticSelects() {

    document.getElementById("mfStatus").innerHTML = options(MASTERS.MF_STATUS);
    document.getElementById("mfMode").innerHTML = `<option value="">&mdash;</option>` + options(MASTERS.MF_MODES);
    document.getElementById("mfPattern").innerHTML = options(MASTERS.MF_HOLDING_PATTERNS);
}


function populateDynamicSelects() {

    document.getElementById("mfPerson").innerHTML = personData
        .map(p => `<option value="${p.person_id}">${esc(p.full_name)}${p.relationship ? ` (${esc(p.relationship.toLowerCase())})` : ""}</option>`)
        .join("");

    document.getElementById("mfBank").innerHTML =
        `<option value="">Direct (no bank or broker)</option>` +
        bankAccountData.map(b => `<option value="${b.bank_account_id}">${esc(bankLabel(b))}</option>`).join("");

    const previous = document.getElementById("mfPersonFilter").value || "All";

    document.getElementById("mfPersonFilter").innerHTML =
        `<option value="All">All people</option>` +
        personData.map(p => `<option value="${p.person_id}">${esc(p.full_name)}</option>`).join("");

    document.getElementById("mfPersonFilter").value =
        previous === "All" || personById(previous) ? previous : "All";
}


// ======================================================
// LOAD
// ======================================================

async function loadAll() {

    const people = await fetchAll("person?order=full_name.asc");
    const banks = await fetchAll("bank_account?select=bank_account_id,bank,branch,account_type&order=bank.asc");
    const holdings = await fetchAll("mf_holding?order=fund_name.asc");
    const valuations = await fetchAll("mf_valuation?order=as_of_date.desc");

    if ([people, banks, holdings, valuations].some(r => r === null)) {
        showError("Unable to load some of your mutual funds");
    }

    personData = people || [];
    bankAccountData = banks || [];
    holdingData = holdings || [];
    valuationData = valuations || [];

    valuesByHolding = {};

    valuationData
        .slice()
        .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date)))
        .forEach(v => {
            (valuesByHolding[v.mf_holding_id] = valuesByHolding[v.mf_holding_id] || []).push(v);
        });

    attCounts = await fetchAttachmentCounts("mf_holding_id");

    populateDynamicSelects();

    renderMf();
}


// The refresh button: reloads from the database, not just a re-render.
async function refreshMf() {

    await loadAll();
}


// ======================================================
// VALUE AND GAIN: all worked out here, nothing stored
// ======================================================

function snapshotsOf(id) {

    return valuesByHolding[id] || [];
}


// The most recent invested figure recorded at or before snapshot number
// `index` (0 = the newest). Returns { amount, date } or null.
function investedFrom(id, index) {

    const list = snapshotsOf(id);

    for (let i = index; i < list.length; i++) {

        if (list[i].invested_value !== null && list[i].invested_value !== undefined) {
            return { amount: Number(list[i].invested_value), date: list[i].as_of_date };
        }
    }

    return null;
}


function gainOf(current, invested) {

    if (invested === null || invested === undefined) {
        return { gain: null, pct: null };
    }

    return {
        gain: current - invested,
        pct: invested === 0 ? null : ((current - invested) / invested) * 100
    };
}


// The newest value of a holding, with its gain where an invested figure is known.
function latestInfo(h) {

    const list = snapshotsOf(h.mf_holding_id);

    if (list.length === 0) {
        return null;
    }

    const snap = list[0];
    const current = Number(snap.current_value);
    const inv = investedFrom(h.mf_holding_id, 0);
    const g = gainOf(current, inv ? inv.amount : null);

    return {
        date: snap.as_of_date,
        current,
        invested: inv ? inv.amount : null,
        investedDate: inv ? inv.date : null,
        approx: !!inv && inv.date !== snap.as_of_date,
        gain: g.gain,
        pct: g.pct
    };
}


// What a redeemed holding returned: the amount received if it was recorded,
// otherwise its last known value, against its last known invested figure.
function redeemedInfo(h) {

    const latest = latestInfo(h);
    const inv = investedFrom(h.mf_holding_id, 0);

    const received =
        h.redemption_amount !== null && h.redemption_amount !== undefined
            ? Number(h.redemption_amount)
            : (latest ? latest.current : null);

    if (received === null) {
        return null;
    }

    const g = gainOf(received, inv ? inv.amount : null);

    return { received, fromRecord: h.redemption_amount !== null && h.redemption_amount !== undefined, gain: g.gain, pct: g.pct };
}


function isHeld(h) {

    return h.status !== "Redeemed";
}


// ======================================================
// FILTER, SORT AND SUMMARY
// ======================================================

function getFilteredHoldings() {

    const search = document.getElementById("mfSearch").value.trim().toLowerCase();
    const status = document.getElementById("mfStatusFilter").value;
    const person = document.getElementById("mfPersonFilter").value;
    const sort = document.getElementById("mfSort").value;

    const rows = holdingData.filter(h => {

        if (status === "Holding" && !isHeld(h)) return false;
        if (status !== "Holding" && status !== "All" && h.status !== status) return false;
        if (person !== "All" && h.person_id !== person) return false;

        if (search) {

            const owner = personById(h.person_id);
            const bank = h.bank_account_id ? bankById(h.bank_account_id) : null;

            const haystack = [
                h.fund_name, h.scheme_name, h.folio_no, h.scheme_code,
                owner ? owner.full_name : "", bank ? bank.bank : ""
            ].join(" ").toLowerCase();

            if (!haystack.includes(search)) return false;
        }

        return true;
    });

    // Funds you still hold come before redeemed ones, whatever the sort.
    const rank = h => (isHeld(h) ? 0 : 1);

    const valueOf = h => {
        const info = latestInfo(h);
        return info ? info.current : -Infinity;
    };

    const pctOf = h => {
        const info = isHeld(h) ? latestInfo(h) : null;
        return info && info.pct !== null ? info.pct : -Infinity;
    };

    rows.sort((a, b) => {

        if (rank(a) !== rank(b)) {
            return rank(a) - rank(b);
        }

        if (sort === "value" && valueOf(a) !== valueOf(b)) {
            return valueOf(b) - valueOf(a);
        }

        if (sort === "gain" && pctOf(a) !== pctOf(b)) {
            return pctOf(b) - pctOf(a);
        }

        return a.fund_name.localeCompare(b.fund_name);
    });

    return rows;
}


function updateChips(today) {

    const held = holdingData.filter(isHeld);
    const locked = held.filter(h => h.status === "Locked").length;

    let invested = 0;
    let current = 0;
    let counted = 0;
    let latestDate = null;

    held.forEach(h => {

        const info = latestInfo(h);

        if (info && (latestDate === null || info.date > latestDate)) {
            latestDate = info.date;
        }

        if (info && info.invested !== null) {
            invested += info.invested;
            current += info.current;
            counted++;
        }
    });

    setChip("mfChipHolding", `Holding: ${held.length}${locked ? ` (${locked} locked)` : ""}`);

    if (counted === 0) {

        setChip("mfChipInvested", "Invested: \u2014");
        setChip("mfChipCurrent", "Current value: \u2014");
        setChip("mfChipGain", "Gain: \u2014");

    } else {

        const g = gainOf(current, invested);

        setChip("mfChipInvested", `Invested: ${inr0(invested)}`);
        setChip("mfChipCurrent", `Current value: ${inr0(current)}`);
        setChip("mfChipGain", `Gain: ${signedInr0(g.gain)}${g.pct === null ? "" : ` (${signedPct(g.pct)})`}`, g.gain < 0);
    }

    if (latestDate === null) {

        setChip("mfChipAsOf", "Values as of: \u2014");

    } else {

        const days = insDaysBetween(latestDate, today);

        setChip(
            "mfChipAsOf",
            `Values as of ${formatDate(latestDate)}${days > MF_STALE_DAYS ? ` (${agoText(days)})` : ""}`,
            days > MF_STALE_DAYS
        );
    }

    const left = held.length - counted;

    document.getElementById("mfTotalsNote").textContent =
        left > 0
            ? `${plural(left, "holding")} without a value and an invested figure ${left === 1 ? "is" : "are"} left out of these totals.`
            : "";
}


// ======================================================
// LIST
// ======================================================

function modeText(h) {

    if (h.investment_mode === "SIP (Monthly)") {

        return [
            h.installment_amount !== null ? `SIP ${inr0(h.installment_amount)} a month` : "SIP",
            h.start_date ? `since ${monthYear(h.start_date)}` : ""
        ].filter(Boolean).join(" ");
    }

    if (h.investment_mode === "Lumpsum") {

        return h.installment_amount !== null ? `Lumpsum ${inr0(h.installment_amount)}` : "Lumpsum";
    }

    return "";
}


function gainHtml(gain, pct, approx, title) {

    if (gain === null) {
        return "";
    }

    return `<div class="mf-gain ${gain < 0 ? "mf-gain-down" : "mf-gain-up"}"${title ? ` title="${esc(title)}"` : ""}>${approx ? "~" : ""}${signedInr0(gain)}${pct === null ? "" : ` (${signedPct(pct)})`}</div>`;
}


function buildRowHtml(h, today) {

    const id = h.mf_holding_id;
    const owner = personById(h.person_id);
    const bank = h.bank_account_id ? bankById(h.bank_account_id) : null;
    const held = isHeld(h);

    const sub = [
        owner ? esc(firstName(owner)) : "",
        bank ? esc(bank.bank) : "Direct",
        h.folio_no ? `folio ${esc(h.folio_no)}` : "",
        esc(modeText(h))
    ].filter(Boolean).join(" &middot; ");

    const scheme = h.scheme_name && h.scheme_name !== h.fund_name
        ? `<div class="mf-scheme">${esc(h.scheme_name)}</div>` : "";

    const badge =
        h.status === "Locked" ? ` <span class="vault-badge vault-badge-warn">Locked</span>`
        : h.status === "Redeemed" ? ` <span class="vault-badge vault-badge-type">Redeemed</span>`
        : "";

    let status;

    if (held) {

        const info = latestInfo(h);

        if (!info) {

            status = `<span class="vault-faint">No value yet</span>`;

        } else {

            const days = insDaysBetween(info.date, today);

            status = `
                <div class="mf-value">${inr0(info.current)}</div>
                ${gainHtml(info.gain, info.pct, info.approx, info.approx ? `The invested figure is from ${formatDate(info.investedDate)}` : "")}
                <div class="mf-asof">as of ${esc(formatDate(info.date))}</div>
                ${days > MF_STALE_DAYS ? `<span class="vault-badge vault-badge-warn">Updated ${esc(agoText(days))}</span>` : ""}
            `;
        }

    } else {

        const r = redeemedInfo(h);

        status = `
            <div>${h.redeemed_on ? `Redeemed ${esc(formatDate(h.redeemed_on))}` : "Redeemed"}</div>
            ${r ? `<div class="mf-value">${inr0(r.received)}</div><div class="mf-asof">${r.fromRecord ? "received" : "last value"}</div>` : ""}
            ${r ? gainHtml(r.gain, r.pct, false, "") : ""}
        `;
    }

    return `
        <div class="vault-row">
            <span class="vault-icon">&#128200;</span>
            <div class="vault-main">
                <div class="vault-title">${esc(h.fund_name)}${badge}</div>
                <div class="vault-sub">${sub}</div>
                ${scheme}
            </div>
            <div class="vault-status">${status}</div>
            ${clipHtml(attCounts[id] || 0)}
            <button type="button" class="vault-icon-btn" title="Edit" onclick="editHolding('${id}')">&#9999;&#65039;</button>
        </div>
    `;
}


function renderMf() {

    const feed = document.getElementById("mfFeed");

    if (!feed) {
        return;
    }

    const today = getToday();

    updateChips(today);

    const rows = getFilteredHoldings();

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">No holdings found</div>`;
        return;
    }

    feed.innerHTML = `<div class="vault-list">${rows.map(h => buildRowHtml(h, today)).join("")}</div>`;
}


// ======================================================
// HOLDING FORM
// ======================================================

function onMfStatusChanged() {

    const status = getInputValue("mfStatus");

    document.getElementById("mfRedeemBox").style.display = status === "Redeemed" ? "" : "none";

    document.getElementById("mfStatusHint").textContent =
        status === "Locked" ? "Locked: still inside a lock-in period, so it cannot be sold yet."
        : status === "Redeemed" ? "Redeemed: sold in full. Record when, and what was received."
        : "";
}


function onMfModeChanged() {

    const mode = getInputValue("mfMode");

    document.getElementById("mfAmountLabel").innerHTML =
        mode === "SIP (Monthly)" ? "Instalment (&#8377; a month)"
        : mode === "Lumpsum" ? "Amount invested (&#8377;)"
        : "Amount (&#8377;)";
}


function fillMfForm(h) {

    const v = h || {};

    setInputValue("mfId", h ? v.mf_holding_id : "");
    setInputValue("mfPerson", v.person_id || defaultPersonId());
    setInputValue("mfStatus", v.status || "Active");
    setInputValue("mfFund", v.fund_name || "");
    setInputValue("mfScheme", v.scheme_name || "");
    setInputValue("mfBank", v.bank_account_id || "");
    setInputValue("mfAccount", v.account_no || "");
    setInputValue("mfFolio", v.folio_no || "");
    setInputValue("mfCode", v.scheme_code || "");
    setInputValue("mfPattern", v.holding_pattern || MASTERS.MF_HOLDING_PATTERNS[0]);
    setInputValue("mfMode", v.investment_mode || "");
    setInputValue("mfStart", v.start_date ? String(v.start_date).substring(0, 10) : "");
    setInputValue("mfAmount", v.installment_amount !== null && v.installment_amount !== undefined ? v.installment_amount : "");
    setInputValue("mfNominee", v.nominee || "");
    setInputValue("mfRedeemedOn", v.redeemed_on ? String(v.redeemed_on).substring(0, 10) : "");
    setInputValue("mfRedeemedAmount", v.redemption_amount !== null && v.redemption_amount !== undefined ? v.redemption_amount : "");
    setInputValue("mfNotes", v.notes || "");

    document.getElementById("mfModalTitle").textContent = h ? "Edit holding" : "New holding";

    onMfStatusChanged();
    onMfModeChanged();

    renderHistory(h ? v.mf_holding_id : null);
}


function newHolding() {

    fillMfForm(null);

    mfAtts.reset();

    openModal("mfModal");

    document.getElementById("mfFund").focus();
}


function editHolding(id) {

    const h = holdingData.find(x => x.mf_holding_id === id);

    if (!h) {
        return;
    }

    fillMfForm(h);

    mfAtts.load(id);

    openModal("mfModal");

    document.getElementById("mfFund").focus();
}


function collectMfPayload() {

    const text = id => getInputValue(id).trim();
    const optional = id => text(id) || null;

    const amount = id => {

        const raw = text(id);

        if (raw === "") {
            return null;
        }

        const n = Number(raw);

        if (!Number.isFinite(n) || n < 0) {
            throw new Error("Amounts must be zero or more");
        }

        return n;
    };

    const personId = getInputValue("mfPerson");
    const status = getInputValue("mfStatus");

    if (!personById(personId)) throw new Error("Choose the holder");
    if (!text("mfFund")) throw new Error("Enter the fund name");
    if (!MASTERS.MF_STATUS.includes(status)) throw new Error("Choose a status");

    const start = getInputValue("mfStart") || null;
    const redeemedOn = status === "Redeemed" ? (getInputValue("mfRedeemedOn") || null) : null;

    if (start && redeemedOn && redeemedOn < start) {
        throw new Error("The redeemed date can't be before the start date");
    }

    return {
        person_id: personId,
        bank_account_id: getInputValue("mfBank") || null,
        fund_name: text("mfFund"),
        scheme_name: optional("mfScheme"),
        folio_no: optional("mfFolio"),
        scheme_code: optional("mfCode"),
        account_no: optional("mfAccount"),
        holding_pattern: getInputValue("mfPattern") || null,
        investment_mode: getInputValue("mfMode") || null,
        start_date: start,
        installment_amount: amount("mfAmount"),
        nominee: optional("mfNominee"),
        status,
        // These only mean something for a redeemed holding: setting it back to
        // Active or Locked clears them.
        redeemed_on: redeemedOn,
        redemption_amount: status === "Redeemed" ? amount("mfRedeemedAmount") : null,
        notes: optional("mfNotes"),
        updated_by: getCurrentUser()
    };
}


function saveHolding() {

    return persistRecord({
        label: "Holding",
        table: "mf_holding",
        idField: "mf_holding_id",
        id: getInputValue("mfId"),
        collect: collectMfPayload,
        atts: mfAtts,
        idInput: "mfId",
        modalId: "mfModal"
    });
}


// ------------------------------------------------------
// Value history inside the holding form
// ------------------------------------------------------

function renderHistory(holdingId) {

    const box = document.getElementById("mfHistoryBox");
    const target = document.getElementById("mfHistory");

    if (!holdingId) {
        box.style.display = "none";
        target.innerHTML = "";
        return;
    }

    box.style.display = "";

    const list = snapshotsOf(holdingId);

    if (list.length === 0) {
        target.innerHTML = `<div class="vault-hint">No values recorded yet. Use Update values to add one.</div>`;
        return;
    }

    target.innerHTML = `
        <div class="mf-hist-wrap">
            <table class="mf-hist">
                <thead><tr><th>Date</th><th class="mf-num">Invested</th><th class="mf-num">Value</th><th class="mf-num">Gain</th><th></th></tr></thead>
                <tbody>
                    ${list.map((s, i) => {

                        const inv = s.invested_value === null ? null : Number(s.invested_value);
                        const g = gainOf(Number(s.current_value), inv);

                        return `
                            <tr>
                                <td>${esc(formatDate(s.as_of_date))}</td>
                                <td class="mf-num">${inr2(s.invested_value)}</td>
                                <td class="mf-num">${inr2(s.current_value)}</td>
                                <td class="mf-num">${g.pct === null ? "&mdash;" : `<span class="${g.gain < 0 ? "mf-gain-down" : "mf-gain-up"}">${signedPct(g.pct)}</span>`}</td>
                                <td class="mf-num"><button type="button" class="vault-icon-btn" title="Delete this value" onclick="deleteSnapshot('${s.mf_valuation_id}')">&#10006;</button></td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}


async function deleteSnapshot(id) {

    const snap = valuationData.find(v => v.mf_valuation_id === id);

    if (!snap) {
        return;
    }

    if (!confirmAction(`Delete the value for ${formatDate(snap.as_of_date)}?`)) {
        return;
    }

    try {

        const deleted = await deleteData("mf_valuation", "mf_valuation_id", id);

        if (!Array.isArray(deleted) || deleted.length === 0) {
            throw new Error("Unable to delete the value");
        }

        const holdingId = snap.mf_holding_id;

        await loadAll();

        renderHistory(holdingId);

        showSuccess("Value deleted");

    } catch (error) {

        console.error(error);
        showError(error.message || "Unable to delete the value");
    }
}


// ======================================================
// UPDATE VALUES
// ======================================================

function updatableHoldings() {

    return holdingData
        .filter(isHeld)
        .sort((a, b) => a.fund_name.localeCompare(b.fund_name));
}


function snapshotOn(holdingId, iso) {

    return snapshotsOf(holdingId).find(s => String(s.as_of_date).substring(0, 10) === iso) || null;
}


function openUpdate() {

    updTouched = {};

    setInputValue("updDate", getToday());

    renderUpdateRows();

    openModal("updModal");

    const first = document.querySelector("#updRows input[id^='updVal_']");

    if (first) {
        first.focus();
    }
}


function touchUpdate(id) {

    updTouched[id] = true;
}


// Builds one row per fund you still hold. For the chosen date: a fund that
// already has a value that day shows it (and saving changes it); otherwise the
// invested figure starts from the latest known one and the value is empty.
function renderUpdateRows() {

    const date = getInputValue("updDate");
    const holdings = updatableHoldings();

    // keep whatever has been typed
    const typed = {};

    holdings.forEach(h => {

        const id = h.mf_holding_id;

        if (updTouched[id] && document.getElementById(`updVal_${id}`)) {
            typed[id] = { inv: getInputValue(`updInv_${id}`), val: getInputValue(`updVal_${id}`) };
        }
    });

    const rows = document.getElementById("updRows");

    if (holdings.length === 0) {
        rows.innerHTML = `<div class="empty-state">You don't hold any funds right now.</div>`;
        document.getElementById("updHint").textContent = "";
        return;
    }

    rows.innerHTML = holdings.map(h => {

        const id = h.mf_holding_id;
        const latest = latestInfo(h);

        return `
            <div class="mf-upd-row">
                <div>
                    <div class="mf-upd-name">${esc(h.fund_name)}</div>
                    <div class="mf-upd-last">${latest ? `Last: ${inr0(latest.current)} on ${esc(formatDate(latest.date))}` : "No value yet"}</div>
                </div>
                <div>
                    <label for="updInv_${id}">Invested (&#8377;)</label>
                    <input type="number" id="updInv_${id}" min="0" step="0.01" oninput="touchUpdate('${id}')">
                </div>
                <div>
                    <label for="updVal_${id}">Value (&#8377;)</label>
                    <input type="number" id="updVal_${id}" min="0" step="0.01" oninput="touchUpdate('${id}')">
                </div>
            </div>
        `;
    }).join("");

    let existing = 0;

    holdings.forEach(h => {

        const id = h.mf_holding_id;

        if (typed[id]) {

            setInputValue(`updInv_${id}`, typed[id].inv);
            setInputValue(`updVal_${id}`, typed[id].val);

            return;
        }

        const snap = date ? snapshotOn(id, date) : null;

        if (snap) {

            existing++;

            setInputValue(`updInv_${id}`, snap.invested_value === null ? "" : snap.invested_value);
            setInputValue(`updVal_${id}`, snap.current_value);

            return;
        }

        const inv = investedFrom(id, 0);

        setInputValue(`updInv_${id}`, inv ? inv.amount : "");
        setInputValue(`updVal_${id}`, "");
    });

    document.getElementById("updHint").textContent =
        existing > 0
            ? `${plural(existing, "fund")} already ${existing === 1 ? "has" : "have"} a value on this date. Saving changes ${existing === 1 ? "it" : "them"}.`
            : "Leave a fund's value empty to skip it. For a SIP, raise the invested figure by the instalments since the last update.";
}


async function saveUpdates() {

    const date = getInputValue("updDate");

    if (!date) {
        showError("Choose the date of these values");
        return false;
    }

    if (date > getToday()) {
        showError("The date can't be in the future");
        return false;
    }

    const entries = [];

    try {

        updatableHoldings().forEach(h => {

            const id = h.mf_holding_id;
            const valueRaw = getInputValue(`updVal_${id}`).trim();

            if (valueRaw === "") {
                return;
            }

            const value = Number(valueRaw);
            const investedRaw = getInputValue(`updInv_${id}`).trim();
            const invested = investedRaw === "" ? null : Number(investedRaw);

            if (!Number.isFinite(value) || value < 0) {
                throw new Error(`The value for ${h.fund_name} must be zero or more`);
            }

            if (invested !== null && (!Number.isFinite(invested) || invested < 0)) {
                throw new Error(`The invested figure for ${h.fund_name} must be zero or more`);
            }

            entries.push({ holding: h, value, invested });
        });

    } catch (error) {

        showError(error.message);
        return false;
    }

    if (entries.length === 0) {
        showError("Enter at least one value");
        return false;
    }

    let saved = 0;
    const failed = [];

    for (const e of entries) {

        const existing = snapshotOn(e.holding.mf_holding_id, date);

        try {

            if (existing) {

                const rows = assertSaved(
                    await updateData("mf_valuation", "mf_valuation_id", existing.mf_valuation_id, {
                        invested_value: e.invested,
                        current_value: e.value,
                        updated_at: new Date().toISOString(),
                        updated_by: getCurrentUser()
                    }),
                    "Unable to save"
                );

                if (rows.length === 0) {
                    throw new Error("not found");
                }

            } else {

                assertSaved(
                    await insertData("mf_valuation", {
                        mf_holding_id: e.holding.mf_holding_id,
                        as_of_date: date,
                        invested_value: e.invested,
                        current_value: e.value,
                        created_by: getCurrentUser(),
                        updated_by: getCurrentUser()
                    }),
                    "Unable to save"
                );
            }

            saved++;

        } catch (error) {

            console.error(error);
            failed.push(e.holding.fund_name);
        }
    }

    // Whatever happened, show what is really in the database now.
    await loadAll();

    if (failed.length > 0) {

        // The screen stays open: values that did save now show as existing for
        // this date, so pressing Save again just repeats them harmlessly.
        renderUpdateRows();

        showError(`${plural(saved, "value")} saved, ${failed.length} failed: ${failed.join(", ")}`);

        return false;
    }

    closeModal("updModal");

    showSuccess(saved === 1 ? "1 value saved" : `${saved} values saved`);

    return true;
}


// ======================================================
// SAVE (shared by the holding form)
// ======================================================

async function persistRecord(cfg) {

    let payload;

    try {
        payload = cfg.collect();
    } catch (error) {
        showError(error.message);
        return false;
    }

    try {

        let recordId = cfg.id;

        if (cfg.id) {

            payload.updated_at = new Date().toISOString();

            const rows = assertSaved(await updateData(cfg.table, cfg.idField, cfg.id, payload), `Unable to save ${cfg.label.toLowerCase()}`);

            if (rows.length === 0) {
                throw new Error(`Unable to save ${cfg.label.toLowerCase()} \u2014 it was not found, or you may not change it`);
            }

        } else {

            payload.created_by = getCurrentUser();

            const rows = assertSaved(await insertData(cfg.table, payload), `Unable to save ${cfg.label.toLowerCase()}`);

            recordId = rows[0] ? rows[0][cfg.idField] : null;

            // The record now exists. If something later in this save fails the
            // form stays open, and pressing Save again must UPDATE it, not
            // insert a second copy.
            if (recordId && cfg.idInput) {
                setInputValue(cfg.idInput, recordId);
            }
        }

        // Upload any staged files now that the record has an id. A failed
        // upload is reported by the section and never undoes the record.
        if (recordId && cfg.atts) {
            await cfg.atts.commit(recordId);
        }

        closeModal(cfg.modalId);

        await loadAll();

        showSuccess(`${cfg.label} saved`);

        return true;

    } catch (error) {

        console.error(error);
        showError(error.message || `Unable to save ${cfg.label.toLowerCase()}`);

        return false;
    }
}


// ======================================================
// KEYBOARD
// ======================================================

function isModalOpen(id) {

    const el = document.getElementById(id);

    return !!el && (el.style.display === "flex" || el.style.display === "block");
}


document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeModal("mfModal");
            closeModal("updModal");
            return;
        }

        if (event.key !== "Enter") {
            return;
        }

        const active = document.activeElement;

        // Update values: Enter moves to the next box, so a run of values can be
        // typed quickly without saving half-finished work by accident.
        if (isModalOpen("updModal")) {

            if (active && active.tagName === "INPUT" && active.closest("#updRows")) {

                event.preventDefault();

                const boxes = [...document.querySelectorAll("#updRows input")];
                const next = boxes[boxes.indexOf(active) + 1];

                (next || document.getElementById("updSaveBtn")).focus();
            }

            return;
        }

        if (!isModalOpen("mfModal")) {
            return;
        }

        const inTextarea = active && active.tagName === "TEXTAREA";
        const inFiles = active && active.closest && (active.closest("#mfAttachments") || active.closest("#mfHistory"));
        const onControl = active && ["BUTTON", "SELECT", "A"].includes(active.tagName);

        // Enter saves -- except in the notes box, the attachments section,
        // the value history, or on a button, dropdown or link.
        if (!inTextarea && !inFiles && !onControl) {
            event.preventDefault();
            saveHolding();
        }
    }
);
