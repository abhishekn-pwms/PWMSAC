-- 9002_Live_Schema_Snapshot.sql
-- Run this directly in the Supabase SQL Editor every few days.
-- Paste the full output into your sync folder as a dated .txt/.json file.
--
-- Unlike 9001 (which only captured column name/type/nullable), this pulls
-- everything needed to actually verify or rebuild the schema from scratch:
-- columns WITH defaults, primary keys, foreign keys, unique constraints,
-- indexes, view definitions, table-level grants, and RLS policies.
--
-- This is a VERIFICATION tool, not a replacement for the curated
-- NNN_*.sql migration files — run it, then diff its output against
-- what those files claim should exist. Any mismatch means a table was
-- changed directly in the dashboard without a matching migration file
-- ever being written — exactly the gap that caused the missing
-- todo.milestone_id / task_log.todo_id columns.

SELECT jsonb_pretty(jsonb_build_object(

    'tables', (
        SELECT jsonb_object_agg(t.table_name, t.cols)
        FROM (
            SELECT
                c.table_name,
                jsonb_agg(
                    jsonb_build_object(
                        'column', c.column_name,
                        'type', c.data_type,
                        'nullable', c.is_nullable,
                        'default', c.column_default
                    )
                    ORDER BY c.ordinal_position
                ) AS cols
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            GROUP BY c.table_name
        ) t
    ),

    'primary_keys', (
        SELECT jsonb_object_agg(tc.table_name, kcu.column_name)
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
    ),

    'foreign_keys', (
        SELECT jsonb_agg(
            jsonb_build_object(
                'table', tc.table_name,
                'column', kcu.column_name,
                'references_table', ccu.table_name,
                'references_column', ccu.column_name
            )
        )
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    ),

    'unique_constraints', (
        SELECT jsonb_agg(
            jsonb_build_object(
                'table', tc.table_name,
                'constraint', tc.constraint_name,
                'column', kcu.column_name
            )
        )
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = 'public'
    ),

    'indexes', (
        SELECT jsonb_agg(
            jsonb_build_object(
                'table', tablename,
                'index_name', indexname,
                'definition', indexdef
            )
        )
        FROM pg_indexes
        WHERE schemaname = 'public'
    ),

    'views', (
        SELECT jsonb_object_agg(table_name, view_definition)
        FROM information_schema.views
        WHERE table_schema = 'public'
    ),

    'table_grants', (
        SELECT jsonb_agg(DISTINCT
            jsonb_build_object(
                'table', table_name,
                'grantee', grantee,
                'privilege', privilege_type
            )
        )
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
            AND grantee IN ('anon', 'authenticated')
    ),

    'rls_policies', (
        SELECT jsonb_agg(
            jsonb_build_object(
                'table', tablename,
                'policy_name', policyname,
                'command', cmd,
                'roles', roles
            )
        )
        FROM pg_policies
        WHERE schemaname = 'public'
    ),

    'rls_enabled_tables', (
        SELECT jsonb_agg(relname)
        FROM pg_class
        WHERE relrowsecurity = true
            AND relnamespace = 'public'::regnamespace
    )

)) AS live_schema_snapshot;
