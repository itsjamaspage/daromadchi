import { createClient } from '@/lib/supabase/server'
import type { StockAlert } from '@/lib/types'

export type { StockAlert }

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getStockAlerts(): Promise<StockAlert[]> {
  if (!supabaseConfigured) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [{ data: settings }, { data: shopRows }] = await Promise.all([
    supabase.from('user_settings').select('alert_stock_threshold').eq('user_id', user.id).single(),
    supabase.from('shops').select('id, marketplace').eq('user_id', user.id),
  ])

  const threshold = settings?.alert_stock_threshold ?? 15
  const shopIds = (shopRows ?? []).map((s: { id: string }) => s.id)
  if (shopIds.length === 0) return []

  const shopMarketplace = new Map<string, string>()
  for (const s of shopRows ?? []) shopMarketplace.set(s.id as string, s.marketplace as string)

  const { data, error } = await supabase
    .from('products')
    .select('id, title, sku, stock_quantity, shop_id')
    .in('shop_id', shopIds)
    .lte('stock_quantity', threshold)

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

  const PERIOD_DAYS = 30
  return (data as Record<string, unknown>[]).map(row => {
    const totalSold = salesMap.get(String(row.id)) ?? 0
    const dailySales = totalSold / PERIOD_DAYS
    const daysLeft = dailySales > 0
      ? Math.floor(Number(row.stock_quantity) / dailySales)
      : 999
    return {
      productId:    String(row.id),
      productTitle: String(row.title),
      sku:          String(row.sku ?? ''),
      currentStock: Number(row.stock_quantity),
      threshold,
      daysLeft,
      dailySales:   Math.round(dailySales * 10) / 10,
      marketplace:  (shopMarketplace.get(String(row.shop_id)) ?? 'uzum') as 'uzum' | 'yandex_market',
    }
  }).sort((a, b) => a.daysLeft - b.daysLeft)
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return defaultAlertSettings

  const { data } = await supabase
    .from('user_settings')
    .select('alert_stock_threshold, telegram_bot_token, telegram_chat_id')
    .eq('user_id', user.id)
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('user_settings').upsert({
    user_id:               user.id,
    alert_stock_threshold: s.stockThreshold,
    telegram_bot_token:    s.telegramBotToken,
    telegram_chat_id:      s.telegramChatId,
    updated_at:            new Date().toISOString(),
  })
}
