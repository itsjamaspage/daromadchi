import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAuthUser, getShopIds, getUserPlan } from '@/lib/api/auth'
import { sendTelegramMessage, isInNotificationWindow } from '@/lib/telegram'

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await getUserPlan(user.id)
  if (plan === 'free') {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('telegram_chat_id, notification_time')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!settings?.telegram_chat_id) {
    return NextResponse.json({ error: 'Telegram ulanmagan' }, { status: 400 })
  }

  // Only send if we're within ±30 min of the user's chosen notification window
  if (!isInNotificationWindow(settings.notification_time ?? null)) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'outside_window' })
  }

  const shopIds = await getShopIds(user.id)
  if (shopIds.length === 0) {
    return NextResponse.json({ error: 'Do\'kon topilmadi' }, { status: 400 })
  }

  const since24h = new Date(Date.now() - 86400000)

  const [ordersRes, lowStockRes] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('revenue, marketplace_fee, delivery_cost, items_count, status')
      .in('shop_id', shopIds)
      .gte('ordered_at', since24h.toISOString()),
    supabaseAdmin
      .from('products')
      .select('title, stock_quantity')
      .in('shop_id', shopIds)
      .lte('stock_quantity', 5)
      .order('stock_quantity', { ascending: true })
      .limit(5),
  ])

  type OrderRow = { revenue: string | null; marketplace_fee: string | null; delivery_cost: string | null; items_count: number; status: string }
  const orders   = (ordersRes.data ?? []) as OrderRow[]
  const active   = orders.filter(o => o.status !== 'cancelled')
  const returned = orders.filter(o => o.status === 'returned')

  const revenue    = active.reduce((s, o) => s + Number(o.revenue        ?? 0), 0)
  const commission = active.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0)
  const delivery   = active.reduce((s, o) => s + Number(o.delivery_cost  ?? 0), 0)
  const profit     = revenue - commission - delivery
  const lowStock   = lowStockRes.data ?? []

  const dateStr = new Date().toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const lines: string[] = [
    `📊 <b>Kunlik hisobot — ${dateStr}</b>`,
    ``,
    `💰 Daromad: <b>${fmt(revenue)}</b>`,
    `📈 Sof foyda: <b>${fmt(profit)}</b>`,
    `🛒 Buyurtmalar: <b>${active.length}</b>`,
  ]

  if (returned.length > 0) lines.push(`↩️ Qaytarilgan: <b>${returned.length}</b>`)

  if (lowStock.length > 0) {
    lines.push(``, `⚠️ <b>Kam zaxira:</b>`)
    for (const p of lowStock) {
      lines.push(`• ${p.title}: ${p.stock_quantity} dona`)
    }
  }

  lines.push(``, `<i>daromadchi.uz da to'liq tahlil</i>`)

  const ok = await sendTelegramMessage(settings.telegram_chat_id, lines.join('\n'))
  return NextResponse.json({ ok })
}
