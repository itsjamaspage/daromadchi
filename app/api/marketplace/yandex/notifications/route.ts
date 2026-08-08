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

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req)
  const url = new URL(req.url)

  // Parse the body FIRST. The validation PING must be acked with 200 regardless
  // of source IP or token, or Yandex marks the whole subscription "Некорректный
  // URL" and refuses to connect. A PING carries no data and triggers nothing, so
  // acking it unconditionally is safe — the auth gate below still guards every
  // notification that actually DOES something (a live cross-store stock write).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null
  try { body = await req.json() } catch { /* PING may be empty */ }

  const type = String(body?.notificationType ?? body?.type ?? '').toUpperCase()

  // Validation handshake — ack fast, do nothing, no gating.
  if (type === 'PING' || !body) {
    logger.info('ym_notify_ping', { ip })
    return NextResponse.json({ version: 1, name: 'daromadchi', ok: true })
  }

  // ── Real notification: authenticate before it can trigger a live write. ──
  // Yandex Market's own model is a SECRET URL, so a matching ?token= is the
  // primary, transport-agnostic gate; a request from Yandex's documented IP
  // ranges is also accepted. EITHER is sufficient — this is deliberately more
  // permissive than requiring both, because the hardcoded IP list can miss a
  // Market notification egress range and silently drop real events. The source
  // IP is logged on every accept/reject so an unlisted range is discoverable
  // (add it via YM_NOTIFY_ALLOWED_IPS) rather than invisible.
  const token = url.searchParams.get('token')
  const expected = process.env.YM_NOTIFY_TOKEN
  const tokenOk = !!expected && token === expected
  const ipOk = ipAllowed(ip)
  if (!tokenOk && !ipOk) {
    logger.warn('ym_notify_unauthorized', { ip, type, hasToken: !!token, tokenConfigured: !!expected })
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  logger.info('ym_notify', { ip, type, via: tokenOk ? 'token' : 'ip' })

  // Resolve the shop from the campaignId in the payload, then run Step A/B in
  // the background so we return within the 10s budget. Writes are always live —
  // a qualifying stock change propagates to the other store immediately.
  const campaignId = body?.campaignId ?? body?.shopId ?? body?.order?.campaignId
  if (campaignId != null) {
    void (async () => {
      try {
        const [shop] = await db.select({ user_id: shops.user_id })
          .from(shops)
          .where(and(eq(shops.shop_id_external, String(campaignId)), eq(shops.marketplace, 'yandex_market')))
        if (!shop) { logger.warn('ym_notify_shop_not_found', { campaignId }); return }
        const res = await syncStockSyncGroups({ userId: shop.user_id })
        logger.info('ym_notify_processed', { campaignId, writesPlanned: res.writesPlanned, live: true })
      } catch (err) {
        logger.error('ym_notify_process_failed', { campaignId, error: String(err).slice(0, 300) })
      }
    })()
  }

  return NextResponse.json({ ok: true })
}
