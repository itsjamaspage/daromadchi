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

  const { data: settings } = await supabase
    .from('user_settings')
    .select('alert_stock_threshold')
    .eq('user_id', user.id)
    .single()

  const threshold = settings?.alert_stock_threshold ?? 15

  const { data, error } = await supabase
    .from('products')
    .select('id, title, sku, stock_quantity, sold, marketplace')
    .eq('user_id', user.id)
    .lte('stock_quantity', threshold)

  if (error || !data) return []

  const PERIOD_DAYS = 30
  return data.map((row: Record<string, unknown>) => {
    const dailySales = Number(row.sold ?? 0) / PERIOD_DAYS
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
      marketplace:  (row.marketplace as 'uzum' | 'yandex_market') ?? 'uzum',
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
