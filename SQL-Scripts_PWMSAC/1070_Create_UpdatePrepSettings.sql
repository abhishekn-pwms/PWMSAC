-- 1070_Create_UpdatePrepSettings.sql
-- Generic key/value store for the Update Prep page — style instructions,
-- templates, attachment mode, recency, all per format, plus shared
-- spoken style. One row per setting_key.

create table if not exists update_prep_settings (
    setting_key text primary key,
    setting_value text,
    updated_at timestamptz not null default now()
);

grant all on table update_prep_settings to anon;
grant all on table update_prep_settings to authenticated;
