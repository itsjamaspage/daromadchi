/**
 * One-time live verification for the Uzum settlement stale-status fix.
 *
 * Runs the (now fixed) syncUzumSettlements — which always pulls the undated
 * recent pass — and prints a target order's stored status BEFORE and AFTER, so
 * you can confirm a late-flipped order (e.g. 117751391: PROCESSING → TO_WITHDRAW)
 * actually refreshes.
 *
 * Run on the VPS after checking out this branch (needs DATABASE_URL +
 * ENCRYPTION_KEY + a real Uzum token + outbound):
 *   set -a; . ./.env; set +a
 *   ./node_modules/.bin/tsx scripts/verify-uzum-settlement-refresh.ts            # defaults to 117751391
 *   ./node_modules/.bin/tsx scripts/verify-uzum-settlement-refresh.ts 121172241  # any order id
 *
 * This DOES upsert our own uzum_settlement_orders cache (that's the refresh) —
 * it is NOT a marketplace write (no POST/PUT to Uzum; read + local upsert only).
 */
import { and, eq } from 'drizzle-orm'
import { db, shops, uzumSettlementOrders } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { syncUzumSettlements } from '@/lib/uzum/settlements-sync'

const orderId = Number((process.argv[2] ?? '117751391').trim())

async function snapshot() {
  return db
    .select({
      status: uzumSettlementOrders.status,
      synced_at: uzumSettlementOrders.synced_at,
      transaction_at: uzumSettlementOrders.transaction_at,
      seller_price: uzumSettlementOrders.seller_price,
      withdrawn_profit: uzumSettlementOrders.withdrawn_profit,
    })
    .from(uzumSettlementOrders)
    .where(eq(uzumSettlementOrders.uzum_order_id, orderId))
}

async function main() {
  const [shop] = await db
    .select({ id: shops.id, name: shops.name, enc: shops.api_key_encrypted })
    .from(shops)
    .where(and(eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))
  if (!shop?.enc) { console.error('No active Uzum shop with a token found.'); process.exit(1) }

  console.log(`Order ${orderId} — shop: ${shop.name ?? shop.id}`)
  console.log('BEFORE:', JSON.stringify(await snapshot()))

  const res = await syncUzumSettlements(shop.id, decrypt(shop.enc))
  console.log('sync result:', JSON.stringify({ ok: res.ok, inserted: res.inserted, skipped: (res as { skipped?: string }).skipped, error: (res as { error?: string }).error }))

  console.log('AFTER: ', JSON.stringify(await snapshot()))
  console.log('\n→ Expect status to flip PROCESSING → TO_WITHDRAW if the order is now withdrawable on Uzum.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
