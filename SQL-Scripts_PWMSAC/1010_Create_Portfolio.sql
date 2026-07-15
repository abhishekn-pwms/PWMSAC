-- 1010_Create_Portfolio.sql

create table if not exists portfolio (

    portfolio_id uuid
        primary key
        default gen_random_uuid(),

    portfolio_name text
        not null,

    portfolio_type text
        not null,

    description text,

    enabled boolean
        not null
        default true,

    display_order integer
        default 100,

    created_at timestamptz
        not null
        default now(),

    created_by text
        not null
        default 'System',

    updated_at timestamptz
        not null
        default now(),

    updated_by text
        not null
        default 'System'
);

create unique index if not exists
uq_portfolio_name
on portfolio(portfolio_name);

create index if not exists
idx_portfolio_name
on portfolio(portfolio_name);

create index if not exists
idx_portfolio_enabled
on portfolio(enabled);

grant all on table portfolio to anon;
grant all on table portfolio to authenticated;
