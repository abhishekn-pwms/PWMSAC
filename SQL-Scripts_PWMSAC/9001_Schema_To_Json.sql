-- 9001_Schema_To_Json.sql
-- Basic schema dump: column name/type/nullable + view definitions.
-- Superseded for verification purposes by 9002 (which also captures
-- defaults, primary keys, foreign keys, indexes, grants, and RLS
-- policies) — kept as a lighter-weight quick-look option.

SELECT jsonb_pretty(jsonb_build_object(
    'tables', (
        SELECT jsonb_object_agg(table_name, columns)
        FROM (
            SELECT table_name, jsonb_agg(jsonb_build_object('column', column_name, 'type', data_type, 'nullable', is_nullable)) AS columns
            FROM information_schema.columns
            WHERE table_schema = 'public'
            GROUP BY table_name
        ) t
    ),
    'views', (
        SELECT jsonb_object_agg(table_name, view_definition)
        FROM information_schema.views
        WHERE table_schema = 'public'
    )
)) AS database_schema;
