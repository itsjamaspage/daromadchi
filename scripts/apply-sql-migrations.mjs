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
  'migrations/migrations/037_shops_throttled_until.sql',
  'migrations/migrations/038_stock_sync_mode.sql',
  'migrations/migrations/039_stock_write_log.sql',
  'migrations/migrations/040_stock_sync_state.sql',
  'migrations/migrations/041_shops_stock_poll.sql',
  'migrations/migrations/042_order_cancel_log.sql',
  'migrations/migrations/043_suggested_product_groups.sql',
  'migrations/migrations/045_products_is_archived.sql',
  'migrations/migrations/046_products_variant_group_key.sql',
  'migrations/migrations/047_products_variant_color.sql',
  // 048_ads_spend_columns.sql intentionally NOT listed: it ALTERs
  // product_ads_stats, which 052 drops. Re-running it after the drop fails with
  // "relation product_ads_stats does not exist". The table and its ad-spend
  // feature were removed, so this migration is obsolete.
  'migrations/migrations/049_stock_update_notif_prefs.sql',
  'migrations/migrations/050_stock_notify_state.sql',
  'migrations/migrations/051_shops_yandex_boost_disabled.sql',
  'migrations/migrations/052_drop_product_ads_stats.sql',
  'migrations/migrations/053_order_items_product_snapshot.sql',
  'migrations/migrations/054_orders_marketplace_status.sql',
  // 055 was applied manually on prod but never registered here — a fresh deploy
  // would have missed it. It is idempotent (ADD COLUMN IF NOT EXISTS + a DO block
  // that drops/re-adds the payments.user_id FK by discovery), so re-running is a
  // no-op. Registered now so the repo is the source of truth.
  'migrations/migrations/055_privacy_retention.sql',
  'migrations/migrations/056_payments_payer_email.sql',
  // High-stakes: rebuilds the marketplace_type enum to drop 'wildberries'.
  // Idempotent (guarded on the value still existing) + atomic. Take a DB backup
  // before the first apply. See the file header.
  'migrations/migrations/057_drop_wildberries_enum.sql',
  // Records signup consent (Privacy/Terms/Cookies) for ZRU-547. Additive +
  // idempotent (ADD COLUMN IF NOT EXISTS).
  'migrations/migrations/058_users_consented_at.sql',
  // Mirror-always: migrate lock_last_unit groups -> 'off' and flip the column
  // default. Idempotent (UPDATE by value + ALTER SET DEFAULT).
  'migrations/migrations/059_oversell_mode_off_default.sql',
  // Adds last_available to the stock-notify dedup fingerprint (collapses the
  // webhook+cron duplicate digest; restock line rides dedup). Additive +
  // idempotent (ADD COLUMN IF NOT EXISTS).
  'migrations/migrations/060_stock_notify_last_available.sql',
  // Decouples the digest from reconcile writes: tracks seen reserving orders per
  // group so a notification fires on a NEW order, not on every stock correction.
  // Additive + idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
  'migrations/migrations/061_stock_notify_order_seen.sql',
  // Dedup for the oversell alert: one alert per distinct oversell (new later
  // order / deeper count), not one per 5-min reconcile cycle. Additive +
  // idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
  'migrations/migrations/062_oversell_notify_state.sql',
  // Guards products.physical_stock (the shared-pool source) — 005 created it but
  // isn't registered, so a fresh deploy would miss it. Idempotent (ADD COLUMN IF
  // NOT EXISTS).
  'migrations/migrations/063_products_physical_stock_guard.sql',
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
