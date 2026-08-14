-- 066_yandex_payment_order.sql
-- PROBLEM 1: Yandex "paid" IS provable from the united-netting report we already
-- ingest. The report's per-transaction "Статус" (already stored as status_note)
-- reads «Переведён по графику выплат» once the money is transferred, alongside a
-- payment-order number/date («Номер/Дата платежного поручения»). We were
-- discarding the payment-order columns, so we couldn't distinguish transferred
-- (paid) from «Будет переведён» (pending).
--
-- Additive + nullable: no backfill required to deploy. Existing rows read NULL
-- (→ treated as "not transferred / pending") until the next netting sync repopulates
-- them. Populated by lib/yandex/settlements-sync.ts; consumed in lib/db/payouts.ts
-- (status_note «Переведён…» AND payment_order_number present → paid).

ALTER TABLE yandex_settlement_transactions
  ADD COLUMN IF NOT EXISTS payment_order_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_order_date   TIMESTAMPTZ;
