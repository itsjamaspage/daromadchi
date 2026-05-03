-- Add Uzum API token and sync timestamp to profiles
alter table public.profiles
  add column if not exists uzum_api_token text,
  add column if not exists last_synced_at timestamptz;

-- Token is sensitive — only the owner can read it
-- RLS already restricts profiles to the owner (policy added in 001)
