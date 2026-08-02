/**
 * ONE-SKU LIVE VERIFICATION — run this in the real environment (real DATABASE_URL
 * + a real seller token with SKU_UPDATE + outbound access). It deliberately flips
 * exactly ONE shop to live, writes ONE hand-picked SKU, reads it back from the
 * store to confirm observed === target, then restores that SKU to its correct
 * real stock and read-back-verifies that too — and by default returns the shop
 * to dry-run afterwards. It never moves other shops or SKUs to live.
 *
 * Usage:
 *   tsx scripts/stock-sync-live-verify.ts --product <uuid> --restore <int> [--keep-live]
 *
 * Prereqs (the three gates): the shop is api_mode=stock_sync and the product's
 * write identifier (Uzum market_barcode / YM market_sku + market_warehouse_id)
 * is already populated by the backfill. This script refuses to guess.
 */
import { eq } from 'drizzle-orm'
import { db, shops, products } from '@/lib/db'
import { firstLivePush, verifiedLivePush } from '@/lib/marketplace/stock-sync'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const productId = arg('product')
const restoreRaw = arg('restore')
const keepLive = process.argv.includes('--keep-live')

if (!productId) {
  console.error('Missing --product <uuid>. Usage: --product <uuid> --restore <int> [--keep-live]')
  process.exit(1)
}
const restoreQty = restoreRaw != null ? Number(restoreRaw) : null
if (restoreRaw != null && !Number.isFinite(restoreQty)) {
  console.error(`--restore must be an integer, got "${restoreRaw}"`)
  process.exit(1)
}

async function main() {
  const [prod] = await db.select({ id: products.id, shop_id: products.shop_id, sku: products.sku })
    .from(products).where(eq(products.id, productId!))
  if (!prod) { console.error(`Product ${productId} not found`); process.exit(1) }

  const [shop] = await db.select({
    id: shops.id, user_id: shops.user_id, name: shops.name, marketplace: shops.marketplace,
    api_mode: shops.api_mode, stock_sync_dry_run: shops.stock_sync_dry_run,
  }).from(shops).where(eq(shops.id, prod.shop_id))
  if (!shop) { console.error('Shop not found'); process.exit(1) }

  if (shop.api_mode !== 'stock_sync') {
    console.error(`Shop ${shop.id} is ${shop.api_mode}, not stock_sync. Opt it in first.`); process.exit(1)
  }

  console.log(`Target SKU:   ${prod.sku ?? '(no sku)'}  (product ${prod.id})`)
  console.log(`Shop:         ${shop.name} [${shop.marketplace}] ${shop.id}`)
  console.log(`Prior dry_run: ${shop.stock_sync_dry_run}`)

  // ── The deliberate, single flip: this ONE shop to live. ──
  const wasDryRun = shop.stock_sync_dry_run
  if (wasDryRun) {
    await db.update(shops).set({ stock_sync_dry_run: false }).where(eq(shops.id, shop.id))
    console.log(`\n>>> FLIPPED shop ${shop.id} to LIVE (stock_sync_dry_run=false). No other shop touched.`)
  }

  try {
    // 1. First live write at the planned target + read-back.
    const first = await firstLivePush(shop.user_id, prod.id)
    console.log(`\n[1] first live push → status=${first.status} target=${first.target} observed=${first.observed} verified=${first.verified}${first.reason ? ` reason=${first.reason}` : ''}`)
    if (!first.verified) {
      console.log('    ⚠️ observed !== target on a 200 → investigate (wrong identifier, or YM stale-updatedAt drop). NOT proceeding to restore.')
      return
    }

    // 2. Restore to the correct real stock + read-back.
    if (restoreQty != null) {
      const restore = await verifiedLivePush(shop.user_id, prod.id, restoreQty)
      console.log(`[2] restore push   → status=${restore.status} target=${restore.target} observed=${restore.observed} verified=${restore.verified}${restore.reason ? ` reason=${restore.reason}` : ''}`)
    } else {
      console.log('[2] restore skipped (no --restore given).')
    }
  } finally {
    if (wasDryRun && !keepLive) {
      await db.update(shops).set({ stock_sync_dry_run: true }).where(eq(shops.id, shop.id))
      console.log(`\n>>> Restored shop ${shop.id} to dry-run (test mode). Pass --keep-live to leave it live.`)
    } else if (keepLive) {
      console.log(`\n>>> Shop ${shop.id} LEFT LIVE (--keep-live).`)
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
