// Applies idempotent SQL migrations during deploy (runs on the server via deploy.yml).
// Only files listed here are executed — every file must be safe to re-run
// (IF NOT EXISTS / DO $$ ... EXCEPTION guards).
import { readFileSync, existsSync } from 'node:fs'
import pg from 'pg'

const MIGRATIONS = [
  'supabase/migrations/021_product_links.sql',
  'supabase/migrations/022_notif_language.sql',
  'supabase/migrations/023_order_fulfillment_type.sql',
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

const url = loadDatabaseUrl()
if (!url) {
  console.error('apply-sql-migrations: DATABASE_URL not found, skipping')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  for (const file of MIGRATIONS) {
    const sql = readFileSync(file, 'utf8')
    await client.query(sql)
    console.log(`applied: ${file}`)
  }
} finally {
  await client.end()
}
