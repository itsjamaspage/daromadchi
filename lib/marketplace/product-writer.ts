/**
 * Yandex Market product creation — THE THIRD sanctioned marketplace write.
 * Approved by owner (jkhakimjonov8@gmail.com).
 *
 * Creates/updates offers on Yandex via POST /v2/businesses/{id}/offer-mappings/update.
 * Every attempt is audited in product_write_log. Only Yandex Market — Uzum has
 * no product creation API. Follows the same pattern as stock-writer.ts.
 */

import { db, productWriteLog } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { YANDEX_API_BASE, type YandexOfferUpdate } from '@/lib/yandex/client'

export type ProductWriteStatus = 'sent' | 'skipped' | 'blocked' | 'error'

export interface ProductWriteShop {
  id: string
  marketplace: 'yandex_market'
  api_key_encrypted: string | null
  business_id?: string | null
}

export interface PushProductsParams {
  shop: ProductWriteShop
  userId: string
  offers: YandexOfferUpdate[]
}

export interface PushProductsResult {
  status: ProductWriteStatus
  reason?: string
  httpStatus?: number
  logId?: string
}

async function audit(fields: {
  shop_id: string
  user_id: string
  marketplace: 'yandex_market'
  offer_id?: string | null
  offer_name?: string | null
  offer_count?: number | null
  endpoint?: string | null
  method?: string | null
  status: ProductWriteStatus
  reason?: string | null
  http_status?: number | null
  request_body?: string | null
  response_body?: string | null
  error?: string | null
}): Promise<string | undefined> {
  try {
    const [row] = await db.insert(productWriteLog).values({
      shop_id: fields.shop_id,
      user_id: fields.user_id,
      marketplace: fields.marketplace,
      offer_id: fields.offer_id ?? null,
      offer_name: fields.offer_name ?? null,
      offer_count: fields.offer_count ?? null,
      endpoint: fields.endpoint ?? null,
      method: fields.method ?? null,
      status: fields.status,
      reason: fields.reason ?? null,
      http_status: fields.http_status ?? null,
      request_body: fields.request_body ?? null,
      response_body: fields.response_body ?? null,
      error: fields.error ?? null,
    }).returning({ id: productWriteLog.id })
    return row?.id
  } catch (err) {
    logger.error('product_write_log_insert_failed', { shopId: fields.shop_id, error: String(err).slice(0, 300) })
    return undefined
  }
}

export async function pushProducts(params: PushProductsParams): Promise<PushProductsResult> {
  const { shop, userId, offers } = params
  const base = {
    shop_id: shop.id,
    user_id: userId,
    marketplace: 'yandex_market' as const,
    offer_count: offers.length,
    offer_id: offers.map(o => o.offerId).join(', ').slice(0, 500),
    offer_name: offers[0]?.name?.slice(0, 200) ?? null,
  }

  if (shop.marketplace !== 'yandex_market') {
    const logId = await audit({ ...base, status: 'skipped', reason: 'only_yandex_supported' })
    return { status: 'skipped', reason: 'only_yandex_supported', logId }
  }

  if (!offers.length) {
    const logId = await audit({ ...base, status: 'skipped', reason: 'no_offers' })
    return { status: 'skipped', reason: 'no_offers', logId }
  }

  const businessId = shop.business_id?.trim()
  if (!businessId) {
    const logId = await audit({ ...base, status: 'skipped', reason: 'missing_business_id' })
    return { status: 'skipped', reason: 'missing_business_id', logId }
  }

  const token = shop.api_key_encrypted ? decrypt(shop.api_key_encrypted) : ''
  if (!token) {
    const logId = await audit({ ...base, status: 'skipped', reason: 'no_token' })
    return { status: 'skipped', reason: 'no_token', logId }
  }

  const url = `${YANDEX_API_BASE}/v2/businesses/${businessId}/offer-mappings/update`
  const method = 'POST'
  const body = JSON.stringify({ offerMappings: offers.map(o => ({ offer: o })) })

  try {
    const res = await marketplaceFetch(url, {
      method,
      headers: {
        'Api-Key': token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      intent: 'product-write',
    })
    let respText = ''
    try { respText = await res.text() } catch { /* ignore */ }
    const status: ProductWriteStatus = res.ok ? 'sent' : 'error'
    const reason = res.ok ? 'ok' : `http_${res.status}`

    if (!res.ok) {
      logger.error('product_write_http_error', {
        shopId: shop.id, url, http: res.status, body: respText.slice(0, 500),
      })
    }

    const logId = await audit({
      ...base, endpoint: url, method, status, reason,
      http_status: res.status,
      request_body: body.slice(0, 4000),
      response_body: respText.slice(0, 2000),
    })
    return { status, reason: res.ok ? undefined : reason, httpStatus: res.status, logId }
  } catch (err) {
    const blocked = err instanceof Error && /GUARD/.test(err.message)
    const status: ProductWriteStatus = blocked ? 'blocked' : 'error'
    logger.error('product_write_error', {
      shopId: shop.id, url, blocked, error: String(err).slice(0, 300),
    })
    const logId = await audit({
      ...base, endpoint: url, method, status,
      reason: blocked ? 'guard_blocked' : 'exception',
      request_body: body.slice(0, 4000),
      error: String(err).slice(0, 500),
    })
    return { status, reason: blocked ? 'guard_blocked' : 'exception', logId }
  }
}
