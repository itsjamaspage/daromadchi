-- Billing test-data cleanup (run MANUALLY on the VPS; nothing here auto-runs).
--
-- RUN THE SELECT FIRST, eyeball the rows, and ONLY THEN run the DELETE.
-- The filters are written so this can NEVER touch a real (paid) payment:
--   • payer_email = '[atmos:direct test]'  → rows the atmos:direct script inserted
--     (user_id is NULL on those, so they belong to no real user).
--   • the second branch is scoped to YOUR test user, provider='atmos',
--     status IN ('pending','failed') — never 'paid' — and only today's attempts.
--
-- Replace :test_user_id with your test user's UUID (find it: SELECT id, email FROM users WHERE email = 'you@example.com';).

-- ── 1) VERIFY — exactly what the DELETE would remove ────────────────────────────
SELECT id, account, plan, amount, status, atmos_status, payer_email, created_at
FROM payments
WHERE payer_email = '[atmos:direct test]'
   OR (
        user_id = :test_user_id
        AND provider = 'atmos'
        AND status IN ('pending', 'failed')   -- never 'paid'
        AND created_at >= CURRENT_DATE         -- today's test attempts only
      )
ORDER BY created_at DESC;

-- ── 2) DELETE — uncomment and run ONLY after the SELECT shows just test rows ─────
-- DELETE FROM payments
-- WHERE payer_email = '[atmos:direct test]'
--    OR (
--         user_id = :test_user_id
--         AND provider = 'atmos'
--         AND status IN ('pending', 'failed')
--         AND created_at >= CURRENT_DATE
--       );

-- ── Optional: orphan test subscriptions (pending, never activated) ──────────────
-- These are the 'pending' subscription shells from abandoned test attempts. NEVER
-- delete an 'active' subscription. Verify with the SELECT before uncommenting.
-- SELECT id, plan, status, created_at FROM subscriptions
--   WHERE user_id = :test_user_id AND status = 'pending' AND created_at >= CURRENT_DATE;
-- DELETE FROM subscriptions
--   WHERE user_id = :test_user_id AND status = 'pending' AND created_at >= CURRENT_DATE;
