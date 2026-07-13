// AC v1.7 DB BACKUP/EXPORT AND ATTENDANCE

// pwms-prev-config.js
// Connection details for pwms_prev — the backup/restore target project.
// Completely separate from config.js (the live project's connection).
// Never mix these two — this file only gets used by the Data Safety /
// Backup page when pushing a full-replace copy of live data into
// pwms_prev, nothing else in the app should ever reference it.
//
// Uses the PUBLISHABLE (anon) key — same kind already used in config.js
// for the live project — never the secret/service_role key. The anon
// key is safe in browser-side code specifically because RLS is the
// real gatekeeper (confirmed enabled on every pwms_prev table). The
// secret key bypasses RLS entirely and must never appear in any file
// a browser loads.

const PWMS_PREV_CONFIG = {

    SUPABASE_URL: "https://hgfgmeetgwvadtvadszw.supabase.co",

    // Paste the pwms_prev project's publishable/anon key here directly —
    // not into chat, not into any shared conversation. Find it in:
    // pwms_prev Supabase dashboard -> Project Settings -> API ->
    // "Project API keys" -> anon / public.
    SUPABASE_ANON_KEY: "sb_publishable_uMRg6iZrMrKriPP9-BcrGA_7m1IudlI"

};
