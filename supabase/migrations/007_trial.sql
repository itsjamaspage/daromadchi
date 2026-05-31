-- Migration 007: 3-day free trial for new users
-- Run this in the Supabase SQL Editor

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
