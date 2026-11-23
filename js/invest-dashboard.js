// AC v2.0 FAMILY

// The Invest dashboard: one page that links to Deposits, Insurance, Mutual
// funds and the Vault, and lists every date from them in one "Upcoming" feed.
// It is separate from the main dashboard and shows nothing on it.
//
// WHERE EACH DATE COMES FROM (nothing here is entered separately)
//   * Deposits   : the maturity date of each Active deposit.
//   * Insurance  : each premium (or renewal) due date, from the same schedule
//                  maths the Insurance page uses (insurance-schedule.js), with
//                  the same RD-funding verdict for the next one.
//   * Vault      : identity document expiry, card expiry, locker rent renewal.
//   * Family summary: it is due for a refresh six months after it was last shared
//                  (the last-shared date comes from the Family summary page). Owner
//                  only: the family login can't see that log, so it isn't shown to them.
//   * Mutual funds have no dates; they appear only in their tile.
//
// "OVERDUE" is everything whose date has already passed and still needs you:
// an Active deposit past its maturity (matured, not closed), a single-payment
// policy whose renewal date has passed, and expired documents and cards.
//
// If a module can't be loaded the page says so, in the banner and on its tile.
// A dashboard that silently left out a module's dates would be worse than none.
//
// No identity numbers or card digits are loaded here: only what the dates need.

const INV_SOON_DAYS = 90;   // amber, the same threshold the Vault uses
const INV_STALE_DAYS = 30;  // mutual fund values older than this are flagged

// "Sept" because that is how this app's own dates read (formatDate uses en-IN)
const INV_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const INV_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const INV_WINDOW_LABELS = { "30": "30 days", "90": "90 days", "6m": "6 months" };

// the Family summary is refreshed every six months
const INV_FAMILY_REFRESH_MONTHS = 6;

let invData = { deposits: [], policies: [], people: [], docs: [], cards: [], lockers: [], holdings: [], values: [], family: [] };

// names of the things that failed to load
let invFailed = [];

let invOverdueOpen = false;


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

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


// whole rupees, Indian digit grouping
function inr0(value) {

    return "\u20B9" + Math.round(Number(value)).toLocaleString("en-IN");
}


function signedPct(value) {

    return `${value < 0 ? "\u2212" : "+"}${Math.abs(value).toFixed(1)}%`;
}


// "2 years ago", for dates in the past
function agoText(days) {

    if (days < 60) {
        return `${plural(days, "day")} ago`;
    }

    if (days < 730) {
        return `${Math.round(days / 30.4375)} months ago`;
    }

    return `${plural(Math.floor(days / 365.25), "year")} ago`;
}


// "3 years old", for how stale a set of values is
function ageText(days) {

    if (days < 60) {
        return `${plural(days, "day")} old`;
    }

    if (days < 730) {
        return `${Math.round(days / 30.4375)} months old`;
    }

    return `${plural(Math.floor(days / 365.25), "year")} old`;
}


// "in 30 days"
function inDays(days) {

    if (days === 0) {
        return "today";
    }

    return `in ${plural(days, "day")}`;
}


// "1 Jan", "29 Sept"
function shortDay(iso) {

    const { m, d } = insParts(iso);

    return `${d} ${INV_MONTHS[m - 1]}`;
}


// "1 Jan 2027"
function fullDay(iso) {

    const { y, m, d } = insParts(iso);

    return `${d} ${INV_MONTHS[m - 1]} ${y}`;
}


// A timestamp as the calendar date it was in India: the day you would call "the day I shared it".
function istDate(timestamp) {

    return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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


// The day the Family summary was last downloaded or shared, or null if never.
function lastFamilyShare() {

    if (invData.family.length === 0) {
        return null;
    }

    return istDate(invData.family.map(r => r.shared_at).sort().pop());
}


function addDays(iso, n) {

    const { y, m, d } = insParts(iso);

    const t = new Date(Date.UTC(y, m - 1, d + n));

    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}


// the last day shown for the chosen window
function windowEnd(today) {

    const choice = document.getElementById("invWindow").value;

    return choice === "6m" ? insAddMonths(today, 6) : addDays(today, Number(choice));
}


function windowLabel() {

    return INV_WINDOW_LABELS[document.getElementById("invWindow").value] || "90 days";
}


function firstName(personId) {

    const p = invData.people.find(x => x.person_id === personId);

    return p ? p.full_name.split(" ")[0] : "";
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

    const sources = [
        ["deposits", "Deposits", "deposit?select=deposit_id,purpose,deposit_type,status,maturity_date,maturity_amount,needed_by,insurance_policy_id&order=maturity_date.asc"],
        ["policies", "Insurance", "insurance_policy?select=insurance_policy_id,policy_name,policy_type,status,premium_amount,premium_mode,first_due_date,issue_date,maturity_date,premium_term_years&order=policy_name.asc"],
        ["people", "People's names", "person?select=person_id,full_name,relationship"],
        ["docs", "Identity documents", "identity_document?select=identity_document_id,person_id,doc_type,expiry_date&order=doc_type.asc"],
        ["cards", "Cards", "card?select=card_id,person_id,card_type,card_name,valid_till"],
        ["lockers", "Lockers", "locker?select=locker_id,bank_branch,locker_no,rent_amount,rent_renewal_date"],
        ["holdings", "Mutual funds", "mf_holding?select=mf_holding_id,status"],
        ["values", "Mutual fund values", "mf_valuation?select=mf_holding_id,as_of_date,invested_value,current_value&order=as_of_date.desc"]
    ];

    // the family-summary log belongs to the owner: the family login can't read it
    if (isOwnerUser()) {
        sources.push(["family", "Family summary", "family_summary_log?select=family_summary_log_id,shared_at,method&order=shared_at.desc"]);
    }

    const results = await Promise.all(sources.map(s => fetchAll(s[2])));

    invFailed = [];
    invData.family = [];

    sources.forEach((s, i) => {

        invData[s[0]] = results[i] || [];

        if (results[i] === null) {
            invFailed.push(s[0]);
        }
    });

    const labels = [...new Set(
        sources.filter(s => invFailed.includes(s[0])).map(s => (s[0] === "holdings" || s[0] === "values" ? "Mutual funds" : s[1]))
    )];

    if (labels.length > 0) {
        showError(`Unable to load: ${labels.join(", ")}`);
    }

    const note = document.getElementById("invLoadNote");

    note.style.display = labels.length > 0 ? "" : "none";
    note.textContent = labels.length > 0
        ? `Couldn't load ${labels.join(", ")}. Anything from there is missing below, so don't rely on this page until it loads.`
        : "";

    renderTiles();

    renderUpcoming();
}


// The refresh button: reloads from the database, not just a re-render.
async function refreshInvest() {

    await loadAll();
}


// ======================================================
// TILES
// ======================================================

function tileHtml(icon, name, main, sub) {

    return `
        <div class="inv-tile-head"><span>${icon} ${esc(name)}</span><span>&rarr;</span></div>
        <div class="inv-tile-main">${main}</div>
        <div class="inv-tile-sub">${sub}</div>
    `;
}


function failedTile(icon, name) {

    return tileHtml(icon, name, "&mdash;", `<span class="inv-bad">Couldn't load</span>`);
}


function depositsTile(today) {

    if (invFailed.includes("deposits")) {
        return failedTile("&#127974;", "Deposits");
    }

    const active = invData.deposits.filter(d => d.status === "Active");

    const upcoming = active
        .filter(d => d.maturity_date && d.maturity_date >= today)
        .sort((a, b) => a.maturity_date.localeCompare(b.maturity_date))[0];

    const matured = active.filter(d => d.maturity_date && d.maturity_date < today).length;

    const parts = [];

    if (active.length === 0) {
        parts.push("No active deposits");
    } else if (upcoming) {
        parts.push(`Next matures ${esc(shortDay(upcoming.maturity_date))}`);
    }

    if (matured > 0) {
        parts.push(`<span class="inv-bad">${matured} matured, not closed</span>`);
    }

    return tileHtml("&#127974;", "Deposits", `${active.length} active`, parts.join(" &middot; "));
}


function insuranceTile(today) {

    if (invFailed.includes("policies")) {
        return failedTile("&#128737;&#65039;", "Insurance");
    }

    const active = invData.policies.filter(p => p.status === "Active");

    let next = null;
    let passed = 0;

    active.forEach(p => {

        const n = insNextDue(p, today);

        if (!n) {
            return;
        }

        if (n.overdue) {
            passed++;
            return;
        }

        if (next === null || n.date < next.date) {
            next = { date: n.date, policy: p };
        }
    });

    const parts = [];

    if (next) {

        const amount = next.policy.premium_amount;

        parts.push(`Next premium ${esc(shortDay(next.date))}${amount !== null && amount !== undefined ? `, ${inr0(amount)}` : ""}`);

    } else if (passed === 0) {

        parts.push("No premiums due");
    }

    if (passed > 0) {
        parts.push(`<span class="inv-bad">${plural(passed, "renewal date")} passed</span>`);
    }

    return tileHtml("&#128737;&#65039;", "Insurance", `${active.length} ${active.length === 1 ? "policy" : "policies"}`, parts.join(" &middot; "));
}


// The same totals the Mutual funds page shows: funds you still hold that have
// both a value and an invested figure (the most recent one recorded).
function fundTotals() {

    const held = invData.holdings.filter(h => h.status !== "Redeemed");

    const byHolding = {};

    invData.values.forEach(v => {
        (byHolding[v.mf_holding_id] = byHolding[v.mf_holding_id] || []).push(v);
    });

    let invested = 0;
    let current = 0;
    let counted = 0;
    let latest = null;
    let withValue = 0;

    held.forEach(h => {

        const list = (byHolding[h.mf_holding_id] || [])
            .slice()
            .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date)));

        if (list.length === 0) {
            return;
        }

        withValue++;

        if (latest === null || list[0].as_of_date > latest) {
            latest = list[0].as_of_date;
        }

        const inv = list.find(v => v.invested_value !== null && v.invested_value !== undefined);

        if (inv) {
            invested += Number(inv.invested_value);
            current += Number(list[0].current_value);
            counted++;
        }
    });

    return { held: held.length, withValue, counted, invested, current, latest };
}


function fundsTile(today) {

    if (invFailed.includes("holdings") || invFailed.includes("values")) {
        return failedTile("&#128200;", "Mutual funds");
    }

    const t = fundTotals();

    if (t.held === 0) {
        return tileHtml("&#128200;", "Mutual funds", "&mdash;", "No holdings yet");
    }

    if (t.counted === 0) {
        return tileHtml("&#128200;", "Mutual funds", "&mdash;", `<span class="inv-warn">No values yet</span>`);
    }

    const pct = t.invested === 0 ? null : ((t.current - t.invested) / t.invested) * 100;

    const days = insDaysBetween(t.latest, today);

    const parts = [];

    if (pct !== null) {
        parts.push(signedPct(pct));
    }

    if (days > INV_STALE_DAYS) {
        parts.push(`<span class="inv-warn">values ${esc(ageText(days))}</span>`);
    }

    return tileHtml("&#128200;", "Mutual funds", inr0(t.current), parts.join(" &middot; "));
}


function vaultTile(today) {

    if (invFailed.includes("docs")) {
        return failedTile("&#128274;", "Vault");
    }

    let soon = 0;
    let expired = 0;

    const dates = invData.docs.map(d => d.expiry_date)
        .concat(invFailed.includes("cards") ? [] : invData.cards.map(c => c.valid_till))
        .filter(Boolean);

    dates.forEach(date => {

        const days = insDaysBetween(today, date);

        if (days < 0) expired++;
        else if (days <= INV_SOON_DAYS) soon++;
    });

    const parts = [];

    if (soon > 0) parts.push(`<span class="inv-warn">${soon} expiring</span>`);
    if (expired > 0) parts.push(`<span class="inv-bad">${expired} expired</span>`);

    return tileHtml("&#128274;", "Vault", plural(invData.docs.length, "document"), parts.length ? parts.join(" &middot; ") : "None expiring");
}


function familyTile(today) {

    const icon = "&#128106;";

    if (!isOwnerUser()) {
        return tileHtml(icon, "Family summary", "Open", "Where everything is");
    }

    if (invFailed.includes("family")) {
        return failedTile(icon, "Family summary");
    }

    const last = lastFamilyShare();

    if (!last) {
        return tileHtml(icon, "Family summary", "Never shared", `<span class="inv-bad">Make the PDF and share it</span>`);
    }

    const due = insAddMonths(last, INV_FAMILY_REFRESH_MONTHS);
    const days = insDaysBetween(today, due);

    const sub = days <= 0 ? `<span class="inv-bad">Refresh was due ${esc(shortDay(due))}</span>`
        : days <= 30 ? `<span class="inv-warn">Refresh due ${esc(shortDay(due))}</span>`
        : `Next refresh ${esc(shortDay(due))}`;

    return tileHtml(icon, "Family summary", esc(fullDay(last)), sub);
}


function renderTiles() {

    const today = getToday();

    document.getElementById("invTileDeposits").innerHTML = depositsTile(today);
    document.getElementById("invTileInsurance").innerHTML = insuranceTile(today);
    document.getElementById("invTileFunds").innerHTML = fundsTile(today);
    document.getElementById("invTileVault").innerHTML = vaultTile(today);
    document.getElementById("invTileFamily").innerHTML = familyTile(today);
}


// ======================================================
// THE FEED: every date, in one list
// ======================================================

const INV_MODULE_ORDER = { Deposits: 0, Insurance: 1, Vault: 2, Family: 3 };

// "covered, ₹1,074 spare" / "RD is ₹278 short" ...: how the RDs linked to a
// policy cover its NEXT premium. Same verdict as the Insurance page.
function fundingNote(f) {

    switch (f.status) {

        case "covered":
            return { text: `covered${f.gap > 0 ? `, ${inr0(f.gap)} spare` : ""}`, warn: false };

        case "short":
            return { text: `RD is ${inr0(-f.gap)} short`, warn: true };

        case "late":
            return { text: `RD matures ${plural(f.lateDays, "day")} after the due date`, warn: true };

        case "none":
            return { text: "no RD is saving for it", warn: true };

        default:
            return null;
    }
}


function buildEvents(today, end) {

    const upcoming = [];
    const overdue = [];

    const add = (list, e) => list.push(e);

    // ---- Deposits ----
    if (!invFailed.includes("deposits")) {

        invData.deposits.filter(d => d.status === "Active" && d.maturity_date).forEach(d => {

            const type = d.deposit_type || "Deposit";
            const days = insDaysBetween(today, d.maturity_date);
            const amount = d.maturity_amount !== null && d.maturity_amount !== undefined ? inr0(d.maturity_amount) : "";

            if (days < 0) {

                add(overdue, {
                    date: d.maturity_date, module: "Deposits", kind: "deposit",
                    title: `${type} matured, not closed \u00B7 ${d.purpose || ""}`,
                    detail: [amount, agoText(-days)].filter(Boolean).join(" \u00B7 "),
                    bad: true, href: `deposits.html?open=${d.deposit_id}`
                });

            } else if (d.maturity_date <= end) {

                let needed = "";
                let late = false;

                if (d.needed_by) {

                    needed = `needed ${shortDay(d.needed_by)}`;

                    if (d.maturity_date > d.needed_by) {
                        late = true;
                        needed += `, ${plural(insDaysBetween(d.needed_by, d.maturity_date), "day")} late`;
                    }
                }

                add(upcoming, {
                    date: d.maturity_date, module: "Deposits", kind: "deposit",
                    title: `${type} matures \u00B7 ${d.purpose || ""}`,
                    detail: [amount, inDays(days), needed].filter(Boolean).join(" \u00B7 "),
                    warn: late, href: `deposits.html?open=${d.deposit_id}`
                });
            }
        });
    }

    // ---- Insurance ----
    if (!invFailed.includes("policies")) {

        const rds = invData.deposits.filter(d => d.insurance_policy_id);

        invData.policies.filter(p => p.status === "Active").forEach(p => {

            const next = insNextDue(p, today);

            if (!next) {
                return;
            }

            const single = insIsSinglePayment(p);

            if (next.overdue) {

                add(overdue, {
                    date: next.date, module: "Insurance", kind: "renewal",
                    title: `Renewal date passed \u00B7 ${p.policy_name}`,
                    detail: agoText(-next.days),
                    bad: true, href: `insurance.html?open=${p.insurance_policy_id}`
                });

                return;
            }

            insDueDates(p, end).filter(date => date >= today).forEach(date => {

                const days = insDaysBetween(today, date);
                const amount = p.premium_amount !== null && p.premium_amount !== undefined ? ` \u00B7 ${inr0(p.premium_amount)}` : "";

                // The funding verdict is for the NEXT due date only. And it is left
                // out if the deposits didn't load: with no RDs to look at it would
                // wrongly say that nothing is saving for the premium.
                const note = date === next.date && !invFailed.includes("deposits")
                    ? fundingNote(insFunding(p, rds, today))
                    : null;

                add(upcoming, {
                    date, module: "Insurance", kind: "premium",
                    title: `${single ? "Renewal due" : "Premium due"} \u00B7 ${p.policy_name}${amount}`,
                    detail: [inDays(days), note ? note.text : ""].filter(Boolean).join(" \u00B7 "),
                    warn: !!(note && note.warn), href: `insurance.html?open=${p.insurance_policy_id}`
                });
            });
        });
    }

    // ---- Vault: identity documents and cards ----
    const expiry = (list, dateOf, labelOf, idOf, tab, kind) => {

        list.filter(x => dateOf(x)).forEach(x => {

            const date = dateOf(x);
            const days = insDaysBetween(today, date);
            const who = firstName(x.person_id);
            const label = labelOf(x);

            if (days < 0) {

                add(overdue, {
                    date, module: "Vault", kind,
                    title: `${label} expired${who ? ` \u00B7 ${who}` : ""}`,
                    detail: agoText(-days), bad: true,
                    href: `vault.html?tab=${tab}&open=${idOf(x)}`
                });

            } else if (date <= end) {

                add(upcoming, {
                    date, module: "Vault", kind,
                    title: `${label} expires${who ? ` \u00B7 ${who}` : ""}`,
                    detail: inDays(days), warn: days <= INV_SOON_DAYS,
                    href: `vault.html?tab=${tab}&open=${idOf(x)}`
                });
            }
        });
    };

    if (!invFailed.includes("docs")) {
        expiry(invData.docs, d => d.expiry_date, d => d.doc_type, d => d.identity_document_id, "identity", "expired-document");
    }

    if (!invFailed.includes("cards")) {
        expiry(invData.cards, c => c.valid_till, c => c.card_name || `${c.card_type} card`, c => c.card_id, "cards", "expired-card");
    }

    // ---- Vault: locker rent ----
    if (!invFailed.includes("lockers")) {

        invData.lockers.filter(l => l.rent_renewal_date).forEach(l => {

            const days = insDaysBetween(today, l.rent_renewal_date);
            const where = [l.bank_branch, l.locker_no ? `locker ${l.locker_no}` : ""].filter(Boolean).join(" ");
            const rent = l.rent_amount !== null && l.rent_amount !== undefined ? inr0(l.rent_amount) : "";

            if (days < 0) {

                add(overdue, {
                    date: l.rent_renewal_date, module: "Vault", kind: "locker",
                    title: `Locker rent renewal date passed \u00B7 ${where}`,
                    detail: [rent, agoText(-days)].filter(Boolean).join(" \u00B7 "), bad: true,
                    href: `vault.html?tab=lockers&open=${l.locker_id}`
                });

            } else if (l.rent_renewal_date <= end) {

                add(upcoming, {
                    date: l.rent_renewal_date, module: "Vault", kind: "locker",
                    title: `Locker rent renews \u00B7 ${where}`,
                    detail: [rent, inDays(days)].filter(Boolean).join(" \u00B7 "),
                    warn: days <= INV_SOON_DAYS, href: `vault.html?tab=lockers&open=${l.locker_id}`
                });
            }
        });
    }

    // ---- Family summary: due again six months after it was last shared (owner only) ----
    if (isOwnerUser() && !invFailed.includes("family")) {

        const last = lastFamilyShare();

        if (!last) {

            add(overdue, {
                date: today, module: "Family", kind: "family",
                title: "Family summary never shared",
                detail: "Make the PDF and share it with your family",
                bad: true, href: "family-summary.html"
            });

        } else {

            const due = insAddMonths(last, INV_FAMILY_REFRESH_MONTHS);
            const days = insDaysBetween(today, due);

            if (days <= 0) {

                add(overdue, {
                    date: due, module: "Family", kind: "family",
                    title: "Family summary due for a refresh",
                    detail: `last shared ${fullDay(last)}`,
                    bad: true, href: "family-summary.html"
                });

            } else if (due <= end) {

                add(upcoming, {
                    date: due, module: "Family", kind: "family",
                    title: "Family summary refresh due",
                    detail: `${inDays(days)} \u00B7 last shared ${fullDay(last)}`,
                    warn: days <= INV_SOON_DAYS, href: "family-summary.html"
                });
            }
        }
    }

    upcoming.sort((a, b) =>
        a.date.localeCompare(b.date)
        || INV_MODULE_ORDER[a.module] - INV_MODULE_ORDER[b.module]
        || a.title.localeCompare(b.title)
    );

    // most recently lapsed first
    overdue.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

    return { upcoming, overdue };
}


function overdueSummary(overdue) {

    const count = kind => overdue.filter(e => e.kind === kind).length;

    return [
        count("deposit") ? `${count("deposit")} matured, not closed` : "",
        count("renewal") ? plural(count("renewal"), "policy renewal") : "",
        count("expired-document") ? `${plural(count("expired-document"), "expired document")}` : "",
        count("expired-card") ? `${plural(count("expired-card"), "expired card")}` : "",
        count("locker") ? `${count("locker")} locker rent` : "",
        count("family") ? "family summary due" : ""
    ].filter(Boolean).join(", ");
}


function dateBlock(iso, withYear) {

    const { y, m, d } = insParts(iso);

    return `<div class="inv-date"><b>${d}</b><span>${INV_MONTHS[m - 1]}${withYear ? ` ${String(y).slice(2)}` : ""}</span></div>`;
}


function rowHtml(e, withYear) {

    return `
        <a class="inv-row" href="${esc(e.href)}">
            ${dateBlock(e.date, withYear)}
            <div class="inv-main">
                <div class="inv-title">${esc(e.title)}</div>
                <div class="inv-sub${e.bad ? " inv-bad" : e.warn ? " inv-warn" : ""}">${esc(e.detail)}</div>
            </div>
            <span class="inv-tag">${esc(e.module)}</span>
        </a>
    `;
}


function toggleOverdue() {

    invOverdueOpen = !invOverdueOpen;

    renderUpcoming();
}


function renderUpcoming() {

    const feed = document.getElementById("invFeed");

    if (!feed) {
        return;
    }

    const today = getToday();

    const { upcoming, overdue } = buildEvents(today, windowEnd(today));

    let html = "";

    if (overdue.length > 0) {

        html += `
            <button type="button" class="inv-row" id="invOverdueBtn" onclick="toggleOverdue()" aria-expanded="${invOverdueOpen}">
                <span class="inv-overdue-arrow">${invOverdueOpen ? "&#9662;" : "&#9656;"}</span>
                <div class="inv-main">
                    <div class="inv-title inv-bad">Overdue (${overdue.length})</div>
                    <div class="inv-sub">${esc(overdueSummary(overdue))}</div>
                </div>
                <span class="inv-tag">${invOverdueOpen ? "Hide" : "Show"}</span>
            </button>
            ${invOverdueOpen ? `<div id="invOverdueList">${overdue.map(e => rowHtml(e, true)).join("")}</div>` : ""}
        `;
    }

    if (upcoming.length === 0) {

        html += `<div class="empty-state">Nothing due in the next ${esc(windowLabel())}.</div>`;

    } else {

        let month = "";

        upcoming.forEach(e => {

            const { y, m } = insParts(e.date);
            const heading = `${INV_MONTH_NAMES[m - 1]} ${y}`;

            if (heading !== month) {
                month = heading;
                html += `<div class="inv-month">${heading}</div>`;
            }

            html += rowHtml(e, false);
        });
    }

    feed.innerHTML = html;
}
