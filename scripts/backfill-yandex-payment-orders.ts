/**
 * One-time backfill for Yandex "paid" (payment_order_number) after migration 066.
 *
 * The netting report isn't persisted, so backfilling the payment-order columns
 * needs a re-fetch. The default sync window is only 7 days; a transfer can post
 * weeks after the transaction date, so this runs syncYandexSettlements with a
 * WIDE window (default 60 days) to re-generate a report that covers older orders
 * and re-parse it with the new payment-order columns.
 *
 * Run on the VPS AFTER migration 066 is applied and the new code is deployed:
 *   set -a; . ./.env; set +a
 *   ./node_modules/.bin/tsx scripts/backfill-yandex-payment-orders.ts          # 60-day window
 *   ./node_modules/.bin/tsx scripts/backfill-yandex-payment-orders.ts 90       # custom window (days)
 *
 * Read from Yandex (report generate/download) + local upsert into our
 * yandex_settlement_transactions cache. NOT a marketplace write.
 */
import { and, eq } from 'drizzle-orm'
import { db, shops, yandexSettlementTransactions } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { syncYandexSettlements } from '@/lib/yandex/settlements-sync'

const windowDays = Math.max(7, Number((process.argv[2] ?? '60').trim()) || 60)
const VERIFY_ORDER = '59564845443' // J16 — expected п/п №92735 → paid

async function verify() {
  return db
    .select({
      order_id_external: yandexSettlementTransactions.order_id_external,
      entry_type: yandexSettlementTransactions.entry_type,
      status_note: yandexSettlementTransactions.status_note,
      payment_order_number: yandexSettlementTransactions.payment_order_number,
      payment_order_date: yandexSettlementTransactions.payment_order_date,
    })
    .from(yandexSettlementTransactions)
    .where(eq(yandexSettlementTransactions.order_id_external, VERIFY_ORDER))
}

async function main() {
  const ymShops = await db
    .select({ id: shops.id, name: shops.name, enc: shops.api_key_encrypted, campaignId: shops.shop_id_external })
    .from(shops)
    .where(and(eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))
  if (ymShops.length === 0) { console.error('No active Yandex shop found.'); process.exit(1) }

  console.log(`Backfilling ${ymShops.length} Yandex shop(s) with a ${windowDays}-day window…\n`)
  for (const shop of ymShops) {
    if (!shop.enc || !shop.campaignId) { console.log(`- ${shop.name ?? shop.id}: missing token/campaignId, skipping`); continue }
    const res = await syncYandexSettlements(shop.id, decrypt(shop.enc), shop.campaignId, windowDays)
    console.log(`- ${shop.name ?? shop.id}: ${JSON.stringify({ ok: res.ok, inserted: res.inserted, skipped: (res as { skipped?: string }).skipped, error: (res as { error?: string }).error })}`)
  }

  console.log(`\nVerify order ${VERIFY_ORDER} (expect payment_order_number = 92735):`)
  console.log(JSON.stringify(await verify(), null, 2))
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
