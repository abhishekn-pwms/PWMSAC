// AC v1.7f QUICKLOG

// A free-form scribbler translating the Notepad ".LOG" habit into real
// rows: open, get a timestamp typed into the box, type anything, save.
// entry_text stores HTML — rich formatting, pasted Office content, and
// inline base64 images all live directly in that field.

let qlAllEntries = [];


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await requireAuthentication();

        await initializeLayout();

        await loadQuickLogEntries();
    }
);


// ======================================================
// LOAD / RENDER
// ======================================================

async function fetchAllQuickLogRows() {

    const PAGE_SIZE = 1000;
    let allRows = [];
    let offset = 0;

    while (true) {

        const page = await getData(`quicklog_entries?order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`);
        const pageRows = Array.isArray(page) ? page : [];

        allRows = allRows.concat(pageRows);

        if (pageRows.length < PAGE_SIZE) {
            break;
        }

        offset += PAGE_SIZE;
    }

    return allRows;
}


async function loadQuickLogEntries() {

    qlAllEntries = await fetchAllQuickLogRows();

    renderQuickLogEntries();
}


function stripHtmlToText(html) {

    const tmp = document.createElement("div");
    tmp.innerHTML = html;

    return tmp.textContent || tmp.innerText || "";
}


function renderQuickLogEntries() {

    const container = document.getElementById("qlFeed");
    const searchTerm = document.getElementById("qlSearchBox").value.trim().toLowerCase();

    let filtered = qlAllEntries;

    if (searchTerm) {

        filtered = qlAllEntries.filter(
            e => stripHtmlToText(e.entry_text).toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="wb-empty-state">No entries found.</div>`;
        return;
    }

    container.innerHTML = filtered
        .map(e => `
            <div class="ql-panel" style="margin-bottom:8px; padding:10px 14px;" data-entry-id="${e.entry_id}">
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-bottom:4px;">
                    <span style="cursor:pointer; color:var(--text-secondary); font-size:0.9rem;" onclick="startEditQuickLogEntry('${e.entry_id}')" title="Edit">✏️</span>
                    <span style="cursor:pointer; color:var(--danger); font-size:0.9rem;" onclick="deleteQuickLogEntry('${e.entry_id}')" title="Delete">🗑️</span>
                </div>
                <div class="ql-entry-display" style="font-size:0.85rem; white-space:pre-wrap; line-height:1.6;">${e.entry_text}</div>
            </div>
        `)
        .join("");
}


// ======================================================
// NEW ENTRY — auto-date-fill, Ctrl+Enter, save
// ======================================================

function isQuickLogBoxEmpty(box) {

    const html = box.innerHTML.trim();

    return html === "" || html === "<br>";
}


function formatQuickLogTimestamp(date) {

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[date.getMonth()];
    const yyyy = date.getFullYear();

    return `${dd}-${mon}-${yyyy} ${hh}:${mm}`;
}


function placeCursorAtEnd(el) {

    el.focus();

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}


function onQuickLogBoxFocus() {

    const box = document.getElementById("qlNewEntryBox");

    if (!isQuickLogBoxEmpty(box)) {
        return;
    }

    const stamp = formatQuickLogTimestamp(new Date());

    box.innerHTML = `${stamp}<br><br>`;

    placeCursorAtEnd(box);
}


function onQuickLogKeydown(event) {

    if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        saveQuickLogEntry();
    }
}


async function saveQuickLogEntry() {

    const box = document.getElementById("qlNewEntryBox");
    const html = box.innerHTML.trim();

    if (isQuickLogBoxEmpty(box)) {
        showError("Nothing to save");
        return;
    }

    try {

        await insertData("quicklog_entries", {
            entry_text: html,
            created_by: getCurrentUser(),
            updated_by: getCurrentUser()
        });

        box.innerHTML = "";

        await loadQuickLogEntries();

        box.focus();

    } catch (error) {

        console.error(error);
        showError("Unable to save entry");
    }
}


// ======================================================
// EDIT / DELETE
// ======================================================

function quickLogToolbarHtml() {

    return `
        <div style="display:flex; gap:6px; margin-bottom:6px; border-bottom:1px solid var(--border); padding-bottom:6px;">
            <button type="button" class="btn btn-secondary" style="font-weight:bold; padding:4px 10px;" onmousedown="event.preventDefault()" onclick="document.execCommand('bold')">B</button>
            <button type="button" class="btn btn-secondary" style="font-style:italic; padding:4px 10px;" onmousedown="event.preventDefault()" onclick="document.execCommand('italic')">I</button>
            <button type="button" class="btn btn-secondary" style="text-decoration:underline; padding:4px 10px;" onmousedown="event.preventDefault()" onclick="document.execCommand('underline')">U</button>
            <button type="button" class="btn btn-secondary" style="padding:4px 10px;" onmousedown="event.preventDefault()" onclick="document.execCommand('insertUnorderedList')">• List</button>
            <button type="button" class="btn btn-secondary" style="padding:4px 10px;" onmousedown="event.preventDefault()" onclick="document.execCommand('insertOrderedList')">1. List</button>
        </div>
    `;
}


function startEditQuickLogEntry(entryId) {

    const entry = qlAllEntries.find(e => e.entry_id === entryId);

    if (!entry) {
        return;
    }

    const card = document.querySelector(`[data-entry-id="${entryId}"]`);

    card.innerHTML = `
        ${quickLogToolbarHtml()}
        <div
            id="qlEditBox_${entryId}"
            contenteditable="true"
            style="min-height:60px; border:1px solid var(--border); border-radius:6px; padding:8px; font-size:0.85rem; line-height:1.6; white-space:pre-wrap;"
            onpaste="handleQuickLogPaste(event, 'qlEditBox_${entryId}')"
        >${entry.entry_text}</div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button class="btn btn-secondary" onclick="renderQuickLogEntries()">Cancel</button>
            <button class="btn btn-primary" onclick="saveEditQuickLogEntry('${entryId}')">Save</button>
        </div>
    `;

    document.getElementById(`qlEditBox_${entryId}`).focus();
}


async function saveEditQuickLogEntry(entryId) {

    const box = document.getElementById(`qlEditBox_${entryId}`);
    const html = box.innerHTML.trim();

    if (html === "" || html === "<br>") {
        showError("Entry can't be empty");
        return;
    }

    try {

        await updateData("quicklog_entries", "entry_id", entryId, {
            entry_text: html,
            updated_at: new Date().toISOString(),
            updated_by: getCurrentUser()
        });

        await loadQuickLogEntries();

        showSuccess("Entry updated");

    } catch (error) {

        console.error(error);
        showError("Unable to update entry");
    }
}


async function deleteQuickLogEntry(entryId) {

    if (!confirmAction("Delete this Quick Log entry?")) {
        return;
    }

    try {

        await deleteData("quicklog_entries", "entry_id", entryId);

        await loadQuickLogEntries();

        showSuccess("Entry deleted");

    } catch (error) {

        console.error(error);
        showError("Unable to delete entry");
    }
}


// ======================================================
// PASTE HANDLING
//   - Raw image (e.g. Snip & Sketch, no HTML alternative on the
//     clipboard) -> converted to a base64 <img>, inserted at the
//     cursor, default paste suppressed.
//   - Office HTML (Word/Excel/PowerPoint/Outlook) -> left to the
//     browser's native paste (which already carries real HTML,
//     including tables and embedded images), then cleaned up
//     afterward to strip Microsoft-specific styling while keeping
//     structure (tables/bold/lists).
// ======================================================

function handleQuickLogPaste(event, targetId) {

    const items = (event.clipboardData || window.clipboardData).items;

    let hasHtml = false;

    for (const item of items) {
        if (item.type === "text/html") {
            hasHtml = true;
            break;
        }
    }

    if (!hasHtml) {

        for (const item of items) {

            if (item.type.indexOf("image/") === 0) {

                const file = item.getAsFile();

                if (file) {

                    const reader = new FileReader();

                    reader.onload = () => {
                        document.execCommand("insertImage", false, reader.result);
                    };

                    reader.readAsDataURL(file);
                }

                event.preventDefault();
                return;
            }
        }

        // Plain text or nothing usable — let default paste happen.
        return;
    }

    // Office HTML paste — let the browser insert it natively, then
    // clean up shortly after (needs a tick for the paste to land).
    setTimeout(() => {

        const box = document.getElementById(targetId);

        if (box) {
            cleanupPastedHtml(box);
        }

    }, 0);
}


function cleanupPastedHtml(container) {

    container.querySelectorAll("style, meta, link, script, xml").forEach(el => el.remove());

    container.querySelectorAll("*").forEach(el => {

        el.removeAttribute("style");
        el.removeAttribute("class");
        el.removeAttribute("lang");
        el.removeAttribute("align");

        if (el.tagName === "SPAN" || el.tagName === "FONT") {

            const parent = el.parentNode;

            if (parent) {

                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }

                parent.removeChild(el);
            }
        }
    });

    // Re-add minimal, consistent table styling since all inline
    // styles (including Office's borders) were just stripped above.
    container.querySelectorAll("table").forEach(t => {
        t.style.borderCollapse = "collapse";
    });

    container.querySelectorAll("td, th").forEach(c => {
        c.style.border = "0.5px solid var(--border)";
        c.style.padding = "4px 8px";
    });
}
