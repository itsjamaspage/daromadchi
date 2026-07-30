-- 035_yandex_settlements.sql
-- Stores the raw per-transaction rows from Yandex Market's united-netting-report.
-- One row per financial event (Начисление / Удержание). Multiple rows can
-- share the same order_id_external (e.g. one payment + one delivery
-- deduction + one commission deduction all for the same order).
--
-- Populated by lib/yandex/settlements-sync.ts via the async
-- /reports/united-netting-report/generate → poll → download → parse flow.
-- Aggregated per order in lib/db/payouts.ts so the Payouts UI shows real
-- settlement numbers instead of the "Ожидает данных Yandex" placeholder.

CREATE TABLE IF NOT EXISTS yandex_settlement_transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  -- Yandex's numeric transaction ID from the netting report.
  transaction_id         TEXT NOT NULL,
  -- Yandex's order ID as printed on the shipment / cabinet.
  order_id_external      TEXT,
  -- "Начисление" or "Удержание"
  entry_type             TEXT NOT NULL,
  -- "Платёж покупателя" / "Оплата услуг Market Yandex Go" / …
  entry_source           TEXT,
  -- "Продажа физлицу" / "Доставка покупателю" / "Поручение на продажу"
  order_type             TEXT,
  sku                    TEXT,
  amount                 NUMERIC(14,2) NOT NULL,
  quantity               INTEGER,
  transaction_at         TIMESTAMPTZ,
  order_created_at       TIMESTAMPTZ,
  order_delivered_at     TIMESTAMPTZ,
  status_note            TEXT,
  report_id              TEXT,
  synced_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS yandex_settlement_shop_order_idx
  ON yandex_settlement_transactions (shop_id, order_id_external);
CREATE INDEX IF NOT EXISTS yandex_settlement_transaction_at_idx
  ON yandex_settlement_transactions (transaction_at);
