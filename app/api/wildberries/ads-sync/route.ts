import { NextResponse } from 'next/server'
import { eq, and, ne, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, productAdsStats } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { withErrorHandler } from '@/lib/api-handler'

const WB_ADV = 'https://advert-api.wildberries.ru'

function advHeaders(token: string) {
  return { 'Authorization': `Bearer ${token}` }
}

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [shop] = await db.select().from(shops)
    .where(and(
      eq(shops.user_id, user.id),
      eq(shops.marketplace, 'wildberries'),
      ne(shops.shop_id_external, 'DEMO'),
    ))

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'No Wildberries API token' }, { status: 400 })
  }

  const token  = decrypt(shop.api_key_encrypted)
  const shopId = shop.id
  let statsUpserted = 0

  try {
    const countRes = await fetch(`${WB_ADV}/adv/v1/promotion/count`, {
      headers: advHeaders(token),
    })
    if (!countRes.ok) {
      return NextResponse.json({ error: `Ads API ${countRes.status}: ${await countRes.text()}` }, { status: 502 })
    }
    const countData = await countRes.json()

    const campaignIds: number[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const group of Object.values(countData?.adverts ?? {}) as any[]) {
      for (const item of group ?? []) {
        for (const advert of item?.advert_list ?? []) {
          if (advert.advertId) campaignIds.push(advert.advertId)
        }
      }
    }

    if (campaignIds.length === 0) {
      return NextResponse.json({ ok: true, statsUpserted: 0 })
    }

    const endDate = new Date()
    const beginDate = new Date()
    beginDate.setDate(beginDate.getDate() - 6)
    const beginStr = beginDate.toISOString().split('T')[0]
    const endStr   = endDate.toISOString().split('T')[0]

    const aggMap = new Map<string, { imp: number; clicks: number; spend: number; orders: number; revenue: number }>()

    for (let i = 0; i < campaignIds.length; i += 100) {
      const batch = campaignIds.slice(i, i + 100)
      const ids = batch.join(',')
      const statsRes = await fetch(
        `${WB_ADV}/adv/v3/fullstats?ids=${ids}&beginDate=${beginStr}&endDate=${endStr}`,
        { headers: advHeaders(token) },
      )
      if (!statsRes.ok) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statsData: any[] = await statsRes.json()
      for (const campaign of statsData ?? []) {
        for (const day of campaign.days ?? []) {
          const date: string = (day.date ?? '').split('T')[0]
          if (!date) continue
          for (const app of day.apps ?? []) {
            for (const nm of app.nm ?? []) {
              const sku = nm.nmId ? String(nm.nmId) : null
              if (!sku || !date) continue
              const key = `${sku}::${date}`
              const prev = aggMap.get(key) ?? { imp: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 }
              aggMap.set(key, {
                imp:     prev.imp     + (nm.views  ?? 0),
                clicks:  prev.clicks  + (nm.clicks ?? 0),
                spend:   prev.spend   + (nm.sum    ?? 0),
                orders:  prev.orders  + (nm.orders ?? 0),
                revenue: prev.revenue + (nm.sum_price ?? 0),
              })
            }
          }
        }
      }
    }

    const rows = []
    for (const [key, s] of aggMap) {
      const [sku, date] = key.split('::')
      rows.push({
        shop_id: shopId,
        sku,
        date,
        impressions: s.imp,
        clicks: s.clicks,
        spend: String(s.spend),
        orders_from_ads: s.orders,
        revenue_from_ads: String(s.revenue),
      })
    }

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        await db.insert(productAdsStats).values(batch)
          .onConflictDoUpdate({
            target: [productAdsStats.shop_id, productAdsStats.sku, productAdsStats.date],
            set: {
              impressions: sql`EXCLUDED.impressions`,
              clicks: sql`EXCLUDED.clicks`,
              spend: sql`EXCLUDED.spend`,
              orders_from_ads: sql`EXCLUDED.orders_from_ads`,
              revenue_from_ads: sql`EXCLUDED.revenue_from_ads`,
            },
          })
        statsUpserted += batch.length
      }
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, statsUpserted })
})
