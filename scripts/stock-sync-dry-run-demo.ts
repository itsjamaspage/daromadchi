/**
 * Dry-run log demo for the worked example: SKU JMJ16BEG on Uzum + Yandex Market.
 * Exercises the SAME pure planner (lib/marketplace/stock-allocation) the
 * orchestrator uses, and prints the exact request bodies the writer would log
 * in dry-run — sending nothing. No DB, no network.
 *
 * Run: npm run stock-sync:demo
 */
import { planStockWrites, type SyncMember, type OversellMode } from '@/lib/marketplace/stock-allocation'

const COMPUTED_AT = '2026-08-02T10:00:00.000Z' // moment of computation (stable across retries)
let VERSION = 0

function uzumBody(barcode: string, amount: number): string {
  return JSON.stringify({ skuAmountList: [{ barcode, amount, fbsLinked: true }] })
}
function ymBody(sku: string, warehouseId: number, count: number): string {
  return JSON.stringify({ skus: [{ sku, warehouseId, items: [{ count, type: 'FIT', updatedAt: COMPUTED_AT }] }] })
}

interface DemoMember extends SyncMember {
  barcode?: string
  marketSku?: string
  warehouseId?: number
  dryRun: boolean
}

function run(title: string, members: DemoMember[], mode: OversellMode) {
  console.log(`\n━━━ ${title}  (oversell_mode=${mode}) ━━━`)
  const { available, plans } = planStockWrites(members, mode)
  console.log(`Step A — available = max(0, MAX(stock) − SUM(pending)) = ${available}   [display updated]`)

  const writes = plans.filter(p => p.willWrite)
  if (writes.length === 0) {
    console.log('Step B — 0 store writes (read-only members, or no real diff). Nothing sent.')
    return
  }
  for (const p of writes) {
    const m = members.find(x => x.shopId === p.member.shopId)!
    VERSION += 1
    const isUzum = m.marketplace === 'uzum'
    const method = isUzum ? 'POST' : 'PUT'
    const endpoint = isUzum
      ? 'https://api-seller.uzum.uz/api/seller-openapi/v2/fbs/sku/stocks'
      : 'https://api.partner.market.yandex.ru/v2/campaigns/149137909/offers/stocks'
    const body = isUzum
      ? uzumBody(m.barcode ?? '(missing)', p.target)
      : ymBody(m.marketSku ?? '(missing)', m.warehouseId ?? 0, p.target)
    console.log(
      `Step B — [DRY-RUN] ${m.marketplace} listed=${p.member.listedStock} → target=${p.target} ` +
      `(v${VERSION}, dry_run=${m.dryRun})\n` +
      `           WOULD ${method} ${endpoint}\n` +
      `           body ${body}\n` +
      `           → logged to stock_write_log as status=dry_run. Nothing sent.`,
    )
  }
}

// Base members for JMJ16BEG: one Uzum sale is modelled as pending=1 on Uzum.
function uzum(over: Partial<DemoMember> = {}): DemoMember {
  return { productId: 'uz-p', shopId: 'uzum-shop', marketplace: 'uzum', apiMode: 'stock_sync', priority: 0,
    listedStock: 1, pending: 1, sku: 'JMJ16BEG', barcode: '4780012345678', dryRun: true, ...over }
}
function ym(over: Partial<DemoMember> = {}): DemoMember {
  return { productId: 'ym-p', shopId: 'ym-shop', marketplace: 'yandex_market', apiMode: 'stock_sync', priority: 100,
    listedStock: 1, pending: 0, sku: 'JMJ16BEG', marketSku: 'JMJ16BEG', warehouseId: 987654, dryRun: true, ...over }
}

console.log('DRY-RUN LOG — SKU JMJ16BEG, Uzum(1) + Yandex Market(1), one Uzum sale')
console.log(`computedAt = ${COMPUTED_AT} (stamped as YM updatedAt; stable across retries)`)

// 1. Read-only shops → Step A only, no writes.
run('READ-ONLY shops', [uzum({ apiMode: 'read_only' }), ym({ apiMode: 'read_only' })], 'lock_last_unit')

// 2. Stock-sync, dry-run → available 0 → push 0 to BOTH (two would-be writes).
run('STOCK-SYNC dry-run (available → 0)', [uzum(), ym()], 'lock_last_unit')

// 3. available == 1 → primary (Uzum) keeps 1, the other goes to 0.
run('STOCK-SYNC dry-run (available → 1)',
  [uzum({ listedStock: 2, pending: 1 }), ym({ listedStock: 2, pending: 0 })], 'lock_last_unit')

console.log('\nAll writes above are simulated. Live writes happen only after dry-run is turned off per shop.')
