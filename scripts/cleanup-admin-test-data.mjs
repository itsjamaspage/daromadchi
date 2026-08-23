/**
 * One-off cleanup: remove the two NON-REAL payment rows from the DB so the admin
 * dashboard reflects reality (0 external customers → 0 revenue).
 *
 * WHAT IT DELETES (payments only):
 *   1. Synthetic ATMOS-integration test rows  — payer_email = '[atmos:direct test]'
 *      (left behind by scripts/atmos-direct-test.mjs; user_id is NULL).
 *   2. The founder's own payments             — ADMIN_EMAIL, matched by linked
 *      user_id OR by payer_email (which survives account deletion).
 *
 * WHAT IT NEVER TOUCHES:
 *   - The users table  → the founder account and login stay fully intact.
 *   - The subscriptions table → the founder's test subscription row is KEPT; its
 *     contribution to metrics is removed in code (lib/db/admin-analytics.ts
 *     excludes ADMIN_EMAIL from every figure), not by deletion.
 *
 * SAFETY: dry-run by default. It PRINTS every payment + subscription row and
 * marks exactly what would be deleted. Nothing is removed until you re-run with
 * --confirm. `user_id IS NULL` alone is NOT treated as synthetic (a deleted real
 * customer also has a null user_id and their past revenue is genuine) — the test
 * row is matched by its exact payer_email marker.
 *
 * Usage (repo root, .env with DATABASE_URL loaded — run on the VPS):
 *   node scripts/cleanup-admin-test-data.mjs            # dry-run: show rows
 *   node scripts/cleanup-admin-test-data.mjs --confirm  # actually delete
 */

import { readFileSync, existsSync } from 'node:fs'
import pg from 'pg'

function loadEnv() {
  for (const f of ['.env.local', '.env', '.env.production.local', '.env.production']) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()

const TEST_PAYER_EMAIL = '[atmos:direct test]'
const CONFIRM = process.argv.includes('--confirm')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('✗ DATABASE_URL not set. Run on the VPS with the env loaded.'); process.exit(1) }

const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null
if (!adminEmail) console.warn('⚠  ADMIN_EMAIL not set — founder rows will NOT be identified; only the test row is targeted.\n')

const som = (tiyin, amount) => {
  const t = tiyin != null ? Number(tiyin) : Math.round(Number(amount) * 100)
  return new Intl.NumberFormat('ru-RU').format(Math.round(t / 100)) + " so'm"
}
const short = (id) => String(id).slice(0, 8) + '…'

const pool = new pg.Pool({ connectionString: DATABASE_URL })
try {
  // Resolve founder user ids from ADMIN_EMAIL (identity, not deletion).
  const adminIds = adminEmail
    ? (await pool.query('SELECT id FROM users WHERE lower(email) = $1', [adminEmail])).rows.map(r => r.id)
    : []

  const { rows: pays } = await pool.query(`
    SELECT p.id, p.user_id, p.payer_email, u.email AS user_email,
           p.amount, p.amount_tiyin, p.status, p.atmos_status, p.created_at
    FROM payments p LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC`)

  const classify = (p) => {
    if (p.payer_email === TEST_PAYER_EMAIL) return 'TEST'
    if (adminEmail && p.payer_email && p.payer_email.toLowerCase() === adminEmail) return 'FOUNDER'
    if (adminIds.includes(p.user_id)) return 'FOUNDER'
    return 'REAL'
  }

  console.log(`\n=== PAYMENTS (${pays.length}) ===`)
  const toDelete = []
  for (const p of pays) {
    const kind = classify(p)
    if (kind !== 'REAL') toDelete.push(p.id)
    const mark = kind === 'REAL' ? '  keep ' : '✗ DELETE'
    console.log(`${mark} [${kind.padEnd(7)}] ${short(p.id)}  ${som(p.amount_tiyin, p.amount).padStart(14)}  ${String(p.status).padEnd(9)} atmos=${String(p.atmos_status).padEnd(8)}  ${p.payer_email ?? p.user_email ?? '—'}  ${new Date(p.created_at).toISOString().slice(0, 10)}`)
  }

  // Subscriptions are LISTED for transparency but never deleted here.
  const { rows: subs } = await pool.query(`
    SELECT s.id, u.email, s.plan, s.status, s.created_at, s.current_period_end
    FROM subscriptions s LEFT JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC`)
  console.log(`\n=== SUBSCRIPTIONS (${subs.length}) — none are deleted; founder rows are excluded from metrics in code ===`)
  for (const s of subs) {
    const founder = adminEmail && s.email && s.email.toLowerCase() === adminEmail
    console.log(`  keep  [${founder ? 'FOUNDER' : 'REAL   '}] ${short(s.id)}  ${String(s.plan).padEnd(9)} ${String(s.status).padEnd(9)}  ${s.email ?? '—'}  ${new Date(s.created_at).toISOString().slice(0, 10)}`)
  }

  console.log(`\n${toDelete.length} payment row(s) marked for deletion; ${pays.length - toDelete.length} real row(s) kept.`)

  if (!CONFIRM) {
    console.log('\nDRY-RUN — nothing deleted. Re-run with --confirm to delete the marked payment rows.\n')
    process.exit(0)
  }
  if (toDelete.length === 0) { console.log('\nNothing to delete.\n'); process.exit(0) }

  const res = await pool.query('DELETE FROM payments WHERE id = ANY($1::uuid[])', [toDelete])
  console.log(`\n✓ Deleted ${res.rowCount} payment row(s). Users and subscriptions untouched — the founder account and login are intact.\n`)
} finally {
  await pool.end()
}
