/**
 * Which offer-mappings path actually answers — business or campaign?
 *
 * READ-ONLY. Both calls are POSTs that Yandex requires for a READ, and both are
 * already in APPROVED_POST_ENDPOINTS (guard lines 33-34). Nothing is written.
 *
 *   set -a; . ./.env; set +a
 *   npx tsx scripts/probe-yandex-catalog-path.ts
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * fetchYandexProducts tries the business path first and, on 404/403/405, falls
 * through to the campaign path. The fallthrough is SILENT: whichever one
 * answered, the caller just gets entries, and whichever one failed leaves no
 * trace. So a campaign-path 404 in a stack trace does not tell you whether the
 * business path was skipped, tried-and-refused, or never needed — three
 * different causes with three different fixes.
 *
 * This calls each path directly and reports both statuses side by side.
 */
import { eq, and } from 'drizzle-orm'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { YANDEX_API_BASE, fetchCampaignInfo } from '@/lib/yandex/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function tryPath(label: string, url: string, token: string) {
  try {
    const res = await marketplaceFetch(url, {
      method: 'POST',
      headers: { 'Api-Key': token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ limit: 200 }),
      next: { revalidate: 0 },
    } as any)
    const text = await res.text().catch(() => '')
    let n: number | null = null
    try {
      const j = JSON.parse(text)
      const e = j?.result?.offerMappings ?? j?.result?.offerMappingEntries ?? null
      n = Array.isArray(e) ? e.length : null
    } catch { /* non-JSON body */ }
    console.log(`  ${label}`)
    console.log(`    ${url.replace(YANDEX_API_BASE, '')}`)
    console.log(`    HTTP ${res.status}${n !== null ? `  → ${n} entries` : ''}`)
    if (!res.ok) console.log(`    body: ${text.slice(0, 200)}`)
    return { ok: res.ok, status: res.status, entries: n }
  } catch (e) {
    // A guard rejection lands here and must never be read as Yandex's answer.
    console.log(`  ${label}\n    LOCAL (never sent): ${String(e).slice(0, 160)}`)
    return { ok: false, status: 0, entries: null }
  }
}

async function main() {
  const [shop] = await db.select({
    ext: shops.shop_id_external, biz: shops.business_id, enc: shops.api_key_encrypted,
  }).from(shops).where(and(eq(shops.marketplace, 'yandex_market'), eq(shops.is_active, true)))
  if (!shop?.enc || !shop.ext) { console.log('No active Yandex shop with a token.'); process.exit(1) }
  const token = decrypt(shop.enc)

  // Mirror the sync exactly: stored business_id is NOT read by production — it
  // derives businessId from the campaign every run — so resolve it the same way
  // and show both, in case they disagree.
  const info = await fetchCampaignInfo(token, String(shop.ext)).catch((e: any) => {
    console.log(`  fetchCampaignInfo failed: ${e?.status ?? ''} ${String(e).slice(0, 120)}`)
    return null
  })
  const derived = info?.businessId ? String(info.businessId) : null

  console.log('\n══ Identifiers ══')
  console.log(`  shops.shop_id_external (used as campaignId): ${shop.ext}`)
  console.log(`  shops.business_id (STORED, unread by sync) : ${shop.biz ?? '(null)'}`)
  console.log(`  businessId derived from campaign this run  : ${derived ?? '(unresolved)'}`)
  if (shop.biz && derived && shop.biz !== derived) {
    console.log('  ⚠ stored and derived business ids DISAGREE')
  }

  const businessId = derived ?? shop.biz ?? null
  console.log('\n══ offer-mappings, each path called directly ══')
  const bus = businessId
    ? await tryPath('BUSINESS (what the sync tries first)',
        `${YANDEX_API_BASE}/v2/businesses/${businessId}/offer-mappings?limit=200`, token)
    : (console.log('  BUSINESS: skipped — no businessId, which is itself the finding'), null)
  const camp = await tryPath('CAMPAIGN (silent fallback)',
    `${YANDEX_API_BASE}/v2/campaigns/${shop.ext}/offer-mappings?limit=200`, token)

  console.log('\n══ Verdict ══')
  if (bus?.ok && (bus.entries ?? 0) > 0) {
    console.log('  Business path ANSWERS. The catalog is reachable, so an empty offerMappings')
    console.log('  in a cron debug means that run was a LIGHT tick, not a broken fetch.')
    if (!camp.ok) console.log(`  The campaign ${camp.status} is only the unused fallback — harmless here.`)
  } else if (bus && !bus.ok && !camp.ok) {
    console.log(`  BOTH paths fail (business ${bus.status}, campaign ${camp.status}).`)
    console.log('  The catalog fetch is genuinely broken: no entries → no stock write →')
    console.log('  every SKU keeps its last value indefinitely.')
  } else if (!businessId) {
    console.log('  No businessId resolved, so the sync skips the business path entirely and')
    console.log('  lands on the campaign fallback. Fix the id resolution, not the endpoint.')
  } else {
    console.log(`  Mixed: business ok=${bus?.ok} entries=${bus?.entries}, campaign ${camp.status}.`)
  }
  console.log('\n  A heavy pass is what populates offerMappings/stockEntries. To force one:')
  console.log('  POST /api/yandex/sync while signed in — it omits the heavy flag, which defaults true.\n')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
