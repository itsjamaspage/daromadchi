export type MarketplaceType = 'uzum' | 'yandex_market' | 'wildberries'

export interface AdsStatsSummary {
  impressions: number
  clicks: number
  spend: number
  orders_from_ads: number
  revenue_from_ads: number
  ctr: number   // clicks / impressions * 100
  cpc: number   // spend / clicks
  drr: number   // spend / revenue * 100
}
export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'returned'
export type SyncStatus = 'success' | 'error'

export interface Shop {
  id: string
  user_id: string
  name: string
  marketplace: MarketplaceType
  api_key_encrypted: string | null
  shop_id_external: string | null
  is_active: boolean
  last_synced_at: string | null
  created_at: string
}

export interface Product {
  id: string
  shop_id: string
  sku: string | null
  title: string
  cost_price: number | null
  selling_price: number | null
  stock_quantity: number
  physical_stock: number | null  // user-set total physical inventory
  available_stock: number        // physical_stock - sold_across_all_sku_shops, or stock_quantity
  category: string | null
  marketplace_product_id: string | null
  updated_at: string
  // computed
  profit: number
  sold: number
  is_shared: boolean             // true when physical_stock links across marketplaces
}

export interface Order {
  id: string
  shop_id: string
  order_id_external: string | null
  marketplace: MarketplaceType
  status: OrderStatus
  revenue: number | null
  marketplace_fee: number | null
  delivery_cost: number | null
  items_count: number
  ordered_at: string
}

export interface DailyRevenue {
  date: string
  revenue: number
  order_count: number
}

export interface Kpis {
  total_revenue: number
  total_profit: number
  total_orders: number
  total_stock: number
  change_revenue?: number | null  // % vs prior period
  change_profit?: number | null
  change_orders?: number | null
}
