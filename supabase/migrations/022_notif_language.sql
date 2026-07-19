-- Per-user language for Telegram notifications.
-- The web UI stores language in a cookie/localStorage, which the cron job that
-- sends Telegram digests cannot read. Persist it here so alerts go out in the
-- language the user picked (uz / ru / en) instead of always defaulting to uz.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notif_lang text NOT NULL DEFAULT 'uz';
