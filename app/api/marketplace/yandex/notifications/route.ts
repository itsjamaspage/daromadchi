import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db, shops } from '@/lib/db'
import { logger } from '@/lib/logger'
import { syncStockSyncGroups } from '@/lib/marketplace/stock-sync'

export const runtime = 'nodejs'

/**
 * Yandex Market push-notification receiver.
 *
 * Contract: respond HTTP 200 within 10s (YM disables the subscription on
 * timeouts), accept the validation PING, and only accept requests from Yandex's
 * IP ranges. To meet the 10s budget we ack FIRST and do the Step A/B work in the
 * background. YM-triggered writes stay in DRY-RUN until the operator has seen a
 * real PING + a real notification ack under 10s and explicitly flips
 * YM_STOCK_SYNC_WEBHOOK_LIVE — this route never forces a live write on its own.
 */

// Yandex notification source ranges. Overridable via YM_NOTIFY_ALLOWED_IPS
// (comma-separated CIDRs / exact IPs). Defaults cover the documented ranges.
const DEFAULT_YANDEX_CIDRS = [
  '5.45.192.0/18', '5.255.192.0/18', '37.9.64.0/18', '37.140.128.0/18',
  '77.88.0.0/18', '87.250.224.0/19', '93.158.128.0/18', '95.108.128.0/17',
  '100.43.64.0/19', '178.154.128.0/17', '199.21.99.0/24', '213.180.192.0/19',
]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const o = Number(p)
    if (!Number.isInteger(o) || o < 0 || o > 255) return null
    n = (n << 8) | o
  }
  return n >>> 0
}

function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip.trim() === cidr.trim()
  const [range, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const ipInt = ipv4ToInt(ip)
  const rangeInt = ipv4ToInt(range)
  if (ipInt == null || rangeInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (ipInt & mask) === (rangeInt & mask)
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

function ipAllowed(ip: string | null): boolean {
  if (!ip) return false
  const configured = process.env.YM_NOTIFY_ALLOWED_IPS?.split(',').map(s => s.trim()).filter(Boolean)
  const cidrs = configured && configured.length > 0 ? configured : DEFAULT_YANDEX_CIDRS
  // IPv6 (e.g. 2a02:6b8::/32) — accept only if explicitly listed as an exact prefix match.
  if (ip.includes(':')) return cidrs.some(c => !c.includes('/') && ip.startsWith(c))
  return cidrs.some(c => ipInCidr(ip, c))
}

function webhookLive(): boolean {
  const v = (process.env.YM_STOCK_SYNC_WEBHOOK_LIVE ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req)

  // Optional shared secret in the query string (URL secrecy is YM's default auth).
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const expected = process.env.YM_NOTIFY_TOKEN
  if (expected && token !== expected) {
    logger.warn('ym_notify_bad_token', { ip })
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  if (!ipAllowed(ip)) {
    logger.warn('ym_notify_ip_blocked', { ip })
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null
  try { body = await req.json() } catch { /* PING may be empty */ }

  const type = String(body?.notificationType ?? body?.type ?? '').toUpperCase()

  // Validation handshake — ack fast, do nothing.
  if (type === 'PING' || !body) {
    logger.info('ym_notify_ping', { ip })
    return NextResponse.json({ version: 1, name: 'daromadchi', ok: true })
  }

  logger.info('ym_notify', { ip, type })

  // Resolve the shop from the campaignId in the payload, then run Step A/B in
  // the background so we return within the 10s budget. Writes stay dry-run
  // unless the operator has explicitly enabled the webhook-live flag.
  const campaignId = body?.campaignId ?? body?.shopId ?? body?.order?.campaignId
  if (campaignId != null) {
    void (async () => {
      try {
        const [shop] = await db.select({ user_id: shops.user_id })
          .from(shops)
          .where(and(eq(shops.shop_id_external, String(campaignId)), eq(shops.marketplace, 'yandex_market')))
        if (!shop) { logger.warn('ym_notify_shop_not_found', { campaignId }); return }
        const res = await syncStockSyncGroups({ userId: shop.user_id, forceDryRun: !webhookLive() })
        logger.info('ym_notify_processed', { campaignId, writesPlanned: res.writesPlanned, live: webhookLive() })
      } catch (err) {
        logger.error('ym_notify_process_failed', { campaignId, error: String(err).slice(0, 300) })
      }
    })()
  }

  return NextResponse.json({ ok: true })
}
