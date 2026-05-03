export type OrderStatus = 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface Product {
  id: number
  user_id: string
  name: string
  sku: string
  category: string
  price: number
  cost: number
  stock: number
  created_at: string
  // computed
  profit: number
  sold?: number
}

export interface Order {
  id: number
  user_id: string
  order_ref: string
  customer: string
  product_name: string
  amount: number
  status: OrderStatus
  ordered_at: string
  created_at: string
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
