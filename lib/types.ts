export type MarketplaceType = 'uzum' | 'yandex_market'

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
  /** per-unit cost of bringing the product from the supplier (e.g. China):
   *  cargo/customs/freight — separate from costPrice (purchase price) */
  landedCost?: number
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
  // Marker set when commissionPct / delivery were computed from the
  // seller's own settlement history (Yandex netting or Uzum
  // finance/orders) instead of a hard-coded percentage default.
  // UnitEconomicsTable shows an "R" badge when this is 'real' — sellers
  // can tell at a glance which rows carry real marketplace fees vs.
  // still-unmapped ones using the default estimate.
  ratesSource?: 'real' | 'default'
  /** Number of settled items backing the real rate (only when ratesSource='real'). */
  ratesSourceItemCount?: number
  /** Derived at read time — never persisted. Money the seller invested
   *  upfront (purchase price + landed logistics to warehouse). This is
   *  what ROI divides by. */
  directTotal?: number
  /** Derived at read time — never persisted. Sum of every fee the
   *  marketplace subtracts from each sale (commission + delivery +
   *  lastMile + acquiring + adSpend + tax). */
  turnoverTotal?: number
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
  token_valid: boolean | null
  last_synced_at: string | null
  created_at: string
  warehouse_id?: string | null
  // Yandex Market only — the seller's businessId (distinct from campaignId).
  // Netting/settlement APIs are scoped to businessId, so we expose it in the
  // Settings UI as a separate field.
  business_id?: string | null
  // Rate-limit cooldown persisted from the sync code. Currently only
  // Wildberries writes to this; the settings card surfaces it as a
  // "throttled until X" chip with a manual reset button.
  throttled_until?: string | null
  // ── Stock-sync (edit) mode — opt-in, OFF by default ─────────────────────
  // 'read_only' never writes to the marketplace; 'stock_sync' opts this shop
  // into the audited stock-quantity-only writer.
  api_mode?: 'read_only' | 'stock_sync'
  // Dry-run ("Test mode"): logs the intended store write, sends nothing.
  stock_sync_dry_run?: boolean
  oversell_mode?: 'lock_last_unit' | 'partition' | 'off'
  primary_channel_priority?: number
  // When the user consented to edit mode for this shop (ISO string).
  stock_sync_consent_at?: string | null
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
  // Seller-entered display overrides (migration 083). NULL = show the
  // marketplace value. Kept SEPARATE from selling_price / available_stock on
  // purpose: those feed the stock engine, turnover and the Products page, and
  // an Analytics display preference must not leak into any of them.
  price_override?: number | null
  stock_override?: number | null
  category: string | null
  marketplace_product_id: string | null
  marketplace?: MarketplaceType
  // 'fbs' | 'fbo' | 'fby' | null (unknown → sync hasn't run or not exposed)
  fulfillment_type: string | null
  updated_at: string
  // computed
  /**
   * Per-unit profit: selling price − cost price. NULL when the seller has not
   * entered a cost — not 0, which would present the whole selling price as
   * profit and the margin beside it as 100%.
   */
  profit: number | null
  sold: number                   // marketplace lifetime sold counter (or DB fallback)
  delivered: number              // units actually delivered (same formula as analytics)
  in_transit: number             // units on open orders (pending/confirmed) + counter surplus
  cancelled: number              // units on cancelled orders
  is_shared: boolean             // true when physical_stock links across marketplaces
  is_archived?: boolean          // Uzum-archived listing; only true rows appear in the "Архивные" tab
  variant_group_key?: string | null // marketplace-namespaced parent key (Phases 1/3)
  variant_color?: string | null     // resolved colour key for the per-variant label (Phase 1.5)
  // Total physical inventory across every listing sharing this SKU.
  // For shared-FBS SKUs (one warehouse, listed on multiple marketplaces)
  // this is the max across per-marketplace stocks. For non-shared SKUs
  // it equals this row's own stock. Populated so the Products page can
  // show "per-listing / physical total" side-by-side without hiding the
  // wider inventory picture. See lib/db/products.ts for the derivation.
  total_physical: number
}

export interface Order {
  id: string
  shop_id: string
  order_id_external: string | null
  marketplace: MarketplaceType
  fulfillment_type: string | null  // 'fbs' | 'fbo' | 'dbs' | …
  status: OrderStatus
  // The marketplace's own status verbatim. `status` decides the lifecycle;
  // this decides which of the two `confirmed` meanings to SHOW — packed but not
  // shipped, versus actually on the way. See lib/marketplace/order-display-status.ts.
  marketplace_status?: string | null
  revenue: number | null
  marketplace_fee: number | null
  delivery_cost: number | null
  items_count: number
  ordered_at: string
  shop_id_external?: string | null
  business_id?: string | null
}

export interface DailyRevenue {
  date: string
  revenue: number
  order_count: number
}

export interface Kpis {
  total_revenue: number
  total_profit: number
  /** The parts total_profit is made of: revenue − cogs − fees = profit. Shown
   *  on the card so a low number explains itself instead of looking broken. */
  profit_cogs?: number
  profit_fees?: number
  /** Sales behind total_profit — the counted subset. total_revenue still shows
   *  every sale; this is what the breakdown under the profit adds up from. */
  profit_revenue_counted?: number
  /** Distinct products sold in the period with no cost_price entered. Their
   *  cost counts as zero, so profit is OVERSTATED by whatever they cost.
   *  NOTE: this count spans ALL delivered items, both counted and pending
   *  marketplaces — it is only the display count, never the trigger. Whether a
   *  missing cost actually affects the shown profit is cost_missing_revenue. */
  missing_cost_products?: number
  /** Of the COUNTED revenue (profit_revenue_counted), how much sits on orders
   *  whose cost is unknown — the counted-scope figure the profit card tiers on.
   *  net ≤ revenue − commission always (cost ≥ 0), so a large share here means
   *  the shown "profit" is really an upper bound / gross margin, not net. */
  cost_missing_revenue?: number
  cost_missing_orders?: number
  /** Marketplaces whose money is in total_profit. */
  counted_marketplaces?: string[]
  /** Marketplaces with delivered sales the marketplace has not reported money
   *  for yet (Yandex publishes commission only in the netting report, days
   *  later). Excluded from the profit and named under it instead. */
  pending_marketplaces?: {
    marketplace: string
    revenue: number
    orders: number
    /** Why it is not counted: the marketplace has not reported the fee yet, or
     *  the seller has not entered a cost. Different instructions to the seller. */
    reason: 'fee_not_reported' | 'cost_not_set'
  }[]
  total_orders: number            // every order received, incl. cancelled
  cancelled_orders?: number       // subset of total_orders that were cancelled
  cancelled_units?: number        // item units on those cancelled orders
  total_stock: number
  change_revenue?: number | null  // % vs prior period
  change_profit?: number | null
  change_orders?: number | null
}

// ── Stock alerts ──────────────────────────────────────────────────────────────
export interface StockAlert {
  productId: string
  productTitle: string
  sku: string
  currentStock: number   // per-listing available stock (matches the marketplace's own cabinet)
  threshold: number
  daysLeft: number       // estimated days until stockout at current sales rate
  dailySales: number     // avg daily sales
  marketplace: MarketplaceType
  isShared?: boolean     // true when stock is pooled across a warehouse
  totalPhysical?: number // total physical stock in seller warehouse across all listings sharing this SKU
  variant_group_key?: string | null // marketplace-namespaced parent key (variant grouping)
  variant_color?: string | null     // resolved colour key for the per-variant label
}

// ── Payouts ───────────────────────────────────────────────────────────────────
export interface PayoutOrderItem {
  productTitle: string
  sku: string | null
  qty: number
  revenue: number
  orderCount: number
}

// A single settled order inside a payout period, named. Sourced from each
// marketplace's Finance/settlement data (Yandex netting, Uzum finance/orders)
// — NOT the Orders feed — so the number+name matches what the seller sees in
// the cabinet's финансы/финансовые отчёты. `name` is null when the product
// title can't be resolved for the order's SKU (graceful — number still shows).
export interface PayoutOrderLine {
  number: string
  name: string | null
  net: number
  /**
   * Settlement state of THIS order, not of the month it sits in.
   *
   * A month is routinely part-transferred, and one status cannot describe it:
   * before, one transfer marked the whole month paid (over-reporting the
   * in-transit rows); after, one in-transit row marked the whole month pending
   * (hiding money the bank had already sent). Both were the same mistake at
   * different ends. Status belongs on the order, which is the unit the
   * marketplace actually transfers.
   */
  status: PayoutStatus
  /**
   * Uzum's own status for THIS order, when the row is Uzum's. Null for Yandex,
   * whose settlement is proven per order by its payment-order number and whose
   * badge keeps reading `status` above.
   *
   * Shown instead of the derived PayoutStatus because "earned" was a placeholder
   * standing in for a state Uzum names precisely. Nothing downstream reads it —
   * every KPI still totals from `status`.
   */
  uzumStatus?: UzumOrderStatus | null
}

// Settlement/payout state for a payout row. Driven by real marketplace signals,
// never the calendar (a past month proves nothing about whether money moved).
//   available_to_withdraw — Uzum TO_WITHDRAW: earned, withdrawable, NOT withdrawn.
//   fees_pending          — Yandex settled credit posted but fee debits not yet
//                           final (stays inside the pending bucket, flagged).
//   paid / estimated_paid — reserved; NOT emitted by the settled branches today
//                           (no accessible Uzum payout-history feed — 403 RBAC;
//                           no Yandex order-level withdrawal feed). See
//                           docs/plans/payouts-settlement-accuracy.md.
//   processing            — legacy, deprecated; kept for back-compat, not emitted.
/**
 * Uzum's own per-order-item settlement state, exactly as /v1/finance/orders
 * reports it. This is the complete enum — confirmed against Uzum's OpenAPI
 * document, see docs/evidence/uzum-seller-openapi-finance.md §4. TO_WITHDRAW
 * ("к выводу средств") is the LAST state the API defines: there is no
 * WITHDRAWN/PAID to wait for, because Uzum publishes no settlement signal.
 *
 * Display-only. It never feeds a KPI — PayoutStatus below still decides those.
 */
export type UzumOrderStatus = 'TO_WITHDRAW' | 'PROCESSING' | 'CANCELED' | 'PARTIALLY_CANCELLED'

export type PayoutStatus =
  | 'paid'
  | 'pending'
  | 'available_to_withdraw'
  | 'fees_pending'
  | 'estimated_paid'
  // A month whose orders are partly transferred and partly not. It exists so the
  // period row can stop pretending a mixed month is one thing; the truthful
  // per-order figures are in `orders`.
  | 'partially_paid'
  | 'estimated_pending'
  | 'processing'

export interface PayoutEntry {
  id: string
  period: string
  marketplace?: string
  grossRevenue: number
  commission: number
  delivery: number
  returns: number
  adSpend: number
  acquiring: number
  tax: number
  penalty: number
  storageFee: number
  additionalPayment: number
  otherDeductions: number
  netPayout: number
  ordersCount: number
  status: PayoutStatus
  /**
   * The period's Uzum status, rolled up from the orders inside it — see
   * rollUpUzumOrderStatus. Null for Yandex and for a period with no recognised
   * Uzum status, where the badge falls back to `status`.
   */
  uzumStatus?: UzumOrderStatus | null
  payoutDate: string | null
  payoutEstimated: boolean
  // Per-product breakdown of the orders that fed this payout period.
  // Grouped by product so 50 orders of the same SKU collapse into one row.
  items: PayoutOrderItem[]
  // Marketplace order numbers (orders.order_id_external) in this period, so a row
  // can be cross-referenced with the seller cabinet's order list.
  orderNumbers?: string[]
  // Yandex payment-order numbers («№ платежного поручения», e.g. 92735) for a
  // transferred (paid) period — the bank-statement reference that proves the
  // payout hit the account. Only populated once the netting shows «Переведён».
  paymentReferences?: string[]
  // Per-order named breakdown for this settled period: each order number paired
  // with its product name and net, sourced from the marketplace's Finance data.
  // Lets the seller read "which order, which product, how much" against the
  // cabinet's финансы view. Only set on the settled (real-data) branches.
  orders?: PayoutOrderLine[]
  // Actual first and last order dates in this payout period as
  // YYYY-MM-DD strings — used to render "when did these orders
  // happen" instead of the whole-month boundary. Both null if the
  // period has no non-cancelled orders.
  firstOrderDate: string | null
  lastOrderDate: string | null
  // True when the marketplace hasn't yet published real settlement
  // data for this period (currently: always true for Yandex Market).
  // When true the UI hides estimated commission/tax/ads/net numbers
  // and shows an "Ожидает данных" state instead — no fake numbers.
  awaitingSettlement: boolean
  /**
   * True when at least one item sold in this period has no cost price.
   * Different from awaitingSettlement: nothing is being waited on, the seller
   * can enter the cost themselves. `otherDeductions` (the COGS) counts only the
   * costed items, so it is a floor and `netPayout` is an optimistic ceiling.
   */
  cogsPartial: boolean
}

export interface WatchlistItem {
  id: string
  label: string
  competitor_url: string | null
  my_product_title: string | null
  my_price: number | null
  last_competitor_price: number | null
  last_checked_at: string | null
  created_at: string
}

// ── Competitor price tracking ─────────────────────────────────────────────────
export interface CompetitorPrice {
  id: string
  productId: string
  productTitle: string
  sku: string
  myPrice: number
  minCompetitorPrice: number
  avgCompetitorPrice: number
  maxCompetitorPrice: number
  competitorCount: number
  pricePosition: 'lowest' | 'competitive' | 'high' | 'highest'
  priceDiff: number
  priceDiffPct: number
  lastChecked: string
  history: { date: string; myPrice: number; minPrice: number }[]
}
