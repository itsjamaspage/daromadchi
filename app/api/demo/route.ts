import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

// Clearly-labelled, removable sample data so the app can be evaluated without a
// real store that has listings. Everything lives under a single demo shop
// (shop_id_external = 'DEMO'); deleting that shop cascades away every demo row.

const DEMO_TAG = 'DEMO'

const CATEGORIES = [
  { name: 'Elektronika',  min: 150_000, max: 1_200_000 },
  { name: 'Kiyim',        min: 60_000,  max: 350_000 },
  { name: 'Kosmetika',    min: 30_000,  max: 220_000 },
  { name: "Uy-ro'zg'or",  min: 45_000,  max: 600_000 },
  { name: 'Sport',        min: 80_000,  max: 500_000 },
]

const PRODUCT_NAMES = [
  'Simsiz quloqchin', 'Smart-soat', 'Power bank 20000mAh', 'Bluetooth kolonka',
  'Paxta futbolka', 'Jinsi shim', 'Sport krossovka', 'Yomg\'ir kurtka',
  'Yuz uchun krem', 'Shampun 500ml', 'Parfyumeriya nabori', 'Lab pomadasi',
  'Choynak elektr', 'Yostiq ortopedik', 'Adyol ikki kishilik', 'Idishlar to\'plami',
  'Gantel 10kg', 'Yoga gilamcha', 'Velosiped nasosi', 'Termos 1L',
]

const STATUSES = ['delivered', 'delivered', 'delivered', 'delivered', 'confirmed', 'pending', 'cancelled', 'returned'] as const

function rnd(min: number, max: number) { return Math.random() * (max - min) + min }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)) }
function pick<T>(arr: readonly T[]): T { return arr[rndInt(0, arr.length - 1)] }
function roundTo(n: number, step = 1000) { return Math.round(n / step) * step }

export const DELETE = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cascade removes products/orders/order_items/ad_campaigns/search_phrases.
  const { error } = await supabase
    .from('shops')
    .delete()
    .eq('user_id', user.id)
    .eq('shop_id_external', DEMO_TAG)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, cleared: true })
})

export const POST = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Reset any previous demo shop first so re-running is idempotent.
  await supabase.from('shops').delete().eq('user_id', user.id).eq('shop_id_external', DEMO_TAG)

  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .insert({
      user_id: user.id,
      name: 'DEMO — namuna do\'kon',
      marketplace: 'uzum',
      shop_id_external: DEMO_TAG,
      is_active: false,        // never picked up by the sync cron
      api_key_encrypted: null,
    })
    .select('id')
    .single()

  if (shopErr || !shop) {
    return NextResponse.json({ error: shopErr?.message ?? 'Could not create demo shop' }, { status: 500 })
  }
  const shopId = shop.id as string

  // ── Products ──────────────────────────────────────────────────────────────
  const productDefs = PRODUCT_NAMES.map((title, i) => {
    const cat = CATEGORIES[i % CATEGORIES.length]
    const selling = roundTo(rnd(cat.min, cat.max), 1000)
    const cost    = roundTo(selling * rnd(0.45, 0.70), 1000)   // real margin
    return {
      shop_id: shopId,
      sku: `DEMO-SKU-${100 + i}`,
      title,
      category: cat.name,
      cost_price: cost,
      selling_price: selling,
      stock_quantity: rndInt(0, 140),
      marketplace_product_id: `demo-${100 + i}`,
      // each product gets a demand profile that shapes its monthly variability
      _profile: pick(['steady', 'steady', 'variable', 'erratic'] as const),
    }
  })

  const { data: insertedProducts, error: prodErr } = await supabase
    .from('products')
    .insert(productDefs.map(({ _profile, ...p }) => p))
    .select('id, sku, selling_price, cost_price, title')

  if (prodErr || !insertedProducts) {
    await supabase.from('shops').delete().eq('id', shopId)
    return NextResponse.json({ error: prodErr?.message ?? 'product insert failed' }, { status: 500 })
  }
  const profileBySku = new Map(productDefs.map(p => [p.sku, p._profile]))
  const products = insertedProducts.map(p => ({
    ...p,
    profile: profileBySku.get(p.sku as string) ?? 'steady',
  }))

  // ── Orders + items over the last ~6 months ─────────────────────────────────
  const DAYS = 183
  type OrderRow = {
    shop_id: string; order_id_external: string; marketplace: 'uzum'
    status: typeof STATUSES[number]; revenue: number; marketplace_fee: number
    delivery_cost: number; items_count: number; ordered_at: string
  }
  const orderRows: OrderRow[] = []
  const itemsByExternal = new Map<string, { product_id: string; quantity: number; price_per_unit: number; cost_per_unit: number }[]>()

  let seq = 0
  for (let d = DAYS; d >= 0; d--) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    const month = date.getMonth()
    // gentle seasonality: more orders in recent months + a Q4-ish bump
    const seasonal = 1 + 0.4 * Math.sin((month / 12) * Math.PI * 2)
    const ordersToday = Math.random() < 0.55 ? rndInt(0, Math.round(3 * seasonal)) : 0

    for (let o = 0; o < ordersToday; o++) {
      const ext = `DEMO-${seq++}`
      const lineCount = rndInt(1, 3)
      const items: { product_id: string; quantity: number; price_per_unit: number; cost_per_unit: number }[] = []
      let revenue = 0
      for (let li = 0; li < lineCount; li++) {
        const p = pick(products)
        // quantity influenced by demand profile → drives XYZ variability
        const baseQty = p.profile === 'steady' ? 2 : p.profile === 'variable' ? rndInt(1, 4) : rndInt(0, 6)
        const qty = Math.max(1, baseQty)
        const price = Number(p.selling_price)
        revenue += price * qty
        items.push({
          product_id: p.id as string,
          quantity: qty,
          price_per_unit: price,
          cost_per_unit: Number(p.cost_price),
        })
      }
      const status = pick(STATUSES)
      orderRows.push({
        shop_id: shopId,
        order_id_external: ext,
        marketplace: 'uzum',
        status,
        revenue: Math.round(revenue),
        marketplace_fee: Math.round(revenue * 0.15),   // real Uzum-like commission
        delivery_cost: items.length * 5000,
        items_count: items.length,
        ordered_at: date.toISOString(),
      })
      itemsByExternal.set(ext, items)
    }
  }

  // Insert orders, get ids back, then map items
  for (let i = 0; i < orderRows.length; i += 500) {
    const batch = orderRows.slice(i, i + 500)
    const { data: ins, error } = await supabase.from('orders').insert(batch).select('id, order_id_external')
    if (error || !ins) continue
    const itemRows: { order_id: string; product_id: string; quantity: number; price_per_unit: number; cost_per_unit: number }[] = []
    for (const row of ins) {
      const items = itemsByExternal.get(row.order_id_external as string) ?? []
      for (const it of items) itemRows.push({ order_id: row.id as string, ...it })
    }
    for (let j = 0; j < itemRows.length; j += 500) {
      await supabase.from('order_items').insert(itemRows.slice(j, j + 500))
    }
  }

  // ── Ad campaigns (real DRR/CTR shape) ──────────────────────────────────────
  const adRows = products.slice(0, 6).map((p, i) => {
    const impressions = rndInt(4_000, 60_000)
    const ctr = rnd(1.5, 7.5)
    const clicks = Math.round(impressions * (ctr / 100))
    const spend = roundTo(rnd(80_000, 900_000), 1000)
    const orders = rndInt(5, 90)
    const revenue = orders * Number(p.selling_price)
    return {
      shop_id: shopId,
      external_id: `demo-camp-${i}`,
      name: `${p.title} — reklama`,
      type: i % 2 === 0 ? 'cpc' : 'cpo',
      status: 'active',
      product_title: p.title,
      spend,
      impressions,
      clicks,
      ctr: Number(ctr.toFixed(2)),
      orders,
      revenue,
      drr: Number(((spend / revenue) * 100).toFixed(2)),
      start_date: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
    }
  })
  await supabase.from('ad_campaigns').insert(adRows)

  // ── Search phrases ─────────────────────────────────────────────────────────
  const PHRASES = ['quloqchin', 'smart soat', 'power bank', 'futbolka', 'krossovka', 'krem', 'shampun', 'termos', 'gantel', 'kolonka']
  const phraseRows = PHRASES.map((phrase, i) => {
    const p = products[i % products.length]
    const impressions = rndInt(2_000, 40_000)
    const clicks = Math.round(impressions * rnd(0.02, 0.12))
    const orders = Math.round(clicks * rnd(0.03, 0.15))
    return {
      shop_id: shopId,
      product_id: p.id,
      product_title: p.title,
      phrase,
      impressions,
      clicks,
      ctr: Number(((clicks / impressions) * 100).toFixed(2)),
      orders,
      spend: roundTo(clicks * rnd(200, 900), 1000),
    }
  })
  await supabase.from('search_phrases').insert(phraseRows)

  await supabase.from('shops').update({ last_synced_at: new Date().toISOString() }).eq('id', shopId)

  return NextResponse.json({
    ok: true,
    products: products.length,
    orders: orderRows.length,
    campaigns: adRows.length,
  })
})
