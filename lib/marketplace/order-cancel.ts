/**
 * Oversell order-cancel path — the SECOND (and only other) sanctioned write.
 * Equally strict as the stock-writer: routes through the shared marketplaceFetch
 * guard with intent 'order-cancel' (its own method-exact allowlist, cancel-only),
 * kill-switch aware, dry-run capable, and audited in order_cancel_log.
 *
 * It can ONLY cancel. The guard blocks any other order mutation (confirm, refund,
 * status-advance) even on the shared YM status endpoint (body must be CANCELLED).
 */

import { db, orderCancelLog } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { marketplaceFetch, type MarketplaceInit } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'
import { YANDEX_API_BASE } from '@/lib/yandex/client'
import type { MarketplaceType } from '@/lib/types'

export type CancelStatus = 'sent' | 'dry_run' | 'skipped' | 'blocked' | 'killed' | 'error'

export interface CancelShop {
  id: string
  marketplace: MarketplaceType
  api_key_encrypted: string | null
  shop_id_external?: string | null // YM campaignId
}

export interface CancelOrderParams {
  shop: CancelShop
  orderIdExternal: string
  reason?: string
  dryRun: boolean
  /** true = fired by the auto-cancel detector; false = one-click (human). */
  auto: boolean
}

export interface CancelResult {
  status: CancelStatus
  reason?: string
  httpStatus?: number
  logId?: string
}

const KILL_SWITCH_VALUES = new Set(['1', 'true', 'yes', 'on'])
function killSwitchOn(): boolean {
  return KILL_SWITCH_VALUES.has((process.env.STOCK_SYNC_KILL_SWITCH ?? '').trim().toLowerCase())
}

async function audit(fields: {
  shop_id: string; marketplace: MarketplaceType; order_id_external: string; reason: string
  endpoint?: string | null; method?: string | null; auto: boolean; dry_run: boolean
  status: CancelStatus | 'rate_limited'; detail?: string | null; http_status?: number | null
  request_body?: string | null; response_body?: string | null; error?: string | null
}): Promise<string | undefined> {
  try {
    const [row] = await db.insert(orderCancelLog).values({
      shop_id: fields.shop_id, marketplace: fields.marketplace, order_id_external: fields.order_id_external,
      reason: fields.reason, endpoint: fields.endpoint ?? null, method: fields.method ?? null,
      auto: fields.auto, dry_run: fields.dry_run, status: fields.status, detail: fields.detail ?? null,
      http_status: fields.http_status ?? null, request_body: fields.request_body ?? null,
      response_body: fields.response_body ?? null, error: fields.error ?? null,
    }).returning({ id: orderCancelLog.id })
    return row?.id
  } catch (err) {
    logger.error('order_cancel_log_insert_failed', { shopId: fields.shop_id, error: String(err).slice(0, 300) })
    return undefined
  }
}

export async function cancelOrder(params: CancelOrderParams): Promise<CancelResult> {
  const { shop, orderIdExternal, dryRun, auto } = params
  const reason = params.reason ?? 'OUT_OF_STOCK'
  const marketplace = shop.marketplace
  const base = { shop_id: shop.id, marketplace, order_id_external: orderIdExternal, reason, auto }

  if (killSwitchOn()) {
    const logId = await audit({ ...base, dry_run: dryRun, status: 'killed', detail: 'kill_switch' })
    return { status: 'killed', reason: 'kill_switch', logId }
  }
  if (marketplace !== 'uzum' && marketplace !== 'yandex_market') {
    const logId = await audit({ ...base, dry_run: dryRun, status: 'skipped', detail: 'marketplace_out_of_scope' })
    return { status: 'skipped', reason: 'marketplace_out_of_scope', logId }
  }
  if (!orderIdExternal) {
    const logId = await audit({ ...base, dry_run: dryRun, status: 'skipped', detail: 'missing_order_id' })
    return { status: 'skipped', reason: 'missing_order_id', logId }
  }

  let url: string
  let method: 'POST' | 'PUT'
  let body: string
  if (marketplace === 'uzum') {
    url = `${UZUM_API_BASE}/v1/fbs/order/${encodeURIComponent(orderIdExternal)}/cancel`
    method = 'POST'
    body = JSON.stringify({ reason })
  } else {
    const campaignId = shop.shop_id_external?.trim()
    if (!campaignId) {
      const logId = await audit({ ...base, dry_run: dryRun, status: 'skipped', detail: 'missing_campaign' })
      return { status: 'skipped', reason: 'missing_campaign', logId }
    }
    url = `${YANDEX_API_BASE}/v2/campaigns/${campaignId}/orders/${encodeURIComponent(orderIdExternal)}/status`
    method = 'PUT'
    // status CANCELLED is what the guard requires; substatus tells YM it was a
    // seller-side stock failure. Nothing here can advance the order.
    body = JSON.stringify({ order: { status: 'CANCELLED', substatus: 'SHOP_FAILED' } })
  }

  const token = shop.api_key_encrypted ? decrypt(shop.api_key_encrypted) : ''
  if (!token) {
    const logId = await audit({ ...base, dry_run: dryRun, endpoint: url, method, status: 'skipped', detail: 'no_token' })
    return { status: 'skipped', reason: 'no_token', logId }
  }

  if (dryRun) {
    logger.info('order_cancel_dry_run', { shopId: shop.id, marketplace, url, method, orderIdExternal, auto, body })
    const logId = await audit({ ...base, dry_run: true, endpoint: url, method, status: 'dry_run', detail: 'dry_run', request_body: body })
    return { status: 'dry_run', logId }
  }

  const headers: Record<string, string> = marketplace === 'uzum'
    ? { Authorization: token, Accept: 'application/json', 'Content-Type': 'application/json' }
    : { 'Api-Key': token, Accept: 'application/json', 'Content-Type': 'application/json' }

  try {
    const init: MarketplaceInit = { method, headers, body, intent: 'order-cancel' }
    const res = await marketplaceFetch(url, init)
    let respText = ''
    try { respText = await res.text() } catch { /* ignore */ }
    const status: CancelStatus = res.ok ? 'sent' : 'error'
    const logId = await audit({
      ...base, dry_run: false, endpoint: url, method, status,
      detail: res.ok ? 'ok' : `http_${res.status}`, http_status: res.status,
      request_body: body, response_body: respText.slice(0, 2000),
    })
    if (!res.ok) logger.error('order_cancel_http_error', { shopId: shop.id, marketplace, http: res.status })
    return { status, reason: res.ok ? undefined : `http_${res.status}`, httpStatus: res.status, logId }
  } catch (err) {
    const blocked = err instanceof Error && /GUARD/.test(err.message)
    const status: CancelStatus = blocked ? 'blocked' : 'error'
    logger.error('order_cancel_error', { shopId: shop.id, marketplace, blocked, error: String(err).slice(0, 300) })
    const logId = await audit({
      ...base, dry_run: false, endpoint: url, method, status,
      detail: blocked ? 'guard_blocked' : 'exception', request_body: body, error: String(err).slice(0, 500),
    })
    return { status, reason: blocked ? 'guard_blocked' : 'exception', logId }
  }
}
