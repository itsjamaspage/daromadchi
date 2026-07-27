-- Fix two tables that had no Row Level Security.
--
-- ext_activation_codes: used only by supabaseAdmin (server-side).
--   Enabling RLS with no policies blocks the anon/authenticated keys
--   entirely — only the service role can still read/write, which is
--   exactly how the code already works.
--
-- competitor_watchlist: contains per-user business data (competitor URLs,
--   pricing). Add RLS + an owner policy so each user only sees their own
--   rows. All operations (SELECT/INSERT/UPDATE/DELETE) are allowed when
--   the row's user_id matches the caller's auth.uid().

-- ── ext_activation_codes ──────────────────────────────────────────────────
ALTER TABLE public.ext_activation_codes ENABLE ROW LEVEL SECURITY;
-- No policies → anon and authenticated keys are blocked.
-- supabaseAdmin (service role) bypasses RLS and retains full access.

-- ── competitor_watchlist ──────────────────────────────────────────────────
ALTER TABLE public.competitor_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitor_watchlist_own"
  ON public.competitor_watchlist
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
