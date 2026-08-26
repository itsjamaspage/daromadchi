#!/usr/bin/env -S node --import tsx
/**
 * Find order_items linked to the WRONG colour variant, and name the ONE product
 * each should point at instead.
 *
 * READ-ONLY. Prints what it finds and exits. It never updates a row — the whole
 * point of this audit is that a wrong link already corrupted reservations,
 * shared stock, P&L and sales attribution once, silently. A blind corrective
 * UPDATE would be the same mistake with the opposite sign. With --fix-sql it
 * prints the statement for review; running it is a human decision.
 *
 *   npm run audit:variant-mislinks              # summary + affected rows
 *   npm run audit:variant-mislinks -- --all     # every affected row
 *   npm run audit:variant-mislinks -- --fix-sql # + the re-link UPDATE, unrun
 *
 * A row is a mislink when the order line's own colour (order_items.variant_color,
 * snapshotted from the marketplace payload at sync time) contradicts the colour
 * of the product it points at. Both sides are already stored, so this needs no
 * marketplace call and cannot be wrong about what the seller actually sold.
 *
 * Rows where either side has no colour are NOT reported: an uncoloured product
 * is not a variant, and an uncoloured line carries no evidence either way.
 * Reporting those would bury the real mislinks in noise.
 *
 * ── Why this file is TypeScript and not the .mjs it started as ───────────────
 * The first version resolved the "should be" column in SQL, by colour alone:
 *
 *     WHERE c.shop_id = p.shop_id AND c.variant_color = oi.variant_color
 *
 * — every product in the shop of that colour. For a black watch that returned
 * the black watch AND a black powerbank, so the audit reported two rows per
 * item and named a different product in each. An UPDATE driven by that column
 * would have linked a watch order to a powerbank: new corruption, worse than
 * the old one, and invisible in the same way.
 *
 * The sync never had that bug — it looks candidates up by IDENTITY (marketplace
 * variant id, seller article, barcode, title) and only then breaks the tie by
 * colour, so a powerbank is never in the running. The audit now imports that
 * exact code (buildVariantIndex / resolveVariant), which is the only way its
 * "should be" column can mean the same thing as what the next sync will do.
 */
import { Client } from 'pg'
import { buildVariantIndex, resolveVariant, type IndexedProduct } from '../lib/uzum/variant-match'

interface MislinkRow {
  order_id_external: string
  marketplace_status: string | null
  status: string | null
  ordered_at: Date | null
  order_item_id: string
  item_sku: string | null
  item_title: string | null
  item_color: string | null
  quantity: number | null
  shop_id: string
  linked_product_id: string
  linked_product_sku: string | null
  linked_product_title: string | null
  linked_product_color: string | null
}

/** The mislinks themselves. No suggestion column — that is resolved in JS. */
const DETECT_SQL = `
SELECT
  o.order_id_external,
  o.marketplace_status,
  o.status,
  o.ordered_at,
  oi.id            AS order_item_id,
  oi.sku           AS item_sku,
  oi.title         AS item_title,
  oi.variant_color AS item_color,
  oi.quantity,
  p.shop_id,
  p.id             AS linked_product_id,
  p.sku            AS linked_product_sku,
  p.title          AS linked_product_title,
  p.variant_color  AS linked_product_color
FROM order_items oi
JOIN orders   o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE o.marketplace = 'uzum'
  AND oi.variant_color IS NOT NULL
  AND p.variant_color  IS NOT NULL
  AND oi.variant_color <> p.variant_color
ORDER BY o.ordered_at DESC
`

/** Every product of the shops that have a mislink — the resolver's search space. */
const PRODUCTS_SQL = `
SELECT id, shop_id, sku, title, market_barcode, marketplace_product_id, variant_color
FROM products
WHERE shop_id = ANY($1::uuid[])
`

// The package is CommonJS, so no top-level await: one async main() instead.
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2))
  if (args.has('--sql')) { console.log(DETECT_SQL); process.exit(0) }

  const url = process.env.DATABASE_URL
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }

  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<MislinkRow>(DETECT_SQL)
    if (rows.length === 0) {
      console.log('No cross-variant mislinks found.')
      process.exit(0)
    }

    // One index per shop, built from the same fields and rules the sync uses.
    interface ProductRow {
      id: string
      shop_id: string
      sku: string | null
      title: string | null
      market_barcode: string | null
      marketplace_product_id: string | null
      variant_color: string | null
    }
    const shopIds = [...new Set(rows.map(r => r.shop_id))]
    const prods = await client.query<ProductRow>(PRODUCTS_SQL, [shopIds])
    const byShop = new Map<string, IndexedProduct[]>()
    const productById = new Map<string, ProductRow>()
    for (const r of prods.rows) {
      const p: IndexedProduct = {
        id: r.id,
        sku: r.sku,
        title: r.title,
        barcode: r.market_barcode,
        marketplaceProductId: r.marketplace_product_id,
        color: r.variant_color,
      }
      const arr = byShop.get(r.shop_id)
      if (arr) arr.push(p); else byShop.set(r.shop_id, [p])
      productById.set(r.id, r)
    }
    const indexByShop = new Map(
      [...byShop].map(([shopId, list]) => [shopId, buildVariantIndex(list)] as const),
    )

    // Resolve each mislinked line to at most ONE product — the same answer the
    // next sync will reach, because it is the same function.
    //
    // The line's own keys come first. `linked_product_title` is the last resort
    // and it is not a guess: the sync's title step is exactly how this line landed
    // on the wrong variant, so the sibling that shares that title is the family
    // the right variant lives in. Colour still has to pick within it, and only
    // within it — a powerbank shares no title with a watch.
    const resolved = rows.map(r => {
      const index = indexByShop.get(r.shop_id)!
      const target = resolveVariant(index, {
        skus: [r.item_sku],
        title: r.item_title ?? r.linked_product_title,
        color: r.item_color,
      })
      const p = target ? productById.get(target) : undefined
      return {
        ...r,
        correct_product_id: target && target !== r.linked_product_id ? target : null,
        correct_product_sku: target && target !== r.linked_product_id ? (p?.sku ?? '(no sku)') : null,
        // Resolving back to the product it is already linked to means the stored
        // colours disagree for some other reason (a stale products.variant_color,
        // usually) — a data question, not a re-link.
        self_resolved: target != null && target === r.linked_product_id,
      }
    })

    const cancelled = resolved.filter(r => isCancelled(r.status, r.marketplace_status))
    const fixable = resolved.filter(r => r.correct_product_id)
    const unresolvable = resolved.filter(r => !r.correct_product_id && !r.self_resolved)
    const selfResolved = resolved.filter(r => r.self_resolved)

    console.log(`\nMISLINKED ORDER ITEMS: ${resolved.length}  (one row per item, never per candidate)`)
    console.log(`  re-linkable to a single product : ${fixable.length}`)
    console.log(`  ambiguous — need a human        : ${unresolvable.length}`)
    console.log(`  resolve back to the same product: ${selfResolved.length}`)
    console.log(`  on CANCELLED orders             : ${cancelled.length}  (no reservation effect; still counts for P&L attribution)\n`)

    const byPair = new Map<string, { rows: number; units: number }>()
    for (const r of resolved) {
      const k = `${r.item_color} line → linked ${r.linked_product_sku} (${r.linked_product_color})  ⇒  ${r.correct_product_sku ?? 'unresolved'}`
      const e = byPair.get(k) ?? { rows: 0, units: 0 }
      e.rows++; e.units += Number(r.quantity ?? 0)
      byPair.set(k, e)
    }
    console.log('by variant pair:')
    for (const [k, v] of [...byPair].sort((a, b) => b[1].rows - a[1].rows)) {
      console.log(`  ${String(v.rows).padStart(4)} rows / ${String(v.units).padStart(4)} units   ${k}`)
    }

    const show = args.has('--all') ? resolved : resolved.slice(0, 20)
    console.log(`\n${args.has('--all') ? 'all' : 'first ' + show.length} affected rows:\n`)
    for (const r of show) {
      const flag = isCancelled(r.status, r.marketplace_status) ? '  [CANCELLED]' : ''
      console.log(
        `  order ${r.order_id_external} (${r.marketplace_status ?? r.status})${flag}  ` +
        `item "${r.item_sku}" [${r.item_color}] ×${r.quantity}\n` +
        `      linked to  ${r.linked_product_sku} [${r.linked_product_color}]   ` +
        `should be  ${r.correct_product_sku ?? (r.self_resolved ? '(same product — check products.variant_color)' : '??? (ambiguous — review by hand)')}`,
      )
    }

    if (args.has('--fix-sql') && fixable.length > 0) {
      console.log('\n── Re-link statement. NOT RUN. Read every row above first. ──\n')
      console.log('BEGIN;')
      for (const r of fixable) {
        console.log(
          `UPDATE order_items SET product_id = '${r.correct_product_id}' ` +
          `WHERE id = '${r.order_item_id}' AND product_id = '${r.linked_product_id}';` +
          `  -- ${r.order_id_external}  ${r.item_sku} [${r.item_color}] → ${r.correct_product_sku}`,
        )
      }
      console.log('COMMIT;')
      console.log(
        '\nThe product_id in the WHERE clause is the guard: if a sync re-linked the row' +
        '\nin the meantime, the statement updates nothing instead of overwriting a newer' +
        '\nanswer. Re-run this audit afterwards; it should print 0.',
      )
    }

    console.log(
      '\nNothing was changed.' +
      (args.has('--fix-sql') ? '' : ' Re-run with --fix-sql for the reviewed re-link statement.'),
    )
  } finally {
    await client.end()
  }
}

function isCancelled(status: string | null, marketplaceStatus: string | null): boolean {
  return `${status ?? ''} ${marketplaceStatus ?? ''}`.toUpperCase().includes('CANCEL')
}

main().catch(err => { console.error(err); process.exit(1) })
