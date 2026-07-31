-- 1080_Create_UpdatePrepHistory.sql
-- Append-only log, one row per period per format. Written and spoken
-- content share the same row for a given format+period, updated in
-- place as each half gets saved.

create table if not exists update_prep_history (
    history_id uuid primary key default gen_random_uuid(),
    format text not null,                  -- 'manager' or 'csaio'
    period_from date not null,
    period_to date not null,
    generated_prompt text,
    finished_update text,
    spoken_prompt text,
    finished_spoken text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists
idx_update_prep_history_format_date
on update_prep_history (format, period_to desc);

grant all on table update_prep_history to anon;
grant all on table update_prep_history to authenticated;
