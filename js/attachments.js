// AC v2.0 BANKNDEPOSITS

// The reusable Attachments section for any record's form. Policies, RDs and
// (later) IDs, cards, lockers and funds all use this one component and the
// one shared attachment table.
//
// HOW IT BEHAVES (matching the ToDo page):
//   * New files are STAGED. Nothing uploads until the record is saved; the
//     page then calls commit(). A file that fails to upload never blocks
//     the record from saving.
//   * Existing files can be opened, ticked "Family", or deleted straight
//     away -- those act immediately, with a confirm before a delete.
//   * Files are grouped by document type (Policy document, Medical records,
//     Deposit advice...). Pick the type first, then add the files; a snip
//     can also be pasted with Ctrl+V while the form is open.
//
// A page makes one section per form:
//
//   const atts = createAttachmentSection({
//       containerId: "depAttachments",     // an empty <div> in the form
//       parentColumn: "deposit_id",        // the column on the attachment table
//       folder: "deposit",                 // first part of the storage path
//       docTypes: MASTERS.ATTACHMENT_DOC_TYPES.deposit
//   });
//   atts.reset();                  // new record: nothing yet
//   await atts.load(recordId);     // existing record: show its files
//   await atts.commit(recordId);   // after saving: upload what was staged

const RECORD_ATTACHMENT_BUCKET = "records-attachments";
const RECORD_ATTACHMENT_MAX_MB = 49;
const RECORD_ATTACHMENT_ACCEPT = ".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv";


function attEscape(value) {

    return String(value === null || value === undefined ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function attSafeName(name) {

    return String(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}


function attFormatSize(bytes) {

    if (bytes === null || bytes === undefined || bytes === "") {
        return "";
    }

    const n = Number(bytes);

    if (n >= 1024 * 1024) {
        return (n / (1024 * 1024)).toFixed(1) + " MB";
    }

    return Math.max(1, Math.round(n / 1024)) + " KB";
}


function attIsImage(contentType, fileName) {

    return String(contentType || "").startsWith("image/")
        || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(String(fileName || ""));
}


function attIcon(contentType, fileName) {

    return attIsImage(contentType, fileName)
        ? "&#128444;&#65039;"
        : "&#128196;";
}


// How many files each record has, as { recordId: count }, for the
// paperclip counts in a list. Pages through the table so it never silently
// stops at the API's row limit.
async function fetchAttachmentCounts(parentColumn) {

    const PAGE = 1000;
    const counts = {};
    let offset = 0;

    while (true) {

        const rows = await getData(
            `attachment?select=${parentColumn}&${parentColumn}=not.is.null&order=attachment_id.asc&limit=${PAGE}&offset=${offset}`
        );

        if (!Array.isArray(rows)) {
            console.error(rows);
            return counts;
        }

        rows.forEach(r => {
            counts[r[parentColumn]] = (counts[r[parentColumn]] || 0) + 1;
        });

        if (rows.length < PAGE) {
            break;
        }

        offset += PAGE;
    }

    return counts;
}


function createAttachmentSection(config) {

    const docTypes = config.docTypes && config.docTypes.length ? config.docTypes : ["Other"];

    const state = {
        parentId: null,
        existing: [],
        staged: [],
        docType: docTypes[0],
        notice: ""
    };

    function container() {
        return document.getElementById(config.containerId);
    }


    // ---------------------------------------------------------------- render

    function typeOrder(type) {

        const i = docTypes.indexOf(type);

        return i === -1 ? docTypes.length : i;
    }


    function render() {

        const box = container();

        if (!box) {
            return;
        }

        const total = state.existing.length + state.staged.length;

        const groups = {};

        state.existing.forEach(row => {
            (groups[row.doc_type || "Other"] = groups[row.doc_type || "Other"] || { existing: [], staged: [] }).existing.push(row);
        });

        state.staged.forEach((s, index) => {
            (groups[s.docType] = groups[s.docType] || { existing: [], staged: [] }).staged.push({ s, index });
        });

        let html = `
            <div class="att-head">
                <div class="att-title">Attachments <span class="att-count">&middot; ${total} file${total === 1 ? "" : "s"}</span></div>
                <div class="att-controls">
                    <select class="att-type" data-att="type" aria-label="Document type">
                        ${docTypes.map(t => `<option value="${attEscape(t)}"${t === state.docType ? " selected" : ""}>${attEscape(t)}</option>`).join("")}
                    </select>
                    <button type="button" class="btn btn-secondary btn-sm" data-att="add">&#128206; Add files</button>
                    <input type="file" multiple class="att-file" data-att="file" accept="${RECORD_ATTACHMENT_ACCEPT}" style="display:none;">
                </div>
            </div>
        `;

        if (state.notice) {
            html += `<div class="att-notice">${state.notice}</div>`;
        }

        const typeNames = Object.keys(groups).sort((a, b) => typeOrder(a) - typeOrder(b) || a.localeCompare(b));

        typeNames.forEach(type => {

            const g = groups[type];
            const n = g.existing.length + g.staged.length;

            html += `<div class="att-group"><div class="att-group-title">${attEscape(type)} &middot; ${n}</div>`;

            g.existing.forEach(row => {

                html += `
                    <div class="att-row" data-id="${attEscape(row.attachment_id)}">
                        <span class="att-icon">${attIcon(row.content_type, row.file_name)}</span>
                        <a href="#" class="att-name" data-att="open" data-id="${attEscape(row.attachment_id)}">${attEscape(row.label || row.file_name)}</a>
                        <span class="att-size">${attEscape(attFormatSize(row.file_size))}</span>
                        <label class="att-tick"><input type="checkbox" data-att="share" data-id="${attEscape(row.attachment_id)}"${row.share_with_family ? " checked" : ""}> Family</label>
                        <button type="button" class="att-x" data-att="remove" data-id="${attEscape(row.attachment_id)}" title="Delete this file">&#10005;</button>
                    </div>
                `;
            });

            g.staged.forEach(({ s, index }) => {

                html += `
                    <div class="att-row att-staged" data-index="${index}">
                        <span class="att-icon">${attIcon(s.file.type, s.file.name)}</span>
                        <span class="att-name att-name-staged">${attEscape(s.file.name)}</span>
                        <span class="att-pending">Pending</span>
                        <span class="att-size">${attEscape(attFormatSize(s.file.size))}</span>
                        <label class="att-tick"><input type="checkbox" data-att="stage-share" data-index="${index}"${s.share ? " checked" : ""}> Family</label>
                        <button type="button" class="att-x" data-att="unstage" data-index="${index}" title="Do not upload this file">&#10005;</button>
                    </div>
                `;
            });

            html += `</div>`;
        });

        html += `<div class="att-hint">Choose the type, then add files or paste a snip with Ctrl+V. New files upload when you press Save. Tick Family to let family open a file.</div>`;

        box.innerHTML = html;
    }


    // ---------------------------------------------------------------- staging

    function stageFiles(fileList) {

        const rejected = [];

        Array.from(fileList).forEach(file => {

            const sizeMB = file.size / (1024 * 1024);

            if (sizeMB > RECORD_ATTACHMENT_MAX_MB) {
                rejected.push(`"${attEscape(file.name)}" (${sizeMB.toFixed(1)} MB)`);
                return;
            }

            state.staged.push({ file, docType: state.docType, share: false });
        });

        state.notice = rejected.length
            ? `Not added, over ${RECORD_ATTACHMENT_MAX_MB} MB: ${rejected.join(", ")}`
            : "";

        render();
    }


    function findExisting(id) {

        return state.existing.find(r => String(r.attachment_id) === String(id));
    }


    async function openExisting(id) {

        const row = findExisting(id);

        if (!row) {
            return;
        }

        // Open the tab first, while the click still counts, then point it at
        // the signed link; opening after the await can be blocked.
        const tab = window.open("", "_blank");

        const { data, error } = await supabaseClient
            .storage
            .from(RECORD_ATTACHMENT_BUCKET)
            .createSignedUrl(row.storage_path, 3600);

        if (error || !data) {

            if (tab) {
                tab.close();
            }

            showError("Could not open the file");

            return;
        }

        if (tab) {
            tab.location.href = data.signedUrl;
        } else {
            showError("Allow pop-ups for this site to open files");
        }
    }


    async function setShare(id, checked) {

        const row = findExisting(id);

        if (!row) {
            return;
        }

        const result = await updateData("attachment", "attachment_id", id, {
            share_with_family: checked,
            updated_at: new Date().toISOString(),
            updated_by: getCurrentUser()
        });

        if (!Array.isArray(result) || result.length === 0) {

            showError("Could not change family sharing for this file");

        } else {

            row.share_with_family = checked;
        }

        render();
    }


    async function removeExisting(id) {

        const row = findExisting(id);

        if (!row) {
            return;
        }

        if (!confirmAction(`Delete "${row.label || row.file_name}"?`)) {
            return;
        }

        // The row first: if that fails nothing is lost. The file itself is
        // removed only once the row is gone, so a failure there leaves at
        // worst an unreferenced file, never a record pointing at nothing.
        const deleted = await deleteData("attachment", "attachment_id", id);

        if (!Array.isArray(deleted) || deleted.length === 0) {

            showError("Unable to delete the attachment");

            return;
        }

        const { error } = await supabaseClient
            .storage
            .from(RECORD_ATTACHMENT_BUCKET)
            .remove([row.storage_path]);

        if (error) {
            console.error(error);
        }

        state.existing = state.existing.filter(r => String(r.attachment_id) !== String(id));

        render();

        showSuccess("Attachment deleted");
    }


    // ---------------------------------------------------------------- events

    function onClick(event) {

        const target = event.target.closest ? event.target.closest("[data-att]") : null;

        if (!target) {
            return;
        }

        const action = target.getAttribute("data-att");

        if (action === "add") {

            const input = container().querySelector('[data-att="file"]');

            if (input) {
                input.click();
            }

        } else if (action === "open") {

            event.preventDefault();

            openExisting(target.getAttribute("data-id"));

        } else if (action === "remove") {

            removeExisting(target.getAttribute("data-id"));

        } else if (action === "unstage") {

            state.staged.splice(Number(target.getAttribute("data-index")), 1);

            state.notice = "";

            render();
        }
    }


    function onChange(event) {

        const target = event.target.closest ? event.target.closest("[data-att]") : null;

        if (!target) {
            return;
        }

        const action = target.getAttribute("data-att");

        if (action === "type") {

            state.docType = target.value;

        } else if (action === "file") {

            stageFiles(target.files);

            target.value = "";

        } else if (action === "share") {

            setShare(target.getAttribute("data-id"), target.checked);

        } else if (action === "stage-share") {

            const item = state.staged[Number(target.getAttribute("data-index"))];

            if (item) {
                item.share = target.checked;
            }
        }
    }


    function formIsOpen() {

        const box = container();

        if (!box) {
            return false;
        }

        const modal = box.closest ? box.closest(".modal") : null;

        return !modal || modal.style.display === "block" || modal.style.display === "flex";
    }


    function onPaste(event) {

        if (!formIsOpen() || !event.clipboardData) {
            return;
        }

        const images = Array.from(event.clipboardData.items || [])
            .filter(i => i.kind === "file" && String(i.type).startsWith("image/"))
            .map(i => i.getAsFile())
            .filter(Boolean);

        if (images.length === 0) {
            return;
        }

        event.preventDefault();

        const stamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);

        stageFiles(images.map((f, i) => new File(
            [f],
            `Pasted image ${stamp}${images.length > 1 ? "-" + (i + 1) : ""}.png`,
            { type: f.type || "image/png" }
        )));
    }


    // The container is part of a static page, so these are attached once.
    const box = container();

    if (box) {
        box.addEventListener("click", onClick);
        box.addEventListener("change", onChange);
    }

    document.addEventListener("paste", onPaste);


    // ---------------------------------------------------------------- public

    async function load(parentId) {

        state.parentId = parentId || null;
        state.staged = [];
        state.notice = "";
        state.docType = docTypes[0];
        state.existing = [];

        render();

        if (!parentId) {
            return;
        }

        const rows = await getData(
            `attachment?${config.parentColumn}=eq.${parentId}&order=created_at.asc`
        );

        if (!Array.isArray(rows)) {

            console.error(rows);

            state.notice = "Could not load this record's attachments.";

        } else if (state.parentId === parentId) {

            state.existing = rows;
        }

        render();
    }


    function reset() {

        state.parentId = null;
        state.existing = [];
        state.staged = [];
        state.notice = "";
        state.docType = docTypes[0];

        render();
    }


    // Uploads every staged file and records it. A failure on one file never
    // stops the others, and never undoes the saved record.
    async function commit(parentId) {

        const result = { uploaded: 0, failed: [] };

        const pending = state.staged.slice();

        for (const item of pending) {

            const path = `${config.folder}/${parentId}/${crypto.randomUUID()}-${attSafeName(item.file.name)}`;

            const { error: uploadError } = await supabaseClient
                .storage
                .from(RECORD_ATTACHMENT_BUCKET)
                .upload(path, item.file, { contentType: item.file.type || undefined });

            if (uploadError) {

                console.error(uploadError);

                result.failed.push(item.file.name);

                continue;
            }

            const inserted = await insertData("attachment", {
                [config.parentColumn]: parentId,
                doc_type: item.docType,
                file_name: item.file.name,
                storage_path: path,
                content_type: item.file.type || null,
                file_size: item.file.size,
                share_with_family: !!item.share,
                created_by: getCurrentUser()
            });

            if (!Array.isArray(inserted)) {

                console.error(inserted);

                // The file went up but its record did not: take the file back
                // out, so nothing is left unreferenced.
                await supabaseClient.storage.from(RECORD_ATTACHMENT_BUCKET).remove([path]);

                result.failed.push(item.file.name);

                continue;
            }

            result.uploaded++;
        }

        state.staged = [];

        if (result.failed.length > 0) {
            showError(`Could not upload ${result.failed.map(n => `"${n}"`).join(", ")} \u2014 the record itself was saved`);
        }

        return result;
    }


    return {
        load,
        reset,
        commit,
        stagedCount: () => state.staged.length,
        // exposed for tests and for pages that want to read the state
        _state: state
    };
}
