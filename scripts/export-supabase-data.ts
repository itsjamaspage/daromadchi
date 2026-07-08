import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const TABLES_IN_ORDER = [
  'users',
  'warehouses',
  'shops',
  'products',
  'orders',
  'order_items',
  'payments',
  'user_settings',
  'alerts',
  'ad_campaigns',
  'product_ads_stats',
  'search_phrases',
  'unit_economics_items',
  'sync_logs',
  'sync_days',
  'bot_sessions',
  'channel_nonces',
  'competitor_watchlist',
]

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) {
    const inner = val.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(',')
    return `'{${inner}}'`
  }
  const str = String(val).replace(/'/g, "''")
  return `'${str}'`
}

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  const PAGE = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error(`  Error fetching ${table}: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }

  return rows
}

function buildInserts(table: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- ${table}: 0 rows\n`

  const cols = Object.keys(rows[0])
  const colList = cols.map(c => `"${c}"`).join(', ')
  const lines: string[] = [`-- ${table}: ${rows.length} rows`]

  for (const row of rows) {
    const vals = cols.map(c => escapeValue(row[c])).join(', ')
    lines.push(`INSERT INTO "${table}" (${colList}) VALUES (${vals});`)
  }

  return lines.join('\n') + '\n'
}

async function main() {
  console.log('Exporting Supabase data...\n')

  const parts: string[] = [
    '-- Supabase data export',
    `-- Generated: ${new Date().toISOString()}`,
    '-- Import order respects foreign key dependencies\n',
    'BEGIN;\n',
  ]

  for (const table of TABLES_IN_ORDER) {
    process.stdout.write(`  ${table}...`)
    const rows = await fetchAll(table)
    console.log(` ${rows.length} rows`)
    parts.push(buildInserts(table, rows))
  }

  parts.push('\nCOMMIT;\n')

  const outPath = resolve(__dirname, 'supabase-export.sql')
  writeFileSync(outPath, parts.join('\n'), 'utf-8')
  console.log(`\nWritten to ${outPath}`)
}

main().catch(err => {
  console.error('Export failed:', err)
  process.exit(1)
})
