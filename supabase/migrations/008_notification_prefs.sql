-- Telegram notification preferences (which notifications + when to send)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notif_low_stock      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_daily_summary  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_new_orders     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_weekly_report  boolean NOT NULL DEFAULT false,
  -- Local time (HH:MM, 24h) at which scheduled summaries/reports are sent
  ADD COLUMN IF NOT EXISTS notif_send_time      text    NOT NULL DEFAULT '09:00',
  -- Days of week to send scheduled reports: 0=Sun … 6=Sat, stored as int[]
  ADD COLUMN IF NOT EXISTS notif_send_days      int[]   NOT NULL DEFAULT '{1,2,3,4,5,6,0}';
