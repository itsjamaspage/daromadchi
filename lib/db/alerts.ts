import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'
import type { StockAlert } from '@/lib/types'

export type { StockAlert }

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getStockAlerts(): Promise<StockAlert[]> {
  if (!supabaseConfigured) return []

  const userId = await getCurrentUserId()
  if (!userId) return []

  const supabase = createAdminClient()
  const [{ data: settings }, { data: shopRows }] = await Promise.all([
    supabase.from('user_settings').select('alert_stock_threshold').eq('user_id', userId).single(),
    supabase.from('shops').select('id, marketplace, warehouse_id').eq('user_id', userId).neq('shop_id_external', 'DEMO'),
  ])

  const threshold = settings?.alert_stock_threshold ?? 15
  const shopIds = (shopRows ?? []).map((s: { id: string }) => s.id)
  if (shopIds.length === 0) return []

  const shopInfo = new Map<string, { marketplace: string; warehouseId: string | null }>()
  for (const s of shopRows ?? []) {
    shopInfo.set(s.id as string, { marketplace: s.marketplace as string, warehouseId: (s.warehouse_id as string | null) ?? null })
  }

  // Fetch ALL products — we calculate available_stock after warehouse grouping, then filter
  const { data, error } = await supabase
    .from('products')
    .select('id, title, sku, stock_quantity, shop_id')
    .in('shop_id', shopIds)

  if (error || !data || data.length === 0) return []

  // Estimate daily sales from order_items over the last 30 days
  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const productIds = (data as { id: string }[]).map(p => p.id)

  const salesMap = new Map<string, number>()
  try {
    const { data: salesData } = await supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(ordered_at)')
      .in('product_id', productIds)
      .gte('orders.ordered_at', since30.toISOString())
    for (const row of salesData ?? []) {
      const pid = row.product_id as string
      salesMap.set(pid, (salesMap.get(pid) ?? 0) + Number(row.quantity))
    }
  } catch { /* best-effort */ }

  // Build warehouse+SKU sold totals and shop counts
  const groupTotalSold = new Map<string, number>()
  const groupShopCount = new Map<string, number>()
  for (const p of data as Record<string, unknown>[]) {
    if (!p.sku) continue
    const wid = shopInfo.get(String(p.shop_id))?.warehouseId
    if (!wid) continue
    const key = `${wid}:${p.sku}`
    groupTotalSold.set(key, (groupTotalSold.get(key) ?? 0) + (salesMap.get(String(p.id)) ?? 0))
    groupShopCount.set(key, (groupShopCount.get(key) ?? 0) + 1)
  }

  const PERIOD_DAYS = 30
  const alerts: StockAlert[] = []

  for (const row of data as Record<string, unknown>[]) {
    const wid      = shopInfo.get(String(row.shop_id))?.warehouseId
    const key      = wid && row.sku ? `${wid}:${String(row.sku)}` : null
    const isShared = key ? (groupShopCount.get(key) ?? 0) > 1 : false

    const availableStock = isShared && key
      ? Math.max(0, Number(row.stock_quantity) - (groupTotalSold.get(key) ?? 0))
      : Number(row.stock_quantity)

    if (availableStock > threshold) continue

    const sold       = salesMap.get(String(row.id)) ?? 0
    const dailySales = sold / PERIOD_DAYS
    const daysLeft   = dailySales > 0 ? Math.floor(availableStock / dailySales) : 999

    alerts.push({
      productId:    String(row.id),
      productTitle: String(row.title),
      sku:          String(row.sku ?? ''),
      currentStock: availableStock,
      threshold,
      daysLeft,
      dailySales:   Math.round(dailySales * 10) / 10,
      marketplace:  (shopInfo.get(String(row.shop_id))?.marketplace ?? 'uzum') as StockAlert['marketplace'],
      isShared,
    })
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
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
  if (!supabaseConfigured) return defaultAlertSettings

  const userId = await getCurrentUserId()
  if (!userId) return defaultAlertSettings

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_settings')
    .select('alert_stock_threshold, telegram_bot_token, telegram_chat_id')
    .eq('user_id', userId)
    .single()

  if (!data) return defaultAlertSettings
  return {
    stockThreshold:   Number(data.alert_stock_threshold ?? 15),
    telegramBotToken: String(data.telegram_bot_token ?? ''),
    telegramChatId:   String(data.telegram_chat_id ?? ''),
  }
}

export async function saveAlertSettings(s: AlertSettings): Promise<void> {
  if (!supabaseConfigured) return

  const userId = await getCurrentUserId()
  if (!userId) return

  const supabase = createAdminClient()
  await supabase.from('user_settings').upsert({
    user_id:               userId,
    alert_stock_threshold: s.stockThreshold,
    telegram_bot_token:    s.telegramBotToken,
    telegram_chat_id:      s.telegramChatId,
    updated_at:            new Date().toISOString(),
  })
}
