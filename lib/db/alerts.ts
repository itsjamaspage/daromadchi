import { eq, and, ne, or, isNull, inArray, gte, sql } from 'drizzle-orm'
import { db, shops, products, orderItems, orders, userSettings } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { StockAlert, MarketplaceType } from '@/lib/types'

export type { StockAlert }

export async function getStockAlerts(): Promise<StockAlert[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const [settingsRows, shopRows] = await Promise.all([
    db.select({ alert_stock_threshold: userSettings.alert_stock_threshold })
      .from(userSettings).where(eq(userSettings.user_id, userId)).limit(1),
    db.select({ id: shops.id, marketplace: shops.marketplace, warehouse_id: shops.warehouse_id })
      .from(shops).where(and(eq(shops.user_id, userId), or(isNull(shops.shop_id_external), ne(shops.shop_id_external, 'DEMO')))),
  ])

  const threshold = settingsRows[0]?.alert_stock_threshold ?? 15
  const shopIds = shopRows.map(s => s.id)
  if (shopIds.length === 0) return []

  const shopInfo = new Map<string, { marketplace: string; warehouseId: string | null }>()
  for (const s of shopRows) {
    shopInfo.set(s.id, { marketplace: s.marketplace, warehouseId: s.warehouse_id })
  }

  const productRows = await db.select({
    id: products.id,
    title: products.title,
    sku: products.sku,
    stock_quantity: products.stock_quantity,
    shop_id: products.shop_id,
  }).from(products).where(inArray(products.shop_id, shopIds))

  if (productRows.length === 0) return []

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const productIds = productRows.map(p => p.id)

  const salesMap = new Map<string, number>()
  try {
    const salesRows = await db.select({
      product_id: orderItems.product_id,
      quantity: orderItems.quantity,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.order_id, orders.id))
      .where(and(
        inArray(orderItems.product_id, productIds),
        gte(orders.ordered_at, since30),
      ))
    for (const row of salesRows) {
      if (!row.product_id) continue
      salesMap.set(row.product_id, (salesMap.get(row.product_id) ?? 0) + (row.quantity ?? 0))
    }
  } catch { /* best-effort */ }

  const groupTotalSold = new Map<string, number>()
  const groupShopCount = new Map<string, number>()
  for (const p of productRows) {
    if (!p.sku) continue
    const wid = shopInfo.get(p.shop_id)?.warehouseId
    if (!wid) continue
    const key = `${wid}:${p.sku}`
    groupTotalSold.set(key, (groupTotalSold.get(key) ?? 0) + (salesMap.get(p.id) ?? 0))
    groupShopCount.set(key, (groupShopCount.get(key) ?? 0) + 1)
  }

  const PERIOD_DAYS = 30
  const result: StockAlert[] = []

  for (const row of productRows) {
    const wid = shopInfo.get(row.shop_id)?.warehouseId
    const key = wid && row.sku ? `${wid}:${row.sku}` : null
    const isShared = key ? (groupShopCount.get(key) ?? 0) > 1 : false

    const availableStock = isShared && key
      ? Math.max(0, row.stock_quantity - (groupTotalSold.get(key) ?? 0))
      : row.stock_quantity

    if (availableStock > threshold) continue

    const sold = salesMap.get(row.id) ?? 0
    const dailySales = sold / PERIOD_DAYS
    const daysLeft = dailySales > 0 ? Math.floor(availableStock / dailySales) : 999

    result.push({
      productId:    row.id,
      productTitle: row.title,
      sku:          row.sku ?? '',
      currentStock: availableStock,
      threshold,
      daysLeft,
      dailySales:   Math.round(dailySales * 10) / 10,
      marketplace:  (shopInfo.get(row.shop_id)?.marketplace ?? 'uzum') as MarketplaceType,
      isShared,
    })
  }

  return result.sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface AlertSettings {
  stockThreshold: number
  telegramBotToken: string
  telegramChatId: string
}

const defaultAlertSettings: AlertSettings = {
  stockThreshold: 15,
  telegramBotToken: '',
  telegramChatId: '',
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const userId = await getCurrentUserId()
  if (!userId) return defaultAlertSettings

  const rows = await db.select({
    alert_stock_threshold: userSettings.alert_stock_threshold,
    telegram_bot_token: userSettings.telegram_bot_token,
    telegram_chat_id: userSettings.telegram_chat_id,
  }).from(userSettings).where(eq(userSettings.user_id, userId)).limit(1)

  if (rows.length === 0) return defaultAlertSettings
  return {
    stockThreshold:   rows[0].alert_stock_threshold ?? 15,
    telegramBotToken: rows[0].telegram_bot_token ?? '',
    telegramChatId:   rows[0].telegram_chat_id ?? '',
  }
}

export async function saveAlertSettings(s: AlertSettings): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) return

  await db.insert(userSettings).values({
    user_id:               userId,
    alert_stock_threshold: s.stockThreshold,
    telegram_bot_token:    s.telegramBotToken,
    telegram_chat_id:      s.telegramChatId,
    updated_at:            new Date(),
  }).onConflictDoUpdate({
    target: userSettings.user_id,
    set: {
      alert_stock_threshold: sql`excluded.alert_stock_threshold`,
      telegram_bot_token:    sql`excluded.telegram_bot_token`,
      telegram_chat_id:      sql`excluded.telegram_chat_id`,
      updated_at:            sql`excluded.updated_at`,
    },
  })
}
