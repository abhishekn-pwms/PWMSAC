// AC v2.0 BANKNDEPOSITS

// The Vault: identity documents, cards, lockers and contacts, on one page
// with four tabs. Each has a list, a form, and the shared Attachments section
// (attachments.js) for scans, receipts and agreements.
//
// WHAT IS AND ISN'T KEPT
//   * Identity numbers are shown MASKED everywhere in the list. The eye
//     reveals one, the copy icon copies it. Nothing is ever put in a page
//     attribute: the full value stays in memory and is read from there.
//   * Cards keep only the last 4 digits, the expiry month and the linked
//     mobile. Never the full number, never the CVV.
//   * "Share with family" is a tick on a document (and on each of its
//     scans). Off by default; cards can never be shared.
//
// Expiry is worked out here from today's date: nothing about expiry is
// stored. Date arithmetic reuses insurance-schedule.js.

let personData = [];
let bankAccountData = [];
let docData = [];
let cardData = [];
let lockerData = [];
let contactData = [];

let attCounts = { doc: {}, card: {}, locker: {}, contact: {} };

let activeTab = "identity";

const revealedNumbers = new Set();

let docAtts = null;
let cardAtts = null;
let lockAtts = null;
let contAtts = null;

const VAULT_SOON_DAYS = 90;

const VAULT_TABS = {
    identity: { label: "+ New Document", create: () => newDocument() },
    cards: { label: "+ New Card", create: () => newCard() },
    lockers: { label: "+ New Locker", create: () => newLocker() },
    contacts: { label: "+ New Contact", create: () => newContact() }
};


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        populateStaticSelects();

        docAtts = createAttachmentSection({
            containerId: "docAttachments", parentColumn: "identity_document_id",
            folder: "identity_document", docTypes: MASTERS.ATTACHMENT_DOC_TYPES.identity_document
        });

        cardAtts = createAttachmentSection({
            containerId: "cardAttachments", parentColumn: "card_id",
            folder: "card", docTypes: MASTERS.ATTACHMENT_DOC_TYPES.card
        });

        lockAtts = createAttachmentSection({
            containerId: "lockAttachments", parentColumn: "locker_id",
            folder: "locker", docTypes: MASTERS.ATTACHMENT_DOC_TYPES.locker
        });

        contAtts = createAttachmentSection({
            containerId: "contAttachments", parentColumn: "contact_id",
            folder: "contact", docTypes: MASTERS.ATTACHMENT_DOC_TYPES.contact
        });

        await loadAll();

        const urlParams = new URLSearchParams(window.location.search);

        if (VAULT_TABS[urlParams.get("tab")]) {
            showVaultTab(urlParams.get("tab"));
        }

        if (urlParams.get("action") === "new") {
            newVaultItem();
        }

        // A link from the Invest dashboard: ?tab=<tab>&open=<id> opens that record
        const openId = urlParams.get("open");

        if (openId) {

            const opener = { identity: editDocument, cards: editCard, lockers: editLocker, contacts: editContact }[urlParams.get("tab")];

            if (opener) {
                opener(openId);
            }
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


function agoText(days) {

    if (days < 60) {
        return `${plural(days, "day")} ago`;
    }

    if (days < 730) {
        return `${Math.round(days / 30.4375)} months ago`;
    }

    return `${plural(Math.floor(days / 365.25), "year")} ago`;
}


// state: expired | soon | ok, with the words for the badge
function expiryInfo(iso, today) {

    const days = insDaysBetween(today, iso);

    if (days < 0) {
        return { days, state: "expired", label: `Expired ${agoText(-days)}` };
    }

    if (days <= VAULT_SOON_DAYS) {
        return { days, state: "soon", label: `Expires in ${plural(days, "day")}` };
    }

    return { days, state: "ok", label: "" };
}


function expiryBadgeHtml(info) {

    if (!info || info.state === "ok") {
        return "";
    }

    return `<span class="vault-badge ${info.state === "expired" ? "vault-badge-danger" : "vault-badge-warn"}">${esc(info.label)}</span>`;
}


function maskNumber(value) {

    const s = String(value);

    return "\u2022\u2022\u2022\u2022\u2022" + s.slice(-4);
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


// ======================================================
// DROPDOWNS
// ======================================================

function options(list, selected) {

    return list.map(v => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}


function populateStaticSelects() {

    document.getElementById("docType").innerHTML = options(MASTERS.IDENTITY_DOC_TYPES);
    document.getElementById("docTypeFilter").innerHTML = `<option value="All">All types</option>` + options(MASTERS.IDENTITY_DOC_TYPES);
    document.getElementById("cardType").innerHTML = options(MASTERS.CARD_TYPES);
    document.getElementById("cardTypeFilter").innerHTML = `<option value="All">All types</option>` + options(MASTERS.CARD_TYPES);
}


function populateDynamicSelects() {

    const people = personData
        .map(p => `<option value="${p.person_id}">${esc(p.full_name)}${p.relationship ? ` (${esc(p.relationship.toLowerCase())})` : ""}</option>`)
        .join("");

    document.getElementById("docPerson").innerHTML = people;
    document.getElementById("cardPerson").innerHTML = people;
    document.getElementById("lockPerson").innerHTML = `<option value="">&mdash;</option>` + people;

    const previous = document.getElementById("docPersonFilter").value || "All";

    document.getElementById("docPersonFilter").innerHTML =
        `<option value="All">All people</option>` +
        personData.map(p => `<option value="${p.person_id}">${esc(firstName(p))}</option>`).join("");

    document.getElementById("docPersonFilter").value = personById(previous) ? previous : "All";

    const banks = bankAccountData
        .map(b => `<option value="${b.bank_account_id}">${esc(bankLabel(b))}</option>`)
        .join("");

    document.getElementById("cardBank").innerHTML = `<option value="">None (a credit card, say)</option>` + banks;
    document.getElementById("lockBank").innerHTML = `<option value="">None</option>` + banks;
}


function defaultPersonId() {

    const self = personData.find(p => p.relationship === "Self");

    return self ? self.person_id : (personData[0] ? personData[0].person_id : "");
}


// ======================================================
// LOAD
// ======================================================

async function loadAll() {

    const people = await fetchAll("person?order=full_name.asc");
    const banks = await fetchAll("bank_account?select=bank_account_id,bank,branch,account_type,contact_id&order=bank.asc");
    const docs = await fetchAll("identity_document?order=doc_type.asc");
    const cards = await fetchAll("card?order=card_type.asc");
    const lockers = await fetchAll("locker?order=bank_branch.asc");
    const contacts = await fetchAll("contact?order=name.asc");

    if ([people, banks, docs, cards, lockers, contacts].some(r => r === null)) {
        showError("Unable to load some of the Vault");
    }

    personData = people || [];
    bankAccountData = banks || [];
    docData = docs || [];
    cardData = cards || [];
    lockerData = lockers || [];
    contactData = contacts || [];

    attCounts = {
        doc: await fetchAttachmentCounts("identity_document_id"),
        card: await fetchAttachmentCounts("card_id"),
        locker: await fetchAttachmentCounts("locker_id"),
        contact: await fetchAttachmentCounts("contact_id")
    };

    populateDynamicSelects();

    renderAll();
}


// The refresh button: reloads from the database, not just a re-render.
async function refreshVault() {

    await loadAll();
}


function renderAll() {

    renderIdentity();
    renderCards();
    renderLockers();
    renderContacts();
}


// ======================================================
// TABS
// ======================================================

function showVaultTab(tab) {

    if (!VAULT_TABS[tab]) {
        return;
    }

    activeTab = tab;

    Object.keys(VAULT_TABS).forEach(t => {
        document.getElementById(`panel-${t}`).style.display = t === tab ? "" : "none";
        document.getElementById(`tabBtn-${t}`).classList.toggle("active", t === tab);
    });

    document.getElementById("vaultNewBtn").textContent = VAULT_TABS[tab].label;
}


function newVaultItem() {

    VAULT_TABS[activeTab].create();
}


// ======================================================
// IDENTITY DOCUMENTS
// ======================================================

function typeOrder(type) {

    const i = MASTERS.IDENTITY_DOC_TYPES.indexOf(type);

    return i === -1 ? 99 : i;
}


function relationshipOrder(p) {

    const i = MASTERS.PERSON_RELATIONSHIPS.indexOf(p.relationship);

    return i === -1 ? 99 : i;
}


function getFilteredDocs() {

    const person = getInputValue("docPersonFilter") || "All";
    const type = getInputValue("docTypeFilter") || "All";
    const search = getInputValue("docSearch").trim().toLowerCase();

    return docData.filter(d => {

        if (person !== "All" && d.person_id !== person) return false;
        if (type !== "All" && d.doc_type !== type) return false;

        if (search) {
            const owner = personById(d.person_id);
            const haystack = `${d.doc_type} ${d.doc_number || ""} ${d.name_on_document || ""} ${d.issued_by || ""} ${d.notes || ""} ${owner ? owner.full_name : ""}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });
}


function updateDocChips(today) {

    let soon = 0;
    let expired = 0;

    docData.forEach(d => {

        if (!d.expiry_date) {
            return;
        }

        const info = expiryInfo(d.expiry_date, today);

        if (info.state === "expired") expired++;
        if (info.state === "soon") soon++;
    });

    const noScan = docData.filter(d => !attCounts.doc[d.identity_document_id]).length;

    setChip("docChipTotal", `Documents: ${docData.length}`);
    setChip("docChipSoon", `Expiring in 90 days: ${soon}`, soon > 0);
    setChip("docChipExpired", `Expired: ${expired}`, expired > 0);
    setChip("docChipNoScan", `Without a scan: ${noScan}`);
}


function buildDocRowHtml(d, today) {

    const id = d.identity_document_id;
    const info = d.expiry_date ? expiryInfo(d.expiry_date, today) : null;
    const isRevealed = revealedNumbers.has(id);

    const number = d.doc_number
        ? `<span class="vault-number">${esc(isRevealed ? d.doc_number : maskNumber(d.doc_number))}</span>
           <button type="button" class="vault-icon-btn" title="${isRevealed ? "Hide the number" : "Show the number"}" onclick="toggleNumber('${id}')">${isRevealed ? "&#128584;" : "&#128065;&#65039;"}</button>
           <button type="button" class="vault-icon-btn" title="Copy the number" onclick="copyNumber('${id}')">&#128203;</button>`
        : `<span class="vault-faint">no number yet</span>`;

    const when = [
        d.issue_date ? `issued ${esc(formatDate(d.issue_date))}` : "",
        d.issued_by ? esc(d.issued_by) : ""
    ].filter(Boolean).join(" &middot; ");

    let status;

    if (!d.expiry_date) {
        status = `<span class="vault-faint">No expiry</span>`;
    } else {
        status = `${expiryBadgeHtml(info)}<div class="vault-sub">${esc(formatDate(d.expiry_date))}</div>`;
    }

    return `
        <div class="vault-row">
            <span class="vault-icon">&#127380;</span>
            <div class="vault-main">
                <div class="vault-title">${esc(d.doc_type)}${d.share_with_family ? ` <span class="vault-badge vault-badge-share">Shared</span>` : ""}</div>
                <div class="vault-sub">${number}${when ? ` &middot; ${when}` : ""}</div>
            </div>
            <div class="vault-status">${status}</div>
            ${clipHtml(attCounts.doc[id] || 0)}
            <button type="button" class="vault-icon-btn" title="Edit" onclick="editDocument('${id}')">&#9999;&#65039;</button>
        </div>
    `;
}


function renderIdentity() {

    const feed = document.getElementById("docFeed");

    if (!feed) {
        return;
    }

    const today = getToday();

    updateDocChips(today);

    const rows = getFilteredDocs();

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">No documents found</div>`;
        return;
    }

    const groups = {};

    rows.forEach(d => { (groups[d.person_id] = groups[d.person_id] || []).push(d); });

    const people = Object.keys(groups)
        .map(id => personById(id) || { person_id: id, full_name: "Unknown person", relationship: "" })
        .sort((a, b) => relationshipOrder(a) - relationshipOrder(b) || a.full_name.localeCompare(b.full_name));

    feed.innerHTML = people.map(p => `
        <div class="vault-group-title">${esc(p.full_name)}${p.relationship ? ` <span class="vault-faint">&middot; ${esc(p.relationship.toLowerCase())}</span>` : ""}</div>
        <div class="vault-list">
            ${groups[p.person_id]
                .sort((a, b) => typeOrder(a.doc_type) - typeOrder(b.doc_type))
                .map(d => buildDocRowHtml(d, today)).join("")}
        </div>
    `).join("");
}


function toggleNumber(id) {

    if (revealedNumbers.has(id)) {
        revealedNumbers.delete(id);
    } else {
        revealedNumbers.add(id);
    }

    renderIdentity();
}


async function copyText(text) {

    try {

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

    } catch (error) { /* fall through to the older route */ }

    try {

        const box = document.createElement("textarea");
        box.value = text;
        box.style.position = "fixed";
        box.style.opacity = "0";
        document.body.appendChild(box);
        box.select();
        const done = document.execCommand("copy");
        document.body.removeChild(box);

        return done;

    } catch (error) {

        return false;
    }
}


async function copyNumber(id) {

    const d = docData.find(x => x.identity_document_id === id);

    if (!d || !d.doc_number) {
        return;
    }

    if (await copyText(d.doc_number)) {
        showSuccess("Number copied");
    } else {
        showError("Could not copy. Use the eye to show it, then copy it by hand");
    }
}


async function copyFormNumber() {

    const value = getInputValue("docNumber").trim();

    if (!value) {
        return;
    }

    if (await copyText(value)) {
        showSuccess("Number copied");
    } else {
        showError("Could not copy the number");
    }
}


function updateDocExpiryHint() {

    const el = document.getElementById("docExpiryHint");

    if (!el) {
        return;
    }

    const expiry = getInputValue("docExpiry");

    el.className = "vault-hint";

    if (!expiry) {
        el.textContent = "";
        return;
    }

    const info = expiryInfo(expiry, getToday());

    el.textContent = info.label ? `${info.label}.` : "";

    if (info.state === "expired") el.className = "vault-hint vault-danger";
    if (info.state === "soon") el.className = "vault-hint vault-warn";
}


function fillDocForm(d) {

    const v = d || {};

    setInputValue("docId", d ? v.identity_document_id : "");
    setInputValue("docPerson", v.person_id || defaultPersonId());
    setInputValue("docType", v.doc_type || MASTERS.IDENTITY_DOC_TYPES[0]);
    setInputValue("docNumber", v.doc_number || "");
    setInputValue("docNameOn", v.name_on_document || "");
    setInputValue("docRelative", v.relative_name || "");
    setInputValue("docIssuedBy", v.issued_by || "");
    setInputValue("docIssue", formatDateForInput(v.issue_date));
    setInputValue("docExpiry", formatDateForInput(v.expiry_date));
    setInputValue("docLinked", v.linked_contact || "");
    setInputValue("docNotes", v.notes || "");

    document.getElementById("docShare").checked = !!v.share_with_family;
    document.getElementById("docModalTitle").textContent = d ? "Edit document" : "New document";

    updateDocExpiryHint();
}


function newDocument() {

    fillDocForm(null);

    docAtts.reset();

    openModal("docModal");

    document.getElementById("docNumber").focus();
}


function editDocument(id) {

    const d = docData.find(x => x.identity_document_id === id);

    if (!d) {
        return;
    }

    fillDocForm(d);

    docAtts.load(id);

    openModal("docModal");

    document.getElementById("docNumber").focus();
}


function collectDocPayload() {

    const text = id => getInputValue(id).trim();
    const optional = id => text(id) || null;

    const personId = getInputValue("docPerson");
    const issue = getInputValue("docIssue");
    const expiry = getInputValue("docExpiry");

    if (!personById(personId)) throw new Error("Choose a person");
    if (issue && expiry && expiry < issue) throw new Error("The expiry date can't be before the issue date");

    return {
        person_id: personId,
        doc_type: getInputValue("docType"),
        doc_number: optional("docNumber"),
        name_on_document: optional("docNameOn"),
        relative_name: optional("docRelative"),
        issue_date: issue || null,
        expiry_date: expiry || null,
        issued_by: optional("docIssuedBy"),
        linked_contact: optional("docLinked"),
        notes: optional("docNotes"),
        share_with_family: document.getElementById("docShare").checked,
        updated_by: getCurrentUser()
    };
}


function saveDocument() {

    return persistRecord({
        label: "Document",
        table: "identity_document",
        idField: "identity_document_id",
        id: getInputValue("docId"),
        collect: collectDocPayload,
        atts: docAtts,
        idInput: "docId",
        modalId: "docModal"
    });
}


// ======================================================
// CARDS
// ======================================================

function getFilteredCards() {

    const type = getInputValue("cardTypeFilter") || "All";
    const search = getInputValue("cardSearch").trim().toLowerCase();

    return cardData.filter(c => {

        if (type !== "All" && c.card_type !== type) return false;

        if (search) {
            const owner = personById(c.person_id);
            const bank = c.bank_account_id ? bankById(c.bank_account_id) : null;
            const haystack = `${c.card_name || ""} ${c.card_type} ${c.last_digits || ""} ${c.linked_mobile || ""} ${owner ? owner.full_name : ""} ${bank ? bankLabel(bank) : ""}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });
}


// 2028-08-31 -> "08/28"
function monthYear(iso) {

    const { y, m } = insParts(iso);

    return `${String(m).padStart(2, "0")}/${String(y % 100).padStart(2, "0")}`;
}


function renderCards() {

    const feed = document.getElementById("cardFeed");

    if (!feed) {
        return;
    }

    const today = getToday();

    let soon = 0;
    let expired = 0;

    cardData.forEach(c => {

        if (!c.valid_till) {
            return;
        }

        const info = expiryInfo(c.valid_till, today);

        if (info.state === "expired") expired++;
        if (info.state === "soon") soon++;
    });

    setChip("cardChipTotal", `Cards: ${cardData.length}`);
    setChip("cardChipSoon", `Expiring in 90 days: ${soon}`, soon > 0);
    setChip("cardChipExpired", `Expired: ${expired}`, expired > 0);

    const rows = getFilteredCards();

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">No cards found</div>`;
        return;
    }

    feed.innerHTML = `<div class="vault-list">${rows.map(c => {

        const id = c.card_id;
        const owner = personById(c.person_id);
        const bank = c.bank_account_id ? bankById(c.bank_account_id) : null;
        const info = c.valid_till ? expiryInfo(c.valid_till, today) : null;

        const sub = [
            owner ? esc(firstName(owner)) : "",
            c.last_digits ? `ending ${esc(c.last_digits)}` : "",
            bank ? `linked to ${esc(bankLabel(bank))}` : "",
            c.linked_mobile ? `mobile ${esc(c.linked_mobile)}` : ""
        ].filter(Boolean).join(" &middot; ");

        return `
            <div class="vault-row">
                <span class="vault-icon">&#128179;</span>
                <div class="vault-main">
                    <div class="vault-title">${esc(c.card_name || `${c.card_type} card`)} <span class="vault-badge vault-badge-type">${esc(c.card_type)}</span></div>
                    <div class="vault-sub">${sub}</div>
                </div>
                <div class="vault-status">
                    ${c.valid_till ? `<div>Valid till ${esc(monthYear(c.valid_till))}</div>${expiryBadgeHtml(info)}` : `<span class="vault-faint">Valid till &mdash;</span>`}
                </div>
                ${clipHtml(attCounts.card[id] || 0)}
                <button type="button" class="vault-icon-btn" title="Edit" onclick="editCard('${id}')">&#9999;&#65039;</button>
            </div>
        `;
    }).join("")}</div>`;
}


function fillCardForm(c) {

    const v = c || {};

    setInputValue("cardId", c ? v.card_id : "");
    setInputValue("cardPerson", v.person_id || defaultPersonId());
    setInputValue("cardType", v.card_type || MASTERS.CARD_TYPES[0]);
    setInputValue("cardName", v.card_name || "");
    setInputValue("cardBank", v.bank_account_id || "");
    setInputValue("cardDigits", v.last_digits || "");
    setInputValue("cardValid", v.valid_till ? String(v.valid_till).substring(0, 7) : "");
    setInputValue("cardMobile", v.linked_mobile || "");
    setInputValue("cardNotes", v.notes || "");

    document.getElementById("cardModalTitle").textContent = c ? "Edit card" : "New card";
}


function newCard() {

    fillCardForm(null);

    cardAtts.reset();

    openModal("cardModal");

    document.getElementById("cardName").focus();
}


function editCard(id) {

    const c = cardData.find(x => x.card_id === id);

    if (!c) {
        return;
    }

    fillCardForm(c);

    cardAtts.load(id);

    openModal("cardModal");

    document.getElementById("cardName").focus();
}


// "2028-08" -> the last day of that month, so expiry reminders use a real date
function lastDayOfMonth(monthValue) {

    const [y, m] = monthValue.split("-").map(Number);

    return `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}


function collectCardPayload() {

    const text = id => getInputValue(id).trim();
    const optional = id => text(id) || null;

    const personId = getInputValue("cardPerson");
    const digits = text("cardDigits");
    const valid = getInputValue("cardValid");

    if (!personById(personId)) throw new Error("Choose the card holder");
    if (digits && !/^\d{4}$/.test(digits)) throw new Error("Last digits must be exactly 4 numbers");

    return {
        person_id: personId,
        card_type: getInputValue("cardType"),
        card_name: optional("cardName"),
        bank_account_id: getInputValue("cardBank") || null,
        last_digits: digits || null,
        valid_till: valid ? lastDayOfMonth(valid) : null,
        linked_mobile: optional("cardMobile"),
        notes: optional("cardNotes"),
        updated_by: getCurrentUser()
    };
}


function saveCard() {

    return persistRecord({
        label: "Card",
        table: "card",
        idField: "card_id",
        id: getInputValue("cardId"),
        collect: collectCardPayload,
        atts: cardAtts,
        idInput: "cardId",
        modalId: "cardModal"
    });
}


// ======================================================
// LOCKERS
// ======================================================

function renderLockers() {

    const feed = document.getElementById("lockFeed");

    if (!feed) {
        return;
    }

    const today = getToday();

    const dueSoon = lockerData.filter(l => {
        if (!l.rent_renewal_date) return false;
        const days = insDaysBetween(today, l.rent_renewal_date);
        return days >= 0 && days <= VAULT_SOON_DAYS;
    }).length;

    setChip("lockChipTotal", `Lockers: ${lockerData.length}`);
    setChip("lockChipRent", `Rent due in 90 days: ${dueSoon}`, dueSoon > 0);

    const search = getInputValue("lockSearch").trim().toLowerCase();

    const rows = lockerData.filter(l => {

        if (!search) return true;

        const owner = l.person_id ? personById(l.person_id) : null;

        return `${l.bank_branch} ${l.locker_no || ""} ${l.contents || ""} ${l.nominee || ""} ${owner ? owner.full_name : ""}`.toLowerCase().includes(search);
    });

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">${lockerData.length === 0 ? "No lockers yet. Add one with + New Locker." : "No lockers found"}</div>`;
        return;
    }

    feed.innerHTML = rows.map(l => {

        const id = l.locker_id;
        const owner = l.person_id ? personById(l.person_id) : null;

        const sub = [
            l.locker_no ? `Locker ${esc(l.locker_no)}` : "",
            owner ? `in the name of ${esc(firstName(owner))}` : "",
            l.branch_contact ? `branch contact ${esc(l.branch_contact)}` : ""
        ].filter(Boolean).join(" &middot; ");

        let renews = "&mdash;";

        if (l.rent_renewal_date) {

            const days = insDaysBetween(today, l.rent_renewal_date);

            renews = `${esc(formatDate(l.rent_renewal_date))} <span class="vault-sub${days < 0 ? " vault-warn" : ""}">${days < 0 ? `passed ${plural(-days, "day")} ago` : relDays(days)}</span>`;
        }

        return `
            <div class="vault-card">
                <div class="vault-card-head">
                    <div>
                        <div class="vault-title">${esc(l.bank_branch)}</div>
                        <div class="vault-sub">${sub}</div>
                    </div>
                    <div class="vault-card-actions">
                        ${clipHtml(attCounts.locker[id] || 0)}
                        <button type="button" class="vault-icon-btn" title="Edit" onclick="editLocker('${id}')">&#9999;&#65039;</button>
                    </div>
                </div>
                <div class="vault-facts">
                    <div><div class="vault-fact-label">Rent</div><div class="vault-fact-value">${l.rent_amount === null || l.rent_amount === undefined ? "&mdash;" : `${formatInr(l.rent_amount)} a year`}</div></div>
                    <div><div class="vault-fact-label">Rent renews</div><div class="vault-fact-value">${renews}</div></div>
                    <div><div class="vault-fact-label">Nominee</div><div class="vault-fact-value">${l.nominee ? esc(l.nominee) : "&mdash;"}</div></div>
                </div>
                ${l.contents ? `<div class="vault-contents"><span class="vault-faint">Contents &middot; </span>${esc(l.contents)}</div>` : ""}
            </div>
        `;
    }).join("");
}


function fillLockerForm(l) {

    const v = l || {};

    setInputValue("lockId", l ? v.locker_id : "");
    setInputValue("lockBranch", v.bank_branch || "");
    setInputValue("lockContact", v.branch_contact || "");
    setInputValue("lockNo", v.locker_no || "");
    setInputValue("lockPerson", v.person_id || (l ? "" : defaultPersonId()));
    setInputValue("lockBank", v.bank_account_id || "");
    setInputValue("lockRent", v.rent_amount);
    setInputValue("lockRenewal", formatDateForInput(v.rent_renewal_date));
    setInputValue("lockNominee", v.nominee || "");
    setInputValue("lockContents", v.contents || "");
    setInputValue("lockNotes", v.notes || "");

    document.getElementById("lockModalTitle").textContent = l ? "Edit locker" : "New locker";
}


function newLocker() {

    fillLockerForm(null);

    lockAtts.reset();

    openModal("lockModal");

    document.getElementById("lockBranch").focus();
}


function editLocker(id) {

    const l = lockerData.find(x => x.locker_id === id);

    if (!l) {
        return;
    }

    fillLockerForm(l);

    lockAtts.load(id);

    openModal("lockModal");

    document.getElementById("lockBranch").focus();
}


function collectLockerPayload() {

    const text = id => getInputValue(id).trim();
    const optional = id => text(id) || null;

    const branch = text("lockBranch");
    const rentRaw = getInputValue("lockRent");

    if (!branch) throw new Error("Bank and branch is required");

    let rent = null;

    if (rentRaw !== "") {

        rent = Number(rentRaw);

        if (!(rent >= 0)) {
            throw new Error("Rent must be zero or more");
        }
    }

    return {
        bank_branch: branch,
        branch_contact: optional("lockContact"),
        bank_account_id: getInputValue("lockBank") || null,
        person_id: getInputValue("lockPerson") || null,
        locker_no: optional("lockNo"),
        rent_amount: rent,
        rent_renewal_date: getInputValue("lockRenewal") || null,
        nominee: optional("lockNominee"),
        contents: optional("lockContents"),
        notes: optional("lockNotes"),
        updated_by: getCurrentUser()
    };
}


function saveLocker() {

    return persistRecord({
        label: "Locker",
        table: "locker",
        idField: "locker_id",
        id: getInputValue("lockId"),
        collect: collectLockerPayload,
        atts: lockAtts,
        idInput: "lockId",
        modalId: "lockModal"
    });
}


// ======================================================
// CONTACTS
// ======================================================

function renderContacts() {

    const feed = document.getElementById("contFeed");

    if (!feed) {
        return;
    }

    setChip("contChipTotal", `Contacts: ${contactData.length}`);

    const search = getInputValue("contSearch").trim().toLowerCase();

    const rows = contactData.filter(c => {

        if (!search) return true;

        return `${c.name} ${c.role || ""} ${c.organisation || ""} ${c.phone || ""} ${c.mobile || ""} ${c.email || ""}`.toLowerCase().includes(search);
    });

    if (rows.length === 0) {
        feed.innerHTML = `<div class="empty-state">${contactData.length === 0 ? "No contacts yet. Add one with + New Contact." : "No contacts found"}</div>`;
        return;
    }

    feed.innerHTML = `<div class="vault-list">${rows.map(c => {

        const id = c.contact_id;

        const managed = bankAccountData
            .filter(b => b.contact_id === id)
            .map(b => [b.bank, b.branch].filter(Boolean).join(" \u00B7 "));

        const who = [c.role, c.organisation].filter(Boolean).map(esc).join(" &middot; ");

        const reach = [c.phone, c.mobile, c.email].filter(Boolean).map(esc).join(" &middot; ");

        const dial = c.mobile || c.phone;

        return `
            <div class="vault-row">
                <span class="vault-icon">&#128100;</span>
                <div class="vault-main">
                    <div class="vault-title">${esc(c.name)}${who ? ` <span class="vault-faint">&middot; ${who}</span>` : ""}</div>
                    <div class="vault-sub">${reach}</div>
                    ${managed.length ? `<div class="vault-sub">Manages ${managed.map(esc).join(", ")}</div>` : ""}
                </div>
                ${clipHtml(attCounts.contact[id] || 0)}
                ${dial ? `<a class="vault-icon-btn" href="tel:${esc(String(dial).replace(/[^+\d]/g, ""))}" title="Call">&#128222;</a>` : ""}
                <button type="button" class="vault-icon-btn" title="Edit" onclick="editContact('${id}')">&#9999;&#65039;</button>
            </div>
        `;
    }).join("")}</div>`;
}


function renderManages(contactId) {

    const box = document.getElementById("contManages");

    if (bankAccountData.length === 0) {
        box.innerHTML = "";
        return;
    }

    box.innerHTML = `
        <div class="vault-manages-title">Relationship manager for</div>
        ${bankAccountData.map(b => `
            <label class="vault-manages-row">
                <input type="checkbox" data-bank="${b.bank_account_id}"${contactId && b.contact_id === contactId ? " checked" : ""}>
                ${esc(bankLabel(b))}
            </label>
        `).join("")}
        <div class="vault-hint">Ticking an account names this person as its manager. It replaces whoever was set before.</div>
    `;
}


function fillContactForm(c) {

    const v = c || {};

    setInputValue("contId", c ? v.contact_id : "");
    setInputValue("contName", v.name || "");
    setInputValue("contRole", v.role || "");
    setInputValue("contOrg", v.organisation || "");
    setInputValue("contPhone", v.phone || "");
    setInputValue("contMobile", v.mobile || "");
    setInputValue("contEmail", v.email || "");
    setInputValue("contNotes", v.notes || "");

    document.getElementById("contModalTitle").textContent = c ? "Edit contact" : "New contact";

    renderManages(c ? v.contact_id : null);
}


function newContact() {

    fillContactForm(null);

    contAtts.reset();

    openModal("contModal");

    document.getElementById("contName").focus();
}


function editContact(id) {

    const c = contactData.find(x => x.contact_id === id);

    if (!c) {
        return;
    }

    fillContactForm(c);

    contAtts.load(id);

    openModal("contModal");

    document.getElementById("contName").focus();
}


function collectContactPayload() {

    const text = id => getInputValue(id).trim();
    const optional = id => text(id) || null;

    const name = text("contName");

    if (!name) throw new Error("Name is required");

    return {
        name: name,
        role: optional("contRole"),
        organisation: optional("contOrg"),
        phone: optional("contPhone"),
        mobile: optional("contMobile"),
        email: optional("contEmail"),
        notes: optional("contNotes"),
        updated_by: getCurrentUser()
    };
}


// After the contact itself is saved: make the bank accounts' manager links
// match the ticks. Only accounts whose link actually changes are touched.
async function syncManagedAccounts(contactId) {

    const ticks = [...document.querySelectorAll("#contManages input[data-bank]")];

    for (const tick of ticks) {

        const bankId = tick.getAttribute("data-bank");
        const account = bankById(bankId);
        const had = !!account && account.contact_id === contactId;

        if (tick.checked === had) {
            continue;
        }

        assertSaved(
            await updateData("bank_account", "bank_account_id", bankId, {
                contact_id: tick.checked ? contactId : null,
                updated_at: new Date().toISOString(),
                updated_by: getCurrentUser()
            }),
            "Unable to update the bank account's manager"
        );
    }
}


function saveContact() {

    return persistRecord({
        label: "Contact",
        table: "contact",
        idField: "contact_id",
        id: getInputValue("contId"),
        collect: collectContactPayload,
        atts: contAtts,
        idInput: "contId",
        modalId: "contModal",
        after: syncManagedAccounts
    });
}


// ======================================================
// ONE SAVE PATH FOR ALL FOUR
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

        if (recordId && cfg.after) {
            await cfg.after(recordId);
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

const VAULT_MODALS = [
    { id: "docModal", save: () => saveDocument(), notes: "docNotes", files: "#docAttachments" },
    { id: "cardModal", save: () => saveCard(), notes: "cardNotes", files: "#cardAttachments" },
    { id: "lockModal", save: () => saveLocker(), notes: "lockNotes", files: "#lockAttachments" },
    { id: "contModal", save: () => saveContact(), notes: "contNotes", files: "#contAttachments" }
];


document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            VAULT_MODALS.forEach(m => closeModal(m.id));
            return;
        }

        if (event.key !== "Enter") {
            return;
        }

        const open = VAULT_MODALS.find(m => {
            const el = document.getElementById(m.id);
            return el && (el.style.display === "flex" || el.style.display === "block");
        });

        if (!open) {
            return;
        }

        const active = document.activeElement;

        const inTextarea = active && active.tagName === "TEXTAREA";
        const inFiles = active && active.closest && (active.closest(open.files) || active.closest(".vault-manages"));
        const onControl = active && ["BUTTON", "SELECT", "A"].includes(active.tagName);

        // Enter saves -- except in a notes box, the attachments section,
        // the manager ticks, or on a button, dropdown or link.
        if (!inTextarea && !inFiles && !onControl) {
            event.preventDefault();
            open.save();
        }
    }
);
