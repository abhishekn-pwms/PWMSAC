-- 9004_Cleanup_Drop_All.sql
-- Reverses 9003_Master_Rebuild.sql exactly — removes every table, view,
-- policy, and index it creates, so a test/scratch project can be
-- returned to its prior state. Not part of the build sequence itself;
-- this is a one-time manual reversal tool.
--
-- Order matters: views before the tables they're built on, and tables
-- in reverse dependency order (most-dependent first) so no foreign key
-- blocks a drop. CASCADE is added as a safety net in case anything
-- outside this list ended up depending on these objects — it won't
-- change behavior here since everything is already being removed, but
-- it prevents a stray dependency from silently halting the cleanup.
--
-- Dropping each table also removes its policies and indexes
-- automatically — no separate policy/index drops needed.

-- ==========================================================================
-- STEP 1: Views — drop dependents before the views they're built on
-- ==========================================================================

drop view if exists vw_review_portfolio_time cascade;
drop view if exists vw_review_time_summary cascade;
drop view if exists vw_review_recent_logs cascade;
drop view if exists vw_task_log_details cascade;
drop view if exists vw_todo cascade;
drop view if exists vw_review_activity_summary cascade;
drop view if exists vw_review_open_activities cascade;
drop view if exists vw_activity_details cascade;
drop view if exists vw_milestone_details cascade;

-- ==========================================================================
-- STEP 2: Tables — reverse dependency order (most-dependent first)
-- ==========================================================================

drop table if exists task_log cascade;
drop table if exists todo cascade;
drop table if exists activity cascade;
drop table if exists milestone cascade;
drop table if exists project cascade;
drop table if exists portfolio cascade;

drop table if exists update_prep_history cascade;
drop table if exists update_prep_settings cascade;
