export type MarketplaceType = 'uzum' | 'yandex_market'
export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'returned'
export type SyncStatus = 'success' | 'error'

// ── Unit Economics ────────────────────────────────────────────────────────────
export interface UnitEconomicsItem {
  id: string
  title: string
  image?: string
  sku?: string
  category?: string
  marketplace: MarketplaceType
  sellingPrice: number
  costPrice: number
  commissionPct: number
  commission: number
  delivery: number
  lastMile: number
  acquiring: number
  adSpend: number
  tax: number
  netProfit: number
  roi: number
  margin: number
  stock?: number
  weight?: number
  supplierUrl?: string
  productUrl?: string
  addedAt: string
}

export interface UnitEcoSettings {
  acquiringPct: number
  lastMilePct: number
  adPct: number
  taxPct: number
  taxType: 'income' | 'income_minus_expense'
  defaultCommissionPct: number
}

// ── Advertising ───────────────────────────────────────────────────────────────
export type AdType = 'cpc' | 'cpo'
export type AdStatus = 'active' | 'paused' | 'stopped'

export interface AdCampaign {
  id: string
  name: string
  type: AdType
  status: AdStatus
  productTitle: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  orders: number
  revenue: number
  drr: number
  startDate: string
}

// ── Search Phrases ────────────────────────────────────────────────────────────
export interface SearchPhrase {
  id: string
  productId: string
  productTitle: string
  phrase: string
  impressions: number
  clicks: number
  ctr: number
  orders: number
  spend: number
}

// ── Data State ────────────────────────────────────────────────────────────────
export type SyncDayStatus = 'ready' | 'error' | 'degraded' | 'pending'

export interface SyncDay {
  date: string
  status: SyncDayStatus
  productsCount?: number
  revenue?: number
  adSpend?: number
  errorMessage?: string
}

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
  category: string | null
  marketplace_product_id: string | null
  updated_at: string
  // computed
  profit: number
  sold?: number
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
}
