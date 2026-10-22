-- ==============================================================================
-- Migration: 20261023000000_profiles_feature_preferences.sql
-- Description: Add feature_preferences jsonb column to public.profiles
-- Backward-compatible, safe default '{}'::jsonb
-- ==============================================================================

alter table public.profiles
add column if not exists feature_preferences jsonb not null default '{}'::jsonb;
