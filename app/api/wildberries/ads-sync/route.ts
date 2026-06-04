import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

const WB_ADV = 'https://advert-api.wildberries.ru'

function advHeaders(token: string) {
  return { 'Authorization': `Bearer ${token}` }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', user.id)
    .eq('marketplace', 'wildberries')
    .maybeSingle()

  if (!shop?.api_key_encrypted) {
    return NextResponse.json({ error: 'No Wildberries API token' }, { status: 400 })
  }

  const token  = decrypt(shop.api_key_encrypted)
  const shopId = shop.id
  let statsUpserted = 0

  try {
    // 1. Get all campaign IDs
    const countRes = await fetch(`${WB_ADV}/adv/v1/promotion/count`, {
      headers: advHeaders(token),
    })
    if (!countRes.ok) {
      return NextResponse.json({ error: `Ads API ${countRes.status}: ${await countRes.text()}` }, { status: 502 })
    }
    const countData = await countRes.json()

    // Extract advertIds from nested structure { adverts: { status: [ { type, count, advert_list: [{advertId}] } ] } }
    const campaignIds: number[] = []
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

    // 2. Build date range for last 7 days
    const endDate = new Date()
    const beginDate = new Date()
    beginDate.setDate(beginDate.getDate() - 6)
    const beginStr = beginDate.toISOString().split('T')[0]
    const endStr   = endDate.toISOString().split('T')[0]

    // 3. Fetch stats in batches of 100 campaigns
    // v3 fullstats: GET /adv/v3/fullstats?ids=1,2,3&beginDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    const aggMap = new Map<string, { imp: number; clicks: number; spend: number; orders: number; revenue: number }>()

    for (let i = 0; i < campaignIds.length; i += 100) {
      const batch = campaignIds.slice(i, i + 100)
      const ids = batch.join(',')
      const statsRes = await fetch(
        `${WB_ADV}/adv/v3/fullstats?ids=${ids}&beginDate=${beginStr}&endDate=${endStr}`,
        { headers: advHeaders(token) },
      )
      if (!statsRes.ok) continue

      const statsData: any[] = await statsRes.json()
      for (const campaign of statsData ?? []) {
        for (const day of campaign.days ?? []) {
          const date: string = (day.date ?? '').split('T')[0]
          if (!date) continue
          for (const app of day.apps ?? []) {
            for (const nm of app.nm ?? []) {
              // WB returns nmId (their internal product ID) as the identifier
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

    // 4. Upsert aggregated stats
    const rows = []
    for (const [key, s] of aggMap) {
      const [sku, date] = key.split('::')
      rows.push({ shop_id: shopId, sku, date, impressions: s.imp, clicks: s.clicks, spend: s.spend, orders_from_ads: s.orders, revenue_from_ads: s.revenue })
    }

    if (rows.length > 0) {
      // Upsert in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase
          .from('product_ads_stats')
          .upsert(rows.slice(i, i + 500), { onConflict: 'shop_id,sku,date' })
        if (!error) statsUpserted += Math.min(500, rows.length - i)
      }
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, statsUpserted })
}
