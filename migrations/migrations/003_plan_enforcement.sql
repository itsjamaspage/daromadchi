-- Add plan columns to users table
alter table public.users
  add column if not exists plan text not null default 'free',
  add column if not exists plan_expires_at timestamptz;

-- Add notification_time to user_settings
-- Values: 'morning' (08:00 UZT), 'noon' (13:00 UZT), 'evening' (20:00 UZT)
alter table public.user_settings
  add column if not exists notification_time text default null;
