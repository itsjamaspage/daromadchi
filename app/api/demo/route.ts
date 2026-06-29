import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api-handler'

// Clearly-labelled, removable sample data so the app can be evaluated without a
// real store. All demo shops share shop_id_external = 'DEMO'; deleting by that
// tag cascades away every demo row across all three marketplaces.

const DEMO_TAG = 'DEMO'

const CATEGORIES = [
  { name: 'Elektronika',  min: 150_000, max: 1_200_000 },
  { name: 'Kiyim',        min: 60_000,  max: 350_000 },
  { name: 'Kosmetika',    min: 30_000,  max: 220_000 },
  { name: "Uy-ro'zg'or",  min: 45_000,  max: 600_000 },
  { name: 'Sport',        min: 80_000,  max: 500_000 },
]

const UZUM_PRODUCTS = [
  'Simsiz quloqchin', 'Smart-soat', 'Power bank 20000mAh', 'Bluetooth kolonka',
  'Paxta futbolka', 'Jinsi shim', 'Sport krossovka', "Yomg'ir kurtka",
  'Yuz uchun krem', 'Shampun 500ml', 'Parfyumeriya nabori', 'Lab pomadasi',
  'Choynak elektr', 'Yostiq ortopedik', 'Adyol ikki kishilik', "Idishlar to'plami",
  'Gantel 10kg', 'Yoga gilamcha', 'Velosiped nasosi', 'Termos 1L',
]

const YM_PRODUCTS = [
  'Noutbuk 15.6"', 'Smartfon 128GB', 'Planshet 10"', 'Simsiz printer',
  'Ofis stuli', 'Monitor 24"', 'Klaviatura simsiz', 'Simsiz sichqoncha',
  'Veb-kamera HD', 'USB-C hub', 'SSD disk 512GB', 'Uyali zaryadlovchi',
]

const WB_PRODUCTS = [
  "Ayol ko'ylagi", 'Erkak ko\'ylagi', 'Sport kostyumi', 'Jogger shim',
  "Qish kurtka", 'Klassik palto', 'Krossovka yengil', 'Teri kamar',
  "Ipak ro'mol", "Termal ichki kiyim", "Ko'rikli libos", 'Klassik kostyum',
]

const STATUSES = ['delivered', 'delivered', 'delivered', 'delivered', 'confirmed', 'pending', 'cancelled', 'returned'] as const

type MarketplaceType = 'uzum' | 'yandex_market' | 'wildberries'

function rnd(min: number, max: number) { return Math.random() * (max - min) + min }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)) }
function pick<T>(arr: readonly T[]): T { return arr[rndInt(0, arr.length - 1)] }
function roundTo(n: number, step = 1000) { return Math.round(n / step) * step }

async function seedMarketplace(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  marketplace: MarketplaceType,
  shopName: string,
  productNames: string[],
  feeRate: number,     // marketplace commission rate
  dailyOrders: number, // max orders per day
) {
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .insert({
      user_id: userId,
      name: shopName,
      marketplace,
      shop_id_external: DEMO_TAG,
      is_active: false,
      api_key_encrypted: null,
    })
    .select('id')
    .single()

  if (shopErr || !shop) return null
  const shopId = shop.id as string

  const productDefs = productNames.map((title, i) => {
    const cat = CATEGORIES[i % CATEGORIES.length]
    const selling = roundTo(rnd(cat.min, cat.max), 1000)
    const cost    = roundTo(selling * rnd(0.45, 0.70), 1000)
    return {
      shop_id: shopId,
      sku: `DEMO-${marketplace.slice(0, 2).toUpperCase()}-${100 + i}`,
      title,
      category: cat.name,
      cost_price: cost,
      selling_price: selling,
      stock_quantity: rndInt(0, 120),
      marketplace_product_id: `demo-${marketplace}-${100 + i}`,
    }
  })

  const { data: insertedProducts, error: prodErr } = await supabase
    .from('products')
    .insert(productDefs)
    .select('id, sku, selling_price, cost_price')

  if (prodErr || !insertedProducts) {
    await supabase.from('shops').delete().eq('id', shopId)
    return null
  }

  const DAYS = 183
  type OrderRow = {
    shop_id: string; order_id_external: string; marketplace: MarketplaceType
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
    const seasonal = 1 + 0.4 * Math.sin((month / 12) * Math.PI * 2)
    const ordersToday = Math.random() < 0.55 ? rndInt(0, Math.round(dailyOrders * seasonal)) : 0

    for (let o = 0; o < ordersToday; o++) {
      const ext = `DEMO-${marketplace.slice(0, 2).toUpperCase()}-${seq++}`
      const lineCount = rndInt(1, 3)
      const items: { product_id: string; quantity: number; price_per_unit: number; cost_per_unit: number }[] = []
      let revenue = 0
      for (let li = 0; li < lineCount; li++) {
        const p = pick(insertedProducts)
        const qty = rndInt(1, 3)
        const price = Number(p.selling_price)
        revenue += price * qty
        items.push({ product_id: p.id as string, quantity: qty, price_per_unit: price, cost_per_unit: Number(p.cost_price) })
      }
      orderRows.push({
        shop_id: shopId,
        order_id_external: ext,
        marketplace,
        status: pick(STATUSES),
        revenue: Math.round(revenue),
        marketplace_fee: Math.round(revenue * feeRate),
        delivery_cost: items.length * 5000,
        items_count: items.length,
        ordered_at: date.toISOString(),
      })
      itemsByExternal.set(ext, items)
    }
  }

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

  await supabase.from('shops').update({ last_synced_at: new Date().toISOString() }).eq('id', shopId)
  return { products: insertedProducts.length, orders: orderRows.length }
}

export const DELETE = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Remove any existing demo data across all marketplaces
  await supabase.from('shops').delete().eq('user_id', user.id).eq('shop_id_external', DEMO_TAG)

  const [uzum, ym, wb] = await Promise.all([
    seedMarketplace(supabase, user.id, 'uzum',          "DEMO — Uzum do'kon",          UZUM_PRODUCTS, 0.15, 3),
    seedMarketplace(supabase, user.id, 'yandex_market', "DEMO — Yandex Market do'kon", YM_PRODUCTS,   0.07, 2),
    seedMarketplace(supabase, user.id, 'wildberries',   "DEMO — Wildberries do'kon",   WB_PRODUCTS,   0.17, 2),
  ])

  return NextResponse.json({
    ok: true,
    uzum:          uzum   ?? { error: 'failed' },
    yandex_market: ym     ?? { error: 'failed' },
    wildberries:   wb     ?? { error: 'failed' },
  })
})
