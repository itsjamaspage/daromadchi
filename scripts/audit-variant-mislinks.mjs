#!/usr/bin/env node
/**
 * Find order_items linked to the WRONG colour variant.
 *
 * READ-ONLY. Prints what it finds and exits. It never updates a row — the whole
 * point of this audit is that a wrong link already corrupted reservations,
 * shared stock, P&L and sales attribution once, silently. A blind corrective
 * UPDATE would be the same mistake with the opposite sign.
 *
 *   node scripts/audit-variant-mislinks.mjs            # summary + sample rows
 *   node scripts/audit-variant-mislinks.mjs --all      # every affected row
 *   node scripts/audit-variant-mislinks.mjs --sql      # print the SQL and exit
 *
 * A row is a mislink when the order line's own colour (order_items.variant_color,
 * snapshotted from the marketplace payload at sync time) contradicts the colour
 * of the product it points at. Both sides are already stored, so this needs no
 * marketplace call and cannot be wrong about what the seller actually sold.
 *
 * Rows where either side has no colour are NOT reported: an uncoloured product
 * is not a variant, and an uncoloured line carries no evidence either way.
 * Reporting those would bury the real mislinks in noise.
 */
import { Client } from 'pg'

const DETECT_SQL = `
SELECT
  o.order_id_external,
  o.marketplace_status,
  o.status,
  o.ordered_at,
  oi.id            AS order_item_id,
  oi.sku           AS item_sku,
  oi.variant_color AS item_color,
  oi.quantity,
  p.id             AS linked_product_id,
  p.sku            AS linked_product_sku,
  p.variant_color  AS linked_product_color,
  correct.id       AS correct_product_id,
  correct.sku      AS correct_product_sku
FROM order_items oi
JOIN orders   o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
-- The variant on the SAME shop whose colour matches the line. Exactly one, or
-- the row is reported with a NULL suggestion rather than a guess.
LEFT JOIN LATERAL (
  SELECT c.id, c.sku
  FROM products c
  WHERE c.shop_id = p.shop_id
    AND c.variant_color = oi.variant_color
    AND c.id <> p.id
  LIMIT 2
) correct ON true
WHERE o.marketplace = 'uzum'
  AND oi.variant_color IS NOT NULL
  AND p.variant_color  IS NOT NULL
  AND oi.variant_color <> p.variant_color
ORDER BY o.ordered_at DESC
`

const args = new Set(process.argv.slice(2))
if (args.has('--sql')) { console.log(DETECT_SQL); process.exit(0) }

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }

const client = new Client({ connectionString: url })
await client.connect()
try {
  const { rows } = await client.query(DETECT_SQL)
  if (rows.length === 0) {
    console.log('No cross-variant mislinks found.')
    process.exit(0)
  }

  console.log(`\nMISLINKED ORDER ITEMS: ${rows.length}\n`)

  // Which variant pairs are affected, and how badly.
  const byPair = new Map()
  for (const r of rows) {
    const k = `${r.item_color} → ${r.linked_product_sku} (${r.linked_product_color})`
    const e = byPair.get(k) ?? { rows: 0, units: 0 }
    e.rows++; e.units += Number(r.quantity ?? 0)
    byPair.set(k, e)
  }
  console.log('by variant pair:')
  for (const [k, v] of [...byPair].sort((a, b) => b[1].rows - a[1].rows)) {
    console.log(`  ${String(v.rows).padStart(4)} rows / ${String(v.units).padStart(4)} units   ${k}`)
  }

  const unresolvable = rows.filter(r => !r.correct_product_id)
  if (unresolvable.length > 0) {
    console.log(`\n${unresolvable.length} row(s) have NO unambiguous correct variant — these need a human, not a script.`)
  }

  const show = args.has('--all') ? rows : rows.slice(0, 20)
  console.log(`\n${args.has('--all') ? 'all' : 'first ' + show.length} affected rows:\n`)
  for (const r of show) {
    console.log(
      `  order ${r.order_id_external} (${r.marketplace_status ?? r.status})  ` +
      `item "${r.item_sku}" [${r.item_color}] ×${r.quantity}\n` +
      `      linked to  ${r.linked_product_sku} [${r.linked_product_color}]   ` +
      `should be  ${r.correct_product_sku ?? '??? (ambiguous — review by hand)'}`,
    )
  }

  console.log(
    '\nNothing was changed. Review the rows above, then re-link with a reviewed,' +
    '\nexplicitly-scoped UPDATE — and re-run this audit afterwards to confirm 0.',
  )
} finally {
  await client.end()
}
