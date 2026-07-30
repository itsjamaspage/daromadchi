// Applies idempotent SQL migrations during deploy (runs on the server via deploy.yml).
// Only files listed here are executed — every file must be safe to re-run
// (IF NOT EXISTS / DO $$ ... EXCEPTION guards).
import { readFileSync, existsSync } from 'node:fs'
import pg from 'pg'

const MIGRATIONS = [
  'migrations/migrations/021_product_links.sql',
  'migrations/migrations/022_notif_language.sql',
  'migrations/migrations/023_order_fulfillment_type.sql',
  'migrations/migrations/024_product_quantity_sold.sql',
  'migrations/migrations/025_notif_new_orders_default_on.sql',
  'migrations/migrations/026_unit_econ_landed_cost.sql',
  'migrations/migrations/027_product_group_merges.sql',
  'migrations/migrations/028_product_fulfillment_type.sql',
  'migrations/migrations/029_order_wb_fees.sql',
  'migrations/migrations/030_shops_business_id.sql',
  'migrations/migrations/031_category_canonical.sql',
  'migrations/migrations/032_category_slug.sql',
  'migrations/migrations/033_suggested_aliases.sql',
  'migrations/migrations/034_password_reset_tokens.sql',
  'migrations/migrations/035_yandex_settlements.sql',
  'migrations/migrations/036_uzum_settlements.sql',
]

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  for (const f of ['.env.production.local', '.env.local', '.env', '.env.production']) {
    if (!existsSync(f)) continue
    const m = readFileSync(f, 'utf8').match(/^DATABASE_URL=(.*)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}

// Set APPLY_SQL_MIGRATIONS_ALLOW_SKIP=1 to keep the previous "print a warning
// and exit 0" behaviour — useful for local dev where DATABASE_URL is expected
// to be missing sometimes. On the VPS deploy pipeline this must stay unset so
// a missing DATABASE_URL fails loud instead of silently marking the deploy as
// successful while the DB stays untouched.
const url = loadDatabaseUrl()
if (!url) {
  const msg = 'apply-sql-migrations: DATABASE_URL not found in env or .env files'
  if (process.env.APPLY_SQL_MIGRATIONS_ALLOW_SKIP === '1') {
    console.warn(`${msg} — skipping (APPLY_SQL_MIGRATIONS_ALLOW_SKIP=1)`)
    process.exit(0)
  }
  console.error(`${msg} — refusing to silently skip. Set APPLY_SQL_MIGRATIONS_ALLOW_SKIP=1 to opt out.`)
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
} catch (err) {
  console.error(`apply-sql-migrations: failed to connect to database — ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}

let failed = false
try {
  for (const file of MIGRATIONS) {
    let sql
    try {
      sql = readFileSync(file, 'utf8')
    } catch (err) {
      console.error(`apply-sql-migrations: cannot read ${file} — ${err instanceof Error ? err.message : String(err)}`)
      failed = true
      break
    }
    try {
      await client.query(sql)
      console.log(`applied: ${file}`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`apply-sql-migrations: ${file} failed — ${detail}`)
      failed = true
      break
    }
  }
} finally {
  await client.end().catch(() => {})
}

if (failed) process.exit(1)
