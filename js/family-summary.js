// AC v2.0 PACK

// The Family summary: one document that tells the people you'd leave behind
// where everything is -- who to call, which insurance, which bank accounts and
// deposits, which mutual funds, which documents and lockers.
//
// ONE MODEL, TWO OUTPUTS
//   buildSummaryModel() turns what is in the database into plain rows of text.
//   The on-screen preview and the PDF are BOTH drawn from that same model, so what
//   you read here is exactly what your family gets.
//
// WHAT IS NEVER IN IT
//   * Cards and card details, and every attached scan: never loaded at all.
//   * Identity documents only where you ticked "share with family" in the Vault
//     (the same rule the family login follows), and then only the last digits that
//     the Vault stores.
//
// THE PACK (what the owner downloads or shares)
//   * Family_summary_<date>.pdf : built in this browser with pdfmake and locked with AES-256
//     (version "1.7ext3"; pdfmake's default is the old 40-bit RC4, so that option is not
//     optional). A random owner password, also never stored, stops anyone changing the
//     file's permissions.
//   * Family_documents_<date>.zip : the scans you have ticked "share with family", locked with
//     AES-256 and the SAME passphrase. Only made if there is at least one scan. Never a card's
//     file; an identity document's scan only if that document is ticked too.
//   * READ_ME_FIRST.txt : plain text, instructions only (no names, numbers or file list).
//   The passphrase you type is used once and never stored. The PDF's "Scanned documents" section
//   prints the path of every scan inside the zip (not links: links to other files don't work in
//   phone viewers, and only after extracting).
//
// A SUMMARY THAT LEAVES THINGS OUT WOULD MISLEAD YOUR FAMILY
//   If anything fails to load, the page says so and will not make a PDF at all.
//
// The "last shared" date is kept in family_summary_log (owner only) so this page
// and the Invest dashboard can remind you to refresh it every six months.

const FS_REFRESH_MONTHS = 6;
const FS_SCAN_BUCKET = "records-attachments";

// An identity number is shown by its last few characters only, whatever is stored in the Vault.
// The full number is on the original document, and on the scan if that is in the zip.
const FS_ID_CHARS = 5;

// A caller who quotes real policy details sounds genuine. This goes at the end of the PDF and
// preview, and in the README.
const FS_CLOSING = "A caller who quotes details from this summary is not necessarily genuine. Insurers, banks and IRDAI never ask for fees, OTPs or passwords to release a bonus or a claim. Hang up and call the number printed on the policy document, or on the bank's own website.";

// The pack is built in the browser's memory, so there is a ceiling on the scans' total size.
let FS_MAX_PACK_BYTES = 50 * 1024 * 1024;

// a short pause between the files of one pack, so browsers don't drop the later downloads
const FS_SEND_GAP_MS = 250;

// folders in the zip, in the order a family would look for them
const FS_CATEGORY_ORDER = ["Insurance", "Deposits", "Bank accounts", "Mutual funds", "Identity documents", "Lockers", "Contacts", "People", "Other"];
const FS_MIN_PASSWORD = 10;
const FS_STRONG_PASSWORD = 16;

// "Sept" because that is how this app's own dates read (formatDate uses en-IN)
const FS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

const FS_MODE_WORDS = {
    "Annual": "yearly",
    "Half Yearly": "half-yearly",
    "Quarterly": "quarterly",
    "Monthly": "monthly",
    "Single payment": "single payment"
};

let fsData = {};

// what failed to load, by name
let fsFailed = [];

let fsLastShared = null;

let fsModel = null;

// the scans that will go in the zip (owner only), described and given their paths
let fsScans = null;

let fsBusy = false;


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        const owner = isOwnerUser();

        document.getElementById("fsShareCard").style.display = owner ? "" : "none";
        document.getElementById("fsBtnPrintView").style.display = owner ? "none" : "";
        document.getElementById("fsBtnShare").style.display = owner && canShareFiles() ? "" : "none";

        // A family login can only open this page, so the menu of the others is hidden for them
        // (auth.js sends them straight back here if they try one).
        if (currentRole() === "family") {

            const sidebar = document.getElementById("sidebar");

            if (sidebar) {
                sidebar.style.display = "none";
            }
        }

        await loadAll();
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


function pluralWord(n, one, many) {

    return `${n} ${n === 1 ? one : many}`;
}


// whole rupees, Indian digit grouping
function inr0(value) {

    return "\u20B9" + Math.round(Number(value)).toLocaleString("en-IN");
}


// "05 Mar 2026"
function fmtDate(iso) {

    const { y, m, d } = insParts(String(iso).substring(0, 10));

    return `${String(d).padStart(2, "0")} ${FS_MONTHS[m - 1]} ${y}`;
}


// A timestamp as the calendar date it was in India, since that is the date you
// would call "the day I shared it".
function istDate(timestamp) {

    return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}


function agoText(days) {

    if (days <= 0) {
        return "today";
    }

    if (days < 60) {
        return `${plural(days, "day")} ago`;
    }

    if (days < 730) {
        return `${Math.round(days / 30.4375)} months ago`;
    }

    return `${plural(Math.floor(days / 365.25), "year")} ago`;
}


// "1234 1234 1234" or "N1234567" -> its last 5 characters, spaces ignored
function lastChars(value) {

    return String(value === null || value === undefined ? "" : value).replace(/\s+/g, "").slice(-FS_ID_CHARS);
}


function dash(value) {

    return value === null || value === undefined || String(value).trim() === "" ? "\u2014" : String(value).trim();
}


// Who is signed in, and are they an owner? Both come from the same two places the app's own
// sign-in check (auth.js) uses: the email it keeps in sessionStorage as "pwms_user", and the
// owner list APP_CONFIG.ALLOWED_EMAILS in config.js. (Not a global called ALLOWED_EMAILS:
// there isn't one.)
function currentEmail() {

    let stored = null;

    try {
        stored = sessionStorage.getItem("pwms_user");
    } catch (error) { /* storage blocked: fall back below */ }

    return String(stored || (typeof getCurrentUser === "function" ? getCurrentUser() : "") || "").trim().toLowerCase();
}


function isOwnerUser() {

    const owners = typeof APP_CONFIG !== "undefined" && APP_CONFIG && Array.isArray(APP_CONFIG.ALLOWED_EMAILS)
        ? APP_CONFIG.ALLOWED_EMAILS
        : [];

    const email = currentEmail();

    return email !== "" && owners.map(e => String(e).trim().toLowerCase()).includes(email);
}


// The role auth.js worked out at sign-in: "owner", "family", or nothing
function currentRole() {

    try {
        return sessionStorage.getItem("pwms_role") || "";
    } catch (error) {
        return "";
    }
}


function canShareFiles() {

    return typeof navigator !== "undefined" && typeof navigator.share === "function";
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


// ======================================================
// LOAD
// ======================================================

async function loadAll() {

    // Cards and attachments are deliberately absent: they are never in this document.
    const sources = [
        ["people", "People", "person?select=person_id,full_name,relationship"],
        ["contacts", "Contacts", "contact?select=contact_id,name,role,organisation,phone,mobile,email&order=name.asc"],
        ["policies", "Insurance", "insurance_policy?select=insurance_policy_id,policy_type,policy_name,insurer,policy_no,person_id,status,sum_assured,issue_date,maturity_date,premium_term_years,premium_mode,premium_amount,first_due_date,nominee,tax_section&order=policy_name.asc"],
        ["banks", "Bank accounts", "bank_account?select=bank_account_id,bank,branch,account_type,holder_name,rd_nominee,account_no,ifsc_code&order=bank.asc"],
        ["deposits", "Deposits", "deposit?select=deposit_id,bank_account_id,deposit_type,purpose,account_no,status,maturity_date,maturity_amount,needed_by&order=maturity_date.asc"],
        ["holdings", "Mutual funds", "mf_holding?select=mf_holding_id,person_id,bank_account_id,fund_name,folio_no,nominee,status&order=fund_name.asc"],
        ["values", "Mutual fund values", "mf_valuation?select=mf_holding_id,as_of_date,current_value&order=as_of_date.desc"],
        ["documents", "Identity documents", "identity_document?select=identity_document_id,person_id,doc_type,doc_number,expiry_date,share_with_family&order=doc_type.asc"],
        ["lockers", "Lockers", "locker?select=locker_id,bank_branch,locker_no,rent_amount,rent_renewal_date,nominee,contents&order=bank_branch.asc"]
    ];

    const owner = isOwnerUser();

    // when it was last shared: only the owner has this table
    const logSource = ["log", "Last-shared date", "family_summary_log?select=family_summary_log_id,shared_at,method&order=shared_at.desc"];

    // The scans marked "share with family": only the owner builds the pack. Only ticked, never a
    // card's, are even asked for.
    const scanSource = ["scans", "Scans for family", "attachment?select=attachment_id,person_id,bank_account_id,deposit_id,insurance_policy_id,identity_document_id,card_id,locker_id,contact_id,mf_holding_id,doc_type,label,file_name,storage_path,content_type,file_size,share_with_family&share_with_family=eq.true&card_id=is.null&order=file_name.asc"];

    const all = [...sources, ...(owner ? [scanSource, logSource] : [])];

    const results = await Promise.all(all.map(s => fetchAll(s[2])));

    fsFailed = [];
    fsData = {};

    all.forEach((s, i) => {

        fsData[s[0]] = results[i] || [];

        if (results[i] === null) {
            fsFailed.push({ key: s[0], label: s[1] });
        }
    });

    fsLastShared = null;

    if (owner && !fsFailed.some(f => f.key === "log") && fsData.log.length > 0) {
        fsLastShared = istDate(fsData.log[0].shared_at);
    }

    render();
}


// The refresh button: reloads from the database, not just a re-render.
async function refreshFamily() {

    await loadAll();
}


// ======================================================
// THE SCANS: which files go in the zip, and where
// ======================================================

const FS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// A name that is safe as a file or folder name on Windows, macOS and Linux.
function sanitizeName(raw, max) {

    let s = String(raw === null || raw === undefined ? "" : raw)
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[. ]+|[. ]+$/g, "");

    if (s === "") {
        s = "unnamed";
    }

    if (FS_RESERVED.test(s)) {
        s = `_${s}`;
    }

    if (s.length > max) {

        const { stem, ext } = splitExt(s);

        s = (stem.slice(0, Math.max(1, max - ext.length)).trim().replace(/[. ]+$/g, "") || "unnamed") + ext;
    }

    return s;
}


// "bond.final.pdf" -> { stem: "bond.final", ext: ".pdf" }; an extension is a dot and up to 10 letters or digits
function splitExt(name) {

    const m = String(name).match(/^(.+?)(\.[A-Za-z0-9]{1,10})$/);

    return m ? { stem: m[1], ext: m[2] } : { stem: String(name), ext: "" };
}


function fmtBytes(n) {

    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;

    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}


// The scans marked for family, each with the record it belongs to and its path inside the zip:
// Documents/<category>/<record>/<file>. Same rule as the family login: ticked, never a card's,
// and an identity document's scan only if that document is ticked too.
function buildScanList(data) {

    const tickedDocs = new Set(data.documents.filter(d => d.share_with_family === true).map(d => d.identity_document_id));

    const person = id => { const p = data.people.find(x => x.person_id === id); return p ? p.full_name : ""; };

    const parentOf = a => {

        if (a.insurance_policy_id) { const p = data.policies.find(x => x.insurance_policy_id === a.insurance_policy_id); return ["Insurance", p ? p.policy_name : ""]; }
        if (a.deposit_id) { const d = data.deposits.find(x => x.deposit_id === a.deposit_id); return ["Deposits", d ? d.purpose : ""]; }
        if (a.bank_account_id) { const b = data.banks.find(x => x.bank_account_id === a.bank_account_id); return ["Bank accounts", b ? [b.bank, b.branch].filter(Boolean).join(" ") : ""]; }
        if (a.mf_holding_id) { const h = data.holdings.find(x => x.mf_holding_id === a.mf_holding_id); return ["Mutual funds", h ? h.fund_name : ""]; }
        if (a.identity_document_id) { const d = data.documents.find(x => x.identity_document_id === a.identity_document_id); return ["Identity documents", d ? [person(d.person_id).split(" ")[0], d.doc_type].filter(Boolean).join(" - ") : ""]; }
        if (a.locker_id) { const l = data.lockers.find(x => x.locker_id === a.locker_id); return ["Lockers", l ? [l.bank_branch, l.locker_no].filter(Boolean).join(" ") : ""]; }
        if (a.contact_id) { const c = data.contacts.find(x => x.contact_id === a.contact_id); return ["Contacts", c ? c.name : ""]; }
        if (a.person_id) { return ["People", person(a.person_id)]; }

        return ["Other", ""];
    };

    const items = (data.scans || [])
        .filter(a => a.share_with_family === true && !a.card_id && (!a.identity_document_id || tickedDocs.has(a.identity_document_id)))
        .map(a => {

            const [category, record] = parentOf(a);

            return { a, category, record, fileName: a.file_name };
        })
        .sort((x, y) =>
            FS_CATEGORY_ORDER.indexOf(x.category) - FS_CATEGORY_ORDER.indexOf(y.category)
            || x.record.localeCompare(y.record)
            || x.fileName.localeCompare(y.fileName)
        );

    const taken = new Set();

    return items.map(({ a, category, record, fileName }) => {

        const folder = `Documents/${sanitizeName(category, 40)}/${sanitizeName(record || category, 70)}/`;
        const file = sanitizeName(fileName, 100);

        // two files of one record with the same name must not overwrite each other (Windows ignores case)
        let path = folder + file;
        let n = 1;

        while (taken.has(path.toLowerCase())) {

            n++;

            const { stem, ext } = splitExt(file);

            path = `${folder}${stem} (${n})${ext}`;
        }

        taken.add(path.toLowerCase());

        return {
            attachmentId: a.attachment_id,
            category,
            record,
            fileName,
            docType: a.doc_type || "",
            label: a.label || "",
            size: a.file_size === null || a.file_size === undefined ? null : Number(a.file_size),
            storagePath: a.storage_path,
            path
        };
    });
}


function packNames(today) {

    return {
        pdf: `Family_summary_${today}.pdf`,
        zip: `Family_documents_${today}.zip`,
        readme: "READ_ME_FIRST.txt"
    };
}


// ======================================================
// THE MODEL: plain rows of text, used by the preview AND the PDF
// ======================================================

// options.scans (owner only): the scans that go in the zip; options.zipName: its file name.
// Without options (the family view) there is no scans section at all.
function buildSummaryModel(data, today, options) {

    const personName = id => {
        const p = data.people.find(x => x.person_id === id);
        return p ? p.full_name : "";
    };

    const bankName = id => {
        const b = data.banks.find(x => x.bank_account_id === id);
        return b ? b.bank : "";
    };

    const self = data.people.find(p => p.relationship === "Self");

    // ---- key contacts ----
    const contacts = data.contacts.map(c => [
        dash(c.name),
        dash([c.role, c.organisation].filter(Boolean).join(", ")),
        dash([c.mobile, c.phone].filter(Boolean).join(" / ")),
        dash(c.email)
    ]);

    // ---- insurance: Active policies, whichever premium falls due first ----
    const policies = data.policies
        .filter(p => p.status === "Active")
        .map(p => ({ p, next: insNextDue(p, today) }))
        .sort((a, b) => {
            if (!a.next && !b.next) return a.p.policy_name.localeCompare(b.p.policy_name);
            if (!a.next) return 1;
            if (!b.next) return -1;
            return a.next.date.localeCompare(b.next.date) || a.p.policy_name.localeCompare(b.p.policy_name);
        });

    const insurance = policies.map(({ p, next }) => {

        const mode = FS_MODE_WORDS[p.premium_mode] || p.premium_mode || "";
        const single = insIsSinglePayment(p);

        const when = !next ? "no further premiums"
            : next.overdue ? `renewal date ${fmtDate(next.date)} has passed`
            : single ? `renewal ${fmtDate(next.date)}`
            : `next due ${fmtDate(next.date)}`;

        const amount = p.premium_amount !== null && p.premium_amount !== undefined ? inr0(p.premium_amount) : "\u2014";

        return [
            `${p.policy_name} (${p.policy_type})`,
            [p.insurer, p.policy_no ? `Policy no. ${p.policy_no}` : ""].filter(Boolean).join("\n") || "\u2014",
            dash(personName(p.person_id)),
            p.sum_assured !== null && p.sum_assured !== undefined ? inr0(p.sum_assured) : (p.tax_section ? `Tax section ${p.tax_section}` : "\u2014"),
            `${amount}${mode ? ` ${mode}` : ""}\n${when}`,
            dash(p.nominee)
        ];
    });

    // ---- bank accounts ----
    const banks = data.banks.map(b => [
        dash(b.bank),
        dash([b.branch, b.account_type].filter(Boolean).join(" \u00B7 ")),
        dash(b.holder_name),
        dash(b.account_no),
        dash(b.ifsc_code),
        dash(b.rd_nominee)
    ]);

    // ---- deposits still running ----
    const active = data.deposits
        .filter(d => d.status === "Active")
        .sort((a, b) => String(a.maturity_date).localeCompare(String(b.maturity_date)));

    const deposits = active.map(d => [
        dash(d.purpose),
        dash(bankName(d.bank_account_id)),
        dash(d.account_no),
        d.maturity_date ? fmtDate(d.maturity_date) : "\u2014",
        d.maturity_amount !== null && d.maturity_amount !== undefined ? inr0(d.maturity_amount) : "\u2014",
        d.needed_by ? fmtDate(d.needed_by) : "\u2014"
    ]);

    // ---- mutual funds you still hold: biggest first ----
    const newest = {};

    data.values
        .slice()
        .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date)))
        .forEach(v => { if (!newest[v.mf_holding_id]) newest[v.mf_holding_id] = v; });

    const held = data.holdings
        .filter(h => h.status !== "Redeemed")
        .map(h => ({ h, v: newest[h.mf_holding_id] || null }))
        .sort((a, b) => {
            if (!a.v && !b.v) return a.h.fund_name.localeCompare(b.h.fund_name);
            if (!a.v) return 1;
            if (!b.v) return -1;
            return Number(b.v.current_value) - Number(a.v.current_value);
        });

    const funds = held.map(({ h, v }) => [
        `${h.fund_name}${h.status === "Locked" ? " (locked)" : ""}`,
        dash(h.folio_no),
        dash(personName(h.person_id)),
        h.bank_account_id ? dash(bankName(h.bank_account_id)) : "Direct",
        dash(h.nominee),
        v ? `${inr0(v.current_value)}\nas of ${fmtDate(v.as_of_date)}` : "no value recorded"
    ]);

    const valued = held.filter(x => x.v);
    const fundsNote = valued.length > 0
        ? `Total of the values shown: ${inr0(valued.reduce((s, x) => s + Number(x.v.current_value), 0))}, each as of its own date. These are not today's values.`
        : "";

    // ---- identity documents: only those ticked for family ----
    const documents = data.documents
        .filter(d => d.share_with_family === true)
        .map(d => [
            dash(d.doc_type),
            dash(personName(d.person_id)),
            lastChars(d.doc_number) ? `ends ${lastChars(d.doc_number)}` : "\u2014",
            d.expiry_date ? fmtDate(d.expiry_date) : "no expiry"
        ]);

    // ---- lockers ----
    const lockers = data.lockers.map(l => [
        dash([l.bank_branch].filter(Boolean).join(" ")),
        dash(l.locker_no),
        l.rent_amount !== null && l.rent_amount !== undefined ? inr0(l.rent_amount) : "\u2014",
        l.rent_renewal_date ? fmtDate(l.rent_renewal_date) : "\u2014",
        dash(l.nominee),
        dash(l.contents)
    ]);

    const sections = [
        { id: "contacts", title: "Key contacts", columns: ["Name", "Role", "Phone", "Email"], widths: ["*", "*", "auto", "*"], rows: contacts, empty: "No contacts recorded." },
        { id: "insurance", title: `Insurance (${pluralWord(insurance.length, "policy", "policies")})`, columns: ["Policy", "Insurer and policy no.", "Insured", "Cover", "Premium", "Nominee"], widths: [118, 132, 74, 62, 118, "*"], rows: insurance, empty: "No active policies." },
        { id: "banks", title: `Bank accounts (${data.banks.length})`, columns: ["Bank", "Branch \u00B7 type", "Holder", "Account number", "IFSC", "RD nominee"], widths: ["auto", "*", "*", "auto", "auto", "*"], rows: banks, empty: "No bank accounts recorded." },
        { id: "deposits", title: `Deposits (${plural(deposits.length, "active deposit")})`, columns: ["Purpose", "Bank", "Account number", "Matures", "Amount at maturity", "Needed by"], widths: ["*", "auto", "auto", "auto", "auto", "auto"], rows: deposits, empty: "No active deposits.", note: deposits.length ? "Amounts are what each deposit pays when it matures, not today's balance." : "" },
        { id: "funds", title: `Mutual funds (${held.length} held)`, columns: ["Fund", "Folio", "Holder", "Held through", "Nominee", "Value"], widths: ["*", "auto", 110, "auto", "*", 84], rows: funds, empty: "No mutual funds held.", note: fundsNote },
        { id: "documents", title: "Identity documents", columns: ["Document", "Holder", "Number", "Valid until"], widths: ["*", "*", "auto", "auto"], rows: documents, empty: "No documents have been marked for family.", note: "Only documents marked for family are listed, with the last digits only." },
        { id: "lockers", title: `Lockers (${data.lockers.length})`, columns: ["Bank \u00B7 branch", "Locker no.", "Annual rent", "Renews", "Nominee", "Contents"], widths: ["*", "auto", "auto", "auto", "*", "*"], rows: lockers, empty: "No lockers recorded." }
    ];

    const scans = options && options.scans ? options.scans : null;

    if (scans) {

        sections.push({
            id: "scans",
            title: `Scanned documents (${pluralWord(scans.length, "file", "files")})`,
            columns: ["Record", "File", "Type", "Path in the zip"],
            widths: ["*", "*", "auto", "*"],
            rows: scans.map(s => [
                `${s.category}${s.record ? ` \u00B7 ${s.record}` : ""}`,
                s.fileName,
                dash([s.docType, s.label].filter(Boolean).join(" \u00B7 ")),
                s.path
            ]),
            empty: "No scans have been marked for family.",
            note: scans.length
                ? `These files are in ${options.zipName}, locked with the same password as this PDF. It needs a program that opens AES-256 zip files, such as 7-Zip. Extract it and follow the path shown against each entry.`
                : ""
        });
    }

    return {
        title: "Family summary",
        owner: self ? self.full_name : "",
        validAsOf: today,
        guide: "Below are details of my investments, insurance, bank accounts and other important financial information, collected in one place in case they are useful later. Insurance policies and deposits are listed in the order they next fall due. This reflects what was recorded on the date shown and may not be everything, so please confirm details with the institution concerned.",
        closing: FS_CLOSING,
        footer: `Information as on ${fmtDate(today)}.`,
        sections,
        counts: {
            contacts: contacts.length,
            policies: insurance.length,
            banks: banks.length,
            deposits: deposits.length,
            funds: funds.length,
            documents: documents.length,
            lockers: lockers.length,
            scans: scans ? scans.length : 0
        }
    };
}


// "1 contact, 7 policies, 2 bank accounts, ..." : counts only, never names or numbers
function countsSummary(counts) {

    return [
        pluralWord(counts.contacts, "contact", "contacts"),
        pluralWord(counts.policies, "policy", "policies"),
        pluralWord(counts.banks, "bank account", "bank accounts"),
        pluralWord(counts.deposits, "deposit", "deposits"),
        pluralWord(counts.funds, "fund", "funds"),
        pluralWord(counts.documents, "document", "documents"),
        pluralWord(counts.lockers, "locker", "lockers"),
        pluralWord(counts.scans, "scan", "scans")
    ].join(", ");
}


// ======================================================
// THE PAGE
// ======================================================

function render() {

    const today = getToday();
    const owner = isOwnerUser();

    const note = document.getElementById("fsLoadNote");
    const blocking = fsFailed.filter(f => f.key !== "log");

    if (fsFailed.length > 0) {

        showError(`Unable to load: ${fsFailed.map(f => f.label).join(", ")}`);

        note.style.display = "";
        note.textContent = blocking.length > 0
            ? `Couldn't load ${blocking.map(f => f.label).join(", ")}. A summary with things missing would mislead your family, so none can be made until this loads.`
            : "Couldn't read when you last shared this. You can still make the PDF.";

    } else {

        note.style.display = "none";
        note.textContent = "";
    }

    renderBanner(today, owner);

    if (blocking.length > 0) {

        fsModel = null;

        document.getElementById("fsPreview").innerHTML = `<div class="empty-state">The summary can't be shown until everything loads.</div>`;
        document.getElementById("fsPreviewTag").textContent = "";

    } else {

        // only the owner builds the pack, so only the owner sees (and can make) the scans section
        fsScans = owner ? buildScanList(fsData) : null;

        fsModel = buildSummaryModel(fsData, today, fsScans ? { scans: fsScans, zipName: packNames(today).zip } : undefined);

        document.getElementById("fsPreview").innerHTML = previewHtml(fsModel);
        document.getElementById("fsPreviewTag").textContent = `Preview, as of ${fmtDate(today)}`;
    }

    renderScanInfo(owner);

    onPasswordInput();
}


// One line above the buttons: what will go in the zip, so there are no surprises.
function renderScanInfo(owner) {

    const el = document.getElementById("fsScanInfo");

    if (!el) {
        return;
    }

    if (!owner || !fsModel || !fsScans) {
        el.textContent = "";
        return;
    }

    if (fsScans.length === 0) {

        el.textContent = `No scans are marked "share with family", so the pack will be the PDF only. To include scans, tick "share with family" on them in the Attachments section of each record.`;

        return;
    }

    const known = fsScans.filter(s => s.size !== null);
    const bytes = known.reduce((sum, s) => sum + s.size, 0);
    const size = known.length === fsScans.length ? `about ${fmtBytes(bytes)}` : known.length ? `at least ${fmtBytes(bytes)}` : "size not recorded";

    el.textContent = `${pluralWord(fsScans.length, "scan", "scans")} (${size}) marked "share with family" will go in the zip. Cards are never included.`;
}


function renderBanner(today, owner) {

    const el = document.getElementById("fsBanner");

    if (!owner || fsFailed.some(f => f.key === "log")) {
        el.style.display = "none";
        el.textContent = "";
        return;
    }

    el.style.display = "";

    if (!fsLastShared) {

        el.className = "fs-banner fs-banner-warn fs-noprint";
        el.innerHTML = `<b>Never shared.</b> Make the PDF below and share it with your family, then refresh it every six months, or whenever anything big changes.`;

        return;
    }

    const due = insAddMonths(fsLastShared, FS_REFRESH_MONTHS);
    const ago = agoText(insDaysBetween(fsLastShared, today));

    if (due <= today) {

        el.className = "fs-banner fs-banner-warn fs-noprint";
        el.innerHTML = `<b>Due for a refresh.</b> Last shared ${esc(fmtDate(fsLastShared))} (${esc(ago)}); it was due ${esc(fmtDate(due))}.`;

    } else {

        el.className = "fs-banner fs-banner-ok fs-noprint";
        el.innerHTML = `Last shared ${esc(fmtDate(fsLastShared))} (${esc(ago)}). Next refresh due ${esc(fmtDate(due))}.`;
    }
}


function previewHtml(model) {

    const tables = model.sections.map(s => `
        <div class="fs-section">
            <div class="fs-section-title">${esc(s.title)}</div>
            ${s.rows.length === 0
                ? `<div class="fs-empty">${esc(s.empty)}</div>`
                : `<div class="fs-table-wrap"><table class="fs-table">
                        <thead><tr>${s.columns.map((c, i) => `<th${typeof s.widths[i] === "number" ? ` style="min-width:${Math.round(s.widths[i] * 1.25)}px"` : ""}>${esc(c)}</th>`).join("")}</tr></thead>
                        <tbody>${s.rows.map(r => `<tr>${r.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
                    </table></div>`}
            ${s.note ? `<div class="fs-note">${esc(s.note)}</div>` : ""}
        </div>
    `).join("");

    return `
        <div class="fs-doc">
            <div class="fs-doc-title">${esc(model.title)}${model.owner ? ` &middot; ${esc(model.owner)}` : ""}</div>
            <div class="fs-doc-sub">Information as on ${esc(fmtDate(model.validAsOf))}.</div>
            <div class="fs-guide">${esc(model.guide)}</div>
            ${tables}
            <div class="fs-guide">${esc(model.closing)}</div>
        </div>
    `;
}


// ======================================================
// THE PASSPHRASE
// ======================================================

function onPasswordInput() {

    const input = document.getElementById("fsPassword");
    const bar = document.getElementById("fsMeterBar");
    const text = document.getElementById("fsStrength");

    if (!input || !bar || !text) {
        return;
    }

    const n = input.value.length;

    bar.style.width = `${Math.min(100, n * 7)}%`;
    bar.className = n < FS_MIN_PASSWORD ? "fs-meter-bad" : n < FS_STRONG_PASSWORD ? "fs-meter-warn" : "fs-meter-ok";

    text.textContent = n < FS_MIN_PASSWORD ? `${FS_MIN_PASSWORD - n} more character${FS_MIN_PASSWORD - n === 1 ? "" : "s"} needed`
        : n < FS_STRONG_PASSWORD ? "Good. A longer phrase is stronger."
        : "Strong.";

    const plain = isPlainPassphrase(input.value);
    const note = document.getElementById("fsPassNote");

    if (note) {
        note.style.display = plain ? "none" : "";
        note.textContent = plain ? "" : "Use only plain English letters, digits, spaces and common symbols: some unzip programs mishandle anything else, and your family might not be able to open the zip.";
    }

    // Nothing can be made until there is a summary to make and a passphrase long
    // enough to be worth locking it with.
    const ready = !!fsModel && n >= FS_MIN_PASSWORD && plain && !fsBusy;

    document.getElementById("fsBtnDownload").disabled = !ready;
    document.getElementById("fsBtnShare").disabled = !ready;
}


// Printable ASCII only (letters, digits, space and the usual symbols).
function isPlainPassphrase(value) {

    return /^[\x20-\x7E]*$/.test(value);
}


// ======================================================
// THE PDF
// ======================================================

// 24 random letters and digits, used once as the owner password and then forgotten.
function randomOwnerPassword() {

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(24);

    window.crypto.getRandomValues(bytes);

    return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}


function buildPdfDefinition(model, password, ownerPassword) {

    const content = [
        { text: model.title, style: "title" },
        { text: `${model.owner ? `Prepared by ${model.owner} \u00B7 ` : ""}information as on ${fmtDate(model.validAsOf)}`, style: "sub" },
        { text: model.guide, style: "guide" }
    ];

    model.sections.forEach(s => {

        content.push({ text: s.title, style: "sectionTitle", keepWithNext: true });

        if (s.rows.length === 0) {

            content.push({ text: s.empty, style: "empty" });

        } else {

            content.push({
                table: {
                    headerRows: 1,
                    dontBreakRows: true,
                    widths: s.widths,
                    body: [
                        s.columns.map(c => ({ text: c, style: "th" })),
                        ...s.rows.map(r => r.map(cell => ({ text: cell, style: "td" })))
                    ]
                },
                layout: "lightHorizontalLines"
            });
        }

        if (s.note) {
            content.push({ text: s.note, style: "note" });
        }
    });

    content.push({ text: model.closing, style: "closing" });

    return {
        content,

        info: {
            title: model.title,
            author: model.owner,
            subject: "Where everything is: contacts, insurance, bank accounts, deposits, mutual funds, documents and lockers"
        },

        // Encryption. "version" is what selects AES-256: left out, pdfmake falls back to
        // 40-bit RC4, which is weak. Printing and copying stay allowed so the family can
        // print it and copy numbers out; changing the file does not.
        userPassword: password,
        ownerPassword: ownerPassword,
        version: "1.7ext3",
        permissions: {
            printing: "highResolution",
            modifying: false,
            copying: true,
            annotating: false,
            fillingForms: false,
            contentAccessibility: true,
            documentAssembly: false
        },

        pageSize: "A4",
        pageOrientation: "landscape",
        pageMargins: [36, 40, 36, 44],

        defaultStyle: { fontSize: 9 },

        styles: {
            title: { fontSize: 18, bold: true },
            sub: { fontSize: 10, color: "#555555", margin: [0, 2, 0, 8] },
            guide: { fontSize: 9, color: "#333333", margin: [0, 0, 0, 4], italics: true },
            sectionTitle: { fontSize: 11, bold: true, margin: [0, 14, 0, 4] },
            th: { bold: true, color: "#555555", fontSize: 8 },
            td: { fontSize: 8.5 },
            note: { fontSize: 8, color: "#666666", italics: true, margin: [0, 3, 0, 0] },
            closing: { fontSize: 9, color: "#333333", italics: true, margin: [0, 16, 0, 0] },
            empty: { fontSize: 9, color: "#666666", italics: true }
        },

        footer: (current, total) => ({
            text: `${model.footer}   Page ${current} of ${total}`,
            alignment: "center",
            fontSize: 8,
            color: "#777777"
        })
    };
}


async function makePdfBlob(model, password) {

    if (typeof pdfMake === "undefined" || !pdfMake.createPdf) {
        throw new Error("The PDF library didn't load. Check your connection and reload the page.");
    }

    return await pdfMake.createPdf(buildPdfDefinition(model, password, randomOwnerPassword())).getBlob();
}


// an error message as a finished sentence (some end in a full stop, some don't)
function sentence(message) {

    const text = String(message === null || message === undefined ? "" : message).trim();

    return /[.!?]$/.test(text) ? text : `${text}.`;
}


function sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));
}


// One scan's bytes from private storage. Anything that can't be fetched stops the whole pack:
// a pack with a scan quietly missing would mislead the family.
async function downloadScan(scan) {

    const { data, error } = await supabaseClient.storage.from(FS_SCAN_BUCKET).download(scan.storagePath);

    if (error || !data) {
        throw new Error(`Could not download "${scan.fileName}" (${scan.category}${scan.record ? ` \u00B7 ${scan.record}` : ""}).`);
    }

    return new Uint8Array(await data.arrayBuffer());
}


// The zip of scans: AES-256 (strength 3), the same passphrase as the PDF. Built in memory.
async function makeZipBlob(scans, password) {

    if (typeof zip === "undefined" || !zip.ZipWriter) {
        throw new Error("The zip library didn't load. Check your connection and reload the page.");
    }

    const recorded = scans.reduce((sum, s) => sum + (s.size || 0), 0);

    if (recorded > FS_MAX_PACK_BYTES) {
        throw new Error(`The scans marked for family total about ${fmtBytes(recorded)}, more than the ${fmtBytes(FS_MAX_PACK_BYTES)} this page can pack. Untick some, or ask for the limit to be raised.`);
    }

    zip.configure({ useWebWorkers: false });

    const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter(), { password, encryptionStrength: 3, level: 6 });

    let total = 0;

    for (const scan of scans) {

        const bytes = await downloadScan(scan);

        total += bytes.length;

        if (total > FS_MAX_PACK_BYTES) {
            throw new Error(`The scans are larger than the ${fmtBytes(FS_MAX_PACK_BYTES)} this page can pack. Untick some, or ask for the limit to be raised.`);
        }

        await writer.add(scan.path, new zip.Uint8ArrayReader(bytes));
    }

    return new Blob([await writer.close()], { type: "application/zip" });
}


// Plain instructions, readable with no software and no password. It carries no names, numbers or
// file list, so it is harmless on its own.
function buildReadme(names, today) {

    return [
        "FAMILY SUMMARY: HOW TO OPEN THESE FILES",
        `Prepared ${fmtDate(today)}`,
        "",
        "These files were made together. Both are protected with the same password.",
        "",
        `1. ${names.pdf}`,
        "   The summary: contacts, insurance, bank accounts, deposits, mutual funds, documents and lockers.",
        "   Open it with any PDF viewer (Adobe Reader, Chrome, Edge, Safari, a phone). It asks for the password.",
        "",
        `2. ${names.zip}`,
        "   Copies of scanned documents. The summary has a section called \"Scanned documents\" that lists every",
        "   scan with its path inside this zip.",
        "   It needs a program that can open AES-256 encrypted zip files. The zip tool built into Windows or a",
        "   Mac may not be able to. Use 7-Zip (free, from 7-zip.org) or a similar program, such as Keka on a Mac.",
        "   Extract all the files, then follow the path shown in the summary. It asks for the same password.",
        "",
        "THE PASSWORD",
        "It is not written in these files and was not sent with them. It was given to you in person.",
        "",
        "BEWARE OF PHONE CALLS",
        "A caller who quotes details from these files is not necessarily genuine. Insurers, banks and IRDAI never",
        "ask for fees, OTPs or passwords to release a bonus or a claim. Hang up and call the number printed on",
        "the policy document, or on the bank's own website.",
        "",
        `Keep these files somewhere safe. They show what was recorded on ${fmtDate(today)}; please confirm`,
        "details with the bank, insurer or fund house concerned."
    ].join("\r\n") + "\r\n";
}


// The files that make up one pack: the locked PDF; and, if any scans are marked for family, the
// locked zip and the README. If a scan can't be fetched nothing at all is made.
async function makePack(password) {

    const names = packNames(getToday());
    const scans = fsScans || [];

    // the zip first: if a scan can't be fetched, nothing else is made either
    const zipBlob = scans.length > 0 ? await makeZipBlob(scans, password) : null;

    const files = [{ name: names.pdf, type: "application/pdf", blob: await makePdfBlob(fsModel, password) }];

    if (zipBlob) {

        files.push({ name: names.zip, type: "application/zip", blob: zipBlob });
        files.push({ name: names.readme, type: "text/plain", blob: new Blob([buildReadme(names, getToday())], { type: "text/plain" }) });
    }

    return files;
}


function listNames(files) {

    return files.length === 1
        ? files[0].name
        : `${files.slice(0, -1).map(f => f.name).join(", ")} and ${files[files.length - 1].name}`;
}


function saveBlob(fileName, blob) {

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);
}


function checkReady() {

    const password = document.getElementById("fsPassword").value;

    if (!fsModel) {
        showError("The summary can't be made until everything loads");
        return null;
    }

    if (password.length < FS_MIN_PASSWORD) {
        showError(`The passphrase needs at least ${FS_MIN_PASSWORD} characters`);
        return null;
    }

    if (!isPlainPassphrase(password)) {
        showError("Use only plain letters, digits, spaces and common symbols in the passphrase");
        return null;
    }

    return password;
}


function setStatus(text) {

    document.getElementById("fsStatus").textContent = text;
}


// Records that the summary was shared, so the reminder can count from today. The PDF
// is already made by now: if this fails the user is told, but nothing is undone.
async function recordShared(method) {

    try {

        const result = await insertData("family_summary_log", {
            shared_by: getCurrentUser(),
            method,
            summary: countsSummary(fsModel.counts),
            created_by: getCurrentUser()
        });

        if (!Array.isArray(result)) {
            throw new Error(result && result.message ? result.message : "not saved");
        }

        await loadAll();

        return true;

    } catch (error) {

        console.error(error);

        showError("The PDF was made, but the 'last shared' date could not be saved");

        return false;
    }
}


async function downloadPack() {

    const password = checkReady();

    if (password === null || fsBusy) {
        return;
    }

    fsBusy = true;
    onPasswordInput();

    const withScans = !!fsScans && fsScans.length > 0;

    try {

        setStatus(withScans ? "Making the PDF and the zip..." : "Making the PDF...");

        const files = await makePack(password);

        for (let i = 0; i < files.length; i++) {

            if (i > 0) {
                await sleep(FS_SEND_GAP_MS);
            }

            saveBlob(files[i].name, files[i].blob);
        }

        document.getElementById("fsPassword").value = "";

        const saved = await recordShared("download");

        setStatus(`\u2705 ${listNames(files)} downloaded. Tell your family the password in person.${saved ? "" : " (The 'last shared' date was not saved.)"}`);

        showSuccess(files.length === 1 ? "PDF downloaded" : "Pack downloaded");

    } catch (error) {

        console.error(error);

        setStatus(`\u274C The ${withScans ? "pack" : "PDF"} could not be made \u2014 ${error.message || error}`);

        showError(`The ${withScans ? "pack" : "PDF"} could not be made`);

    } finally {

        fsBusy = false;
        onPasswordInput();
    }
}


async function sharePack() {

    const password = checkReady();

    if (password === null || fsBusy) {
        return;
    }

    fsBusy = true;
    onPasswordInput();

    const withScans = !!fsScans && fsScans.length > 0;

    try {

        setStatus(withScans ? "Making the PDF and the zip..." : "Making the PDF...");

        const made = await makePack(password);

        const files = made.map(f => new File([f.blob], f.name, { type: f.type }));

        if (typeof navigator.canShare === "function" && !navigator.canShare({ files })) {

            setStatus(`\u274C This device can't share ${files.length === 1 ? "a PDF" : "these files"} from here. Use Download instead.`);

            showError("This device can't share files from the browser");

            return;
        }

        await navigator.share({ files, title: "Family summary" });

        document.getElementById("fsPassword").value = "";

        const saved = await recordShared("share");

        setStatus(`\u2705 Shared. Tell your family the password in person, not in the same message.${saved ? "" : " (The 'last shared' date was not saved.)"}`);

        showSuccess(files.length === 1 ? "PDF shared" : "Pack shared");

    } catch (error) {

        // closing the share sheet is not an error, and nothing was shared
        if (error && error.name === "AbortError") {

            setStatus("Sharing cancelled. Nothing was recorded.");

        } else {

            console.error(error);

            setStatus(`\u274C The ${withScans ? "pack" : "PDF"} could not be shared \u2014 ${sentence(error.message || error)} Try Download instead.`);

            showError(`The ${withScans ? "pack" : "PDF"} could not be shared`);
        }

    } finally {

        fsBusy = false;
        onPasswordInput();
    }
}


// The page itself, on paper: an UNLOCKED copy. The print stylesheet hides everything
// but the document.
function printSummary() {

    if (!fsModel) {
        showError("The summary can't be printed until everything loads");
        return;
    }

    window.print();
}
