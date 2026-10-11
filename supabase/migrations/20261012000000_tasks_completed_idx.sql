-- ==============================================================================
-- Migration: 20261012000000_tasks_completed_idx.sql
-- Description: Add index on tasks(user_id, completed_at) for fast weekly productivity aggregations.
-- ==============================================================================

create index if not exists tasks_user_completed_idx on public.tasks(user_id, completed_at);
