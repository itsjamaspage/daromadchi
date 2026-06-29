import { createAdminClient } from '@/lib/supabase/admin'

export async function clearShopData(shopId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: orderIds } = await admin
    .from('orders')
    .select('id')
    .eq('shop_id', shopId)

  if (orderIds && orderIds.length > 0) {
    await admin.from('order_items').delete().in('order_id', orderIds.map((o: { id: string }) => o.id))
  }

  await Promise.all([
    admin.from('orders').delete().eq('shop_id', shopId),
    admin.from('products').delete().eq('shop_id', shopId),
    admin.from('sync_days').delete().eq('shop_id', shopId),
    admin.from('ad_campaigns').delete().eq('shop_id', shopId),
    admin.from('search_phrases').delete().eq('shop_id', shopId),
    admin.from('product_ads_stats').delete().eq('shop_id', shopId),
  ])
}
