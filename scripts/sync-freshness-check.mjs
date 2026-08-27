#!/usr/bin/env node
/**
 * Sync-freshness watchdog — WORK liveness, not process liveness.
 *
 * On 2025-08-27 the app served a broken build for 30+ minutes: the crontab kept
 * firing `cron-runner.sh sync`, curl kept hitting the endpoint, and every call
 * failed because the server couldn't boot its instrumentation — yet PM2 reported
 * "online" the whole time and nothing paged. The failures were even logged, but
 * no one watches a log. This closes that gap by measuring the one thing that
 * actually matters: did a sync COMPLETE recently, as recorded in the database.
 *
 * DELIBERATELY MINIMAL DEPENDENCIES. It talks straight to Postgres (`pg`, a prod
 * dependency) and straight to Telegram (global `fetch`). No tsx, no drizzle, no
 * `@/` alias, no Next graph — because the failure this is built to catch is "the
 * app / its build is broken," and a watchdog that shares that graph goes down
 * with it. It also runs from its OWN crontab line, not through cron-runner.sh
 * (which is HTTP-only, i.e. dead exactly when we need the alarm).
 *
 * WHAT IT WATCHES
 *   Primary signal — MAX(shops.stock_synced_at) across active, keyed shops. That
 *   column advances every ~15 min on EVERY such shop's successful stock read,
 *   independent of plan and independent of whether any number changed, so a
 *   freshest-read older than the threshold means sync is not completing. This is
 *   the alarm condition.
 *   Context only — newest stock_write_log.created_at. Writes are legitimately
 *   sparse (the engine only writes when a listing diverges), so an absence of
 *   writes is NOT an alarm; it is reported in the log line for context.
 *
 * OUTPUTS (BOTH, by design)
 *   • Telegram → operators (TELEGRAM_ADMIN_CHAT_ID), on the stale edge, hourly
 *     while stale, and once on recovery.
 *   • A local logfile line EVERY run. Alerting only through the same Telegram
 *     path the app uses would go silent exactly when creds or network are the
 *     fault; a file trace survives that and is the fallback record.
 *
 * ENV
 *   DATABASE_URL              (required) — sourced by scripts/sync-freshness-check.sh
 *   TELEGRAM_BOT_TOKEN        (required to page; without it, logs only)
 *   TELEGRAM_ADMIN_CHAT_ID    comma-separated operator chat ids; falls back to the
 *                             same operator id lib/telegram-admin.ts uses.
 *   FRESHNESS_STALE_MINUTES   default 40   — alarm threshold
 *   FRESHNESS_REALERT_MINUTES default 60   — gap between repeat pages while stale
 *   FRESHNESS_LOG_FILE        default $DAROMADCHI_LOG_DIR/sync-freshness.log
 *   FRESHNESS_STATE_FILE      default alongside the log, .state
 *   DRY_RUN=1                 evaluate + log, never POST to Telegram (safe to test)
 *
 * EXIT CODE: 0 when it ran (whether OK or STALE — a fired alarm is a success for
 * the watchdog). Non-zero only when the watchdog itself could not run (no
 * DATABASE_URL, DB unreachable), which is itself worth a crontab-level MAILTO.
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname } from 'node:path'
import pg from 'pg'
import { classifyFreshness, decideNotification, fmtAge, STATUS } from './sync-freshness-lib.mjs'

const FALLBACK_ADMIN_CHAT_ID = '6884517020' // mirrors lib/telegram-admin.ts

const STALE_MS = Number(process.env.FRESHNESS_STALE_MINUTES ?? 40) * 60_000
const REALERT_MS = Number(process.env.FRESHNESS_REALERT_MINUTES ?? 60) * 60_000
const LOG_DIR = process.env.DAROMADCHI_LOG_DIR ?? `${process.env.DAROMADCHI_DIR ?? '/var/www/daromadchi'}/logs`
const LOG_FILE = process.env.FRESHNESS_LOG_FILE ?? `${LOG_DIR}/sync-freshness.log`
const STATE_FILE = process.env.FRESHNESS_STATE_FILE ?? `${LOG_DIR}/sync-freshness.state`
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

const stamp = () => new Date().toISOString()

function logLine(text) {
  const line = `${stamp()} ${text}\n`
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true })
    appendFileSync(LOG_FILE, line)
  } catch (e) {
    // The logfile is the fallback record; if even that fails, stderr is all we have.
    process.stderr.write(`freshness: logfile write failed: ${String(e)}\n`)
  }
  process.stdout.write(line)
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {} // first run, or unreadable → treat as no prior state
  }
}

function writeState(state) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state))
  } catch (e) {
    process.stderr.write(`freshness: state write failed: ${String(e)}\n`)
  }
}

function adminChatIds() {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
  if (!raw) return [FALLBACK_ADMIN_CHAT_ID]
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
  return ids.length ? ids : [FALLBACK_ADMIN_CHAT_ID]
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    logLine('WARN no TELEGRAM_BOT_TOKEN — cannot page; logfile is the only record')
    return
  }
  if (DRY_RUN) {
    logLine(`DRY_RUN would page: ${text.replace(/\n/g, ' ')}`)
    return
  }
  for (const chatId of adminChatIds()) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      })
      if (!res.ok) logLine(`WARN telegram sendMessage http=${res.status} chat=${chatId}`)
    } catch (e) {
      logLine(`WARN telegram sendMessage failed chat=${chatId}: ${String(e)}`)
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    logLine('FATAL no DATABASE_URL — watchdog cannot run')
    process.exit(1)
  }

  // One pass per interval. A doubled crontab line was firing this ~3× within 30ms,
  // which would page in triplicate. The wrapper's flock stops truly concurrent
  // invocations; this debounce stops a STAGGERED repeat (each finishing before the
  // next starts). A real 5-min tick is far above the 60s floor, so legitimate runs
  // are never skipped.
  const startedMs = Date.now()
  const preState = readState()
  const minRunMs = Number(process.env.FRESHNESS_MIN_RUN_SECONDS ?? 60) * 1000
  if (preState.lastRunMs && startedMs - preState.lastRunMs < minRunMs) {
    logLine(`skipped (ran ${Math.round((startedMs - preState.lastRunMs) / 1000)}s ago — duplicate schedule)`)
    return
  }

  const client = new pg.Client({ connectionString })
  let row
  let driftRows = []
  try {
    await client.connect()
    // active-shop count, freshest successful stock read, and the newest recorded
    // stock write (context only).
    const q = await client.query(`
      SELECT
        (SELECT count(*) FROM shops
           WHERE is_active = true AND api_key_encrypted IS NOT NULL)                 AS active_shops,
        (SELECT max(stock_synced_at) FROM shops
           WHERE is_active = true AND api_key_encrypted IS NOT NULL)                 AS freshest_sync,
        (SELECT max(created_at) FROM stock_write_log WHERE status = 'sent')          AS newest_write
    `)
    row = q.rows[0]

    // ── Per-row physical_stock drift ────────────────────────────────────────
    // A cross-marketplace SKU group shares ONE physical pool, so every member's
    // physical_stock should agree. When one row sits BELOW its group's max, that
    // row's pool has been corrupted (e.g. JMBLK uzum stuck at 1 vs yandex 2 after
    // an Aug-26 cancellation the reconcile mis-adopted). The Stocks UI takes the
    // MAX, so it shows the healthy number and this rot is invisible to the seller
    // — hence a watchdog is the only place it surfaces.
    //
    // The MAX is scoped to the SAME owner's shops (user_id), because a "group" is
    // one seller's same-SKU listings; a global MAX would false-flag two sellers
    // who happen to share a SKU.
    //
    // ⚠️ INCOMPLETE BY CONSTRUCTION. This catches disagreement BETWEEN a group's
    // members only. When EVERY row in a group drifts DOWN together (as KBWHT did,
    // 2→1→0 on both marketplaces), they still agree, group max moves with them,
    // and this sees nothing. It is a floor, not full coverage; only the event
    // ledger closes the whole-group case.
    const d = await client.query(`
      SELECT s.marketplace, p.sku, p.stock_quantity, p.physical_stock,
             (SELECT max(p2.physical_stock)
                FROM products p2 JOIN shops s2 ON s2.id = p2.shop_id
               WHERE s2.user_id = s.user_id AND p2.sku = p.sku) AS group_max
        FROM products p JOIN shops s ON s.id = p.shop_id
       WHERE s.api_mode = 'stock_sync'
         AND p.physical_stock IS NOT NULL
         AND p.physical_stock < (SELECT max(p2.physical_stock)
                                   FROM products p2 JOIN shops s2 ON s2.id = p2.shop_id
                                  WHERE s2.user_id = s.user_id AND p2.sku = p.sku)
       ORDER BY p.sku, s.marketplace
    `)
    driftRows = d.rows
  } catch (e) {
    logLine(`FATAL database unreachable: ${String(e).slice(0, 300)}`)
    try { await client.end() } catch { /* ignore */ }
    process.exit(1)
  }
  await client.end()

  const nowMs = Date.now()
  const activeShops = Number(row.active_shops ?? 0)
  const freshestMs = row.freshest_sync ? new Date(row.freshest_sync).getTime() : null
  const newestWriteMs = row.newest_write ? new Date(row.newest_write).getTime() : null

  // Prior state is nested { freshness, drift }. Older flat state (pre-drift) reads
  // as {} for both → one harmless re-alert on the first run after upgrade.
  const prev = preState

  // ── Check 1: sync freshness ──────────────────────────────────────────────
  const { status, ageMs } = classifyFreshness({ activeShops, freshestMs, nowMs, thresholdMs: STALE_MS })
  const fresh = decideNotification({ prev: prev.freshness ?? {}, currStatus: status, nowMs, reAlertMs: REALERT_MS })

  // ── Check 2: per-row physical_stock drift (same rate-limit + channels) ────
  const driftCount = driftRows.length
  const driftStatus = driftCount > 0 ? STATUS.STALE : STATUS.OK
  const drift = decideNotification({ prev: prev.drift ?? {}, currStatus: driftStatus, nowMs, reAlertMs: REALERT_MS })

  writeState({ freshness: fresh.nextState, drift: drift.nextState, lastRunMs: startedMs })

  const writeAge = newestWriteMs == null ? 'none' : fmtAge(nowMs - newestWriteMs)
  const driftEx = driftRows.slice(0, 5)
    .map(r => `${r.sku}/${r.marketplace} ${r.physical_stock}<${r.group_max}`).join(', ')
  logLine(
    `status=${status} activeShops=${activeShops} freshestSync=${fmtAge(ageMs)} newestWrite=${writeAge}` +
    ` drift=${driftCount}${driftCount > 0 ? ` [${driftEx}]` : ''}` +
    `${fresh.notify ? ` notifyFresh=${fresh.notify}` : ''}${drift.notify ? ` notifyDrift=${drift.notify}` : ''}`
  )

  if (fresh.notify === 'alert') {
    const detail = status === STATUS.STALE && ageMs == null
      ? 'no successful sync is on record for any active shop'
      : `the freshest successful stock read is ${fmtAge(ageMs)} old`
    await sendTelegram(
      `⚠️ Daromadchi sync is STALLED.\n${detail} (threshold ${STALE_MS / 60000}m).\n` +
      `${activeShops} active shop(s). Check PM2 and the cron log — the process can be "online" while no sync completes.`
    )
  } else if (fresh.notify === 'recovery') {
    await sendTelegram(`✅ Daromadchi sync recovered. Freshest stock read is now ${fmtAge(ageMs)} old.`)
  }

  if (drift.notify === 'alert') {
    await sendTelegram(
      `⚠️ Daromadchi stock DRIFT: ${driftCount} listing(s) below their group's on-hand.\n` +
      `${driftEx}\nA shared-pool row is corrupted low (a lost unit). Catches BETWEEN-marketplace ` +
      `disagreement only — a whole group drifting down together is invisible here.`
    )
  } else if (drift.notify === 'recovery') {
    await sendTelegram(`✅ Daromadchi stock drift cleared — all listings agree with their group's on-hand.`)
  }
}

main().catch(e => {
  logLine(`FATAL watchdog crashed: ${String(e).slice(0, 300)}`)
  process.exit(1)
})
