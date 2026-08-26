#!/usr/bin/env -S node --import tsx
/**
 * Fill products.variant_color where it is NULL, from evidence already in the DB.
 *
 * READ-ONLY. Prints what it would set and exits; --sql prints the statements for
 * review, unrun.
 *
 *   npm run backfill:variant-color              # what it would fill, and why
 *   npm run backfill:variant-color -- --all     # every row, not just a sample
 *   npm run backfill:variant-color -- --sql     # + the UPDATE statements, unrun
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Colour drives two things: which product an order line links to
 * (lib/uzum/variant-match.ts) and whether the mislink audit can see a bad link
 * at all. The audit compares order_items.variant_color against
 * products.variant_color and skips the row when either side is NULL — an
 * uncoloured product is not a variant, and reporting those would bury the real
 * mislinks in noise.
 *
 * That is correct behaviour and a blind spot at the same time. Products created
 * by the order-stub paths were written with variant_color NULL, so a mislink
 * involving one of them is invisible: the audit prints 0 and means "no evidence"
 * rather than "no mislinks". The sync now derives the colour for new stubs; this
 * fills in the ones already stored.
 *
 * ── Evidence, and when it is refused ────────────────────────────────────────
 *  1. The product TITLE, through resolveColor — the same function the catalogue
 *     path uses. Strongest: it is the product's own data.
 *  2. The colour of the order lines linked to it, but ONLY when every non-null
 *     line agrees. A split vote is not weak evidence, it is the signature of a
 *     mislink, and guessing there would carve the wrong answer into the column
 *     the matcher trusts.
 *
 * When both exist and disagree, nothing is proposed: that product is reported as
 * a conflict for the mislink audit to settle first. Line evidence is also
 * refused when it would give the product the same colour as a sibling sharing
 * its title — two same-colour siblings is the one state pickByColor cannot
 * resolve, so writing it would orphan future orders instead of linking them.
 */
import { basename } from 'node:path'
import { Client } from 'pg'
import { resolveColor } from '../lib/products/resolveColor'

interface Row {
  id: string
  shop_id: string
  marketplace: string | null
  sku: string | null
  title: string | null
  /** Colours of the order lines linked to this product, non-null only. */
  line_colors: string[]
  /** How many products in this shop share this title (self included). */
  title_siblings: number
  /** Colours already taken by same-title siblings. */
  sibling_colors: string[]
}

const SQL = `
WITH uncolored AS (
  SELECT p.id, p.shop_id, p.sku, p.title, s.marketplace
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  WHERE p.variant_color IS NULL
)
SELECT
  u.id, u.shop_id, u.marketplace, u.sku, u.title,
  COALESCE((
    SELECT array_agg(DISTINCT oi.variant_color)
    FROM order_items oi
    WHERE oi.product_id = u.id AND oi.variant_color IS NOT NULL
  ), '{}') AS line_colors,
  (
    SELECT count(*) FROM products sib
    WHERE sib.shop_id = u.shop_id AND lower(btrim(sib.title)) = lower(btrim(u.title))
  ) AS title_siblings,
  COALESCE((
    SELECT array_agg(DISTINCT sib.variant_color)
    FROM products sib
    WHERE sib.shop_id = u.shop_id
      AND lower(btrim(sib.title)) = lower(btrim(u.title))
      AND sib.id <> u.id
      AND sib.variant_color IS NOT NULL
  ), '{}') AS sibling_colors
FROM uncolored u
ORDER BY u.marketplace, u.title
`

type Verdict =
  | { fill: string; source: 'title' | 'order lines' }
  | { fill: null; reason: string }

/** Pure: the whole decision, so it can be reasoned about without a database. */
export function decide(r: Row): Verdict {
  const fromTitle = resolveColor(r.title)?.key ?? null
  const lineColors = [...new Set(r.line_colors)]
  const fromLines = lineColors.length === 1 ? lineColors[0] : null

  if (fromTitle && fromLines && fromTitle !== fromLines) {
    return { fill: null, reason: `title says ${fromTitle}, its order lines say ${fromLines} — mislink, not a missing colour` }
  }
  if (fromTitle) return { fill: fromTitle, source: 'title' }
  if (lineColors.length > 1) {
    return { fill: null, reason: `order lines disagree (${lineColors.join(', ')}) — run the mislink audit first` }
  }
  if (!fromLines) return { fill: null, reason: 'no colour in the title and no coloured order line' }
  if (r.sibling_colors.includes(fromLines)) {
    return { fill: null, reason: `a product sharing this title is already ${fromLines} — two same-colour siblings cannot be told apart` }
  }
  return { fill: fromLines, source: 'order lines' }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2))
  if (args.has('--sql')) { /* still runs the read; --sql only adds output */ }

  const url = process.env.DATABASE_URL
  if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }

  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<Row>(SQL)
    if (rows.length === 0) {
      console.log('Every product already has a variant_color. Nothing to backfill.')
      return
    }

    const decided = rows.map(r => ({ r, v: decide(r) }))
    const fills = decided.filter((d): d is { r: Row; v: Extract<Verdict, { fill: string }> } => d.v.fill != null)
    const skips = decided.filter(d => d.v.fill == null)
    const conflicts = skips.filter(d => 'reason' in d.v && d.v.reason.includes('mislink'))

    console.log(`\nPRODUCTS WITH NO variant_color: ${rows.length}`)
    console.log(`  fillable from the title      : ${fills.filter(d => d.v.source === 'title').length}`)
    console.log(`  fillable from its order lines: ${fills.filter(d => d.v.source === 'order lines').length}`)
    console.log(`  left NULL                    : ${skips.length}`)
    console.log(`  of those, colour conflicts   : ${conflicts.length}  ← the mislink audit settles these, not this script\n`)

    const show = args.has('--all') ? fills : fills.slice(0, 25)
    if (show.length > 0) {
      console.log(`would fill (${args.has('--all') ? 'all' : 'first ' + show.length}):\n`)
      for (const { r, v } of show) {
        console.log(`  ${(r.marketplace ?? '?').padEnd(6)} ${(r.sku ?? '(no sku)').padEnd(14)} ${v.fill.padEnd(7)} ← ${v.source}   "${r.title ?? ''}"`)
      }
    }

    const showSkips = args.has('--all') ? skips : skips.slice(0, 15)
    if (showSkips.length > 0) {
      console.log(`\nleft NULL (${args.has('--all') ? 'all' : 'first ' + showSkips.length}):\n`)
      for (const { r, v } of showSkips) {
        console.log(`  ${(r.marketplace ?? '?').padEnd(6)} ${(r.sku ?? '(no sku)').padEnd(14)} "${r.title ?? ''}"\n      ${'reason' in v ? v.reason : ''}`)
      }
    }

    if (args.has('--sql') && fills.length > 0) {
      console.log('\n── Backfill statement. NOT RUN. ──\n')
      console.log('BEGIN;')
      for (const { r, v } of fills) {
        console.log(
          `UPDATE products SET variant_color = '${v.fill}' ` +
          `WHERE id = '${r.id}' AND variant_color IS NULL;` +
          `  -- ${r.sku ?? ''} ${v.source}`,
        )
      }
      console.log('COMMIT;')
      console.log(
        '\nThe IS NULL in the WHERE clause is the guard: this only ever fills a gap.' +
        '\nA colour a sync has since resolved from the product card is never overwritten.',
      )
    }

    console.log(
      '\nNothing was changed.' +
      (args.has('--sql') ? '' : ' Re-run with --sql for the statements.'),
    )
  } finally {
    await client.end()
  }
}

// `decide` is imported by the test, which must not open a database connection.
// Only the direct invocation runs.
const entry = basename(process.argv[1] ?? '').replace(/\.[cm]?[jt]s$/, '')
if (entry === 'backfill-variant-color') {
  main().catch(err => { console.error(err); process.exit(1) })
}
