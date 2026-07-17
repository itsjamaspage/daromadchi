import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/session'
import { db, shops, products, orders, orderItems } from '@/lib/db'
import { withErrorHandler } from '@/lib/api-handler'

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
  userId: string,
  marketplace: MarketplaceType,
  shopName: string,
  productNames: string[],
  feeRate: number,
  dailyOrders: number,
) {
  const [shop] = await db.insert(shops).values({
    user_id: userId,
    name: shopName,
    marketplace,
    shop_id_external: DEMO_TAG,
    is_active: false,
    api_key_encrypted: null,
  }).returning({ id: shops.id })

  if (!shop) return null
  const shopId = shop.id

  const productDefs = productNames.map((title, i) => {
    const cat = CATEGORIES[i % CATEGORIES.length]
    const selling = roundTo(rnd(cat.min, cat.max), 1000)
    const cost    = roundTo(selling * rnd(0.45, 0.70), 1000)
    return {
      shop_id: shopId,
      sku: `DEMO-${marketplace.slice(0, 2).toUpperCase()}-${100 + i}`,
      title,
      category: cat.name,
      cost_price: String(cost),
      selling_price: String(selling),
      stock_quantity: rndInt(0, 120),
      marketplace_product_id: `demo-${marketplace}-${100 + i}`,
    }
  })

  const insertedProducts = await db.insert(products).values(productDefs)
    .returning({ id: products.id, sku: products.sku, selling_price: products.selling_price, cost_price: products.cost_price })

  if (!insertedProducts.length) {
    await db.delete(shops).where(eq(shops.id, shopId))
    return null
  }

  const DAYS = 183
  type OrderRow = {
    shop_id: string; order_id_external: string; marketplace: MarketplaceType
    status: typeof STATUSES[number]; revenue: string; marketplace_fee: string
    delivery_cost: string; items_count: number; ordered_at: Date
  }
  const orderRows: OrderRow[] = []
  const itemsByExternal = new Map<string, { product_id: string; quantity: number; price_per_unit: string; cost_per_unit: string }[]>()

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
      const items: { product_id: string; quantity: number; price_per_unit: string; cost_per_unit: string }[] = []
      let revenue = 0
      for (let li = 0; li < lineCount; li++) {
        const p = pick(insertedProducts)
        const qty = rndInt(1, 3)
        const price = Number(p.selling_price)
        revenue += price * qty
        items.push({ product_id: p.id, quantity: qty, price_per_unit: String(price), cost_per_unit: String(Number(p.cost_price)) })
      }
      orderRows.push({
        shop_id: shopId,
        order_id_external: ext,
        marketplace,
        status: pick(STATUSES),
        revenue: String(Math.round(revenue)),
        marketplace_fee: String(Math.round(revenue * feeRate)),
        delivery_cost: String(items.length * 5000),
        items_count: items.length,
        ordered_at: date,
      })
      itemsByExternal.set(ext, items)
    }
  }

  for (let i = 0; i < orderRows.length; i += 500) {
    const batch = orderRows.slice(i, i + 500)
    const ins = await db.insert(orders).values(batch)
      .returning({ id: orders.id, order_id_external: orders.order_id_external })

    const itemRows: { order_id: string; product_id: string; quantity: number; price_per_unit: string; cost_per_unit: string }[] = []
    for (const row of ins) {
      const items = itemsByExternal.get(row.order_id_external!) ?? []
      for (const it of items) itemRows.push({ order_id: row.id, ...it })
    }
    for (let j = 0; j < itemRows.length; j += 500) {
      await db.insert(orderItems).values(itemRows.slice(j, j + 500))
    }
  }

  await db.update(shops).set({ last_synced_at: new Date() }).where(eq(shops.id, shopId))
  return { products: insertedProducts.length, orders: orderRows.length }
}

export const DELETE = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.delete(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.shop_id_external, DEMO_TAG)))

  revalidateTag('product-data', 'max')
  revalidateTag('order-data', 'max')
  return NextResponse.json({ ok: true, cleared: true })
})

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.delete(shops)
    .where(and(eq(shops.user_id, user.id), eq(shops.shop_id_external, DEMO_TAG)))

  const [uzum, ym, wb] = await Promise.all([
    seedMarketplace(user.id, 'uzum',          "DEMO — Uzum do'kon",          UZUM_PRODUCTS, 0.15, 3),
    seedMarketplace(user.id, 'yandex_market', "DEMO — Yandex Market do'kon", YM_PRODUCTS,   0.07, 2),
    seedMarketplace(user.id, 'wildberries',   "DEMO — Wildberries do'kon",   WB_PRODUCTS,   0.17, 2),
  ])

  revalidateTag('product-data', 'max')
  revalidateTag('order-data', 'max')
  return NextResponse.json({
    ok: true,
    uzum:          uzum   ?? { error: 'failed' },
    yandex_market: ym     ?? { error: 'failed' },
    wildberries:   wb     ?? { error: 'failed' },
  })
})
