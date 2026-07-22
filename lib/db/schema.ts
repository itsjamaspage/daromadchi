import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

/* ── Enums ──────────────────────────────────────────────────────────────────── */

export const marketplaceTypeEnum = pgEnum('marketplace_type', [
  'uzum',
  'yandex_market',
  'wildberries',
])

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'delivered',
  'cancelled',
  'returned',
])

export const syncStatusEnum = pgEnum('sync_status', ['success', 'error'])

export const adTypeEnum = pgEnum('ad_type', ['cpc', 'cpo'])

export const adStatusEnum = pgEnum('ad_status', ['active', 'paused', 'stopped'])

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'cancelled',
  'failed',
])

export const syncDayStatusEnum = pgEnum('sync_day_status', [
  'ready',
  'success',
  'error',
  'degraded',
  'pending',
])

export const taxTypeEnum = pgEnum('tax_type', ['income', 'income_minus_expense'])

export const planTypeEnum = pgEnum('plan_type', ['free', 'pro', 'pro_plus'])

/* ── 1. users ───────────────────────────────────────────────────────────────── */

export const users = pgTable('users', {
  id:              uuid('id').primaryKey().defaultRandom(),
  email:           text('email').notNull(),
  full_name:       text('full_name'),
  phone:           text('phone'),
  password_hash:   text('password_hash'),
  email_verified:  timestamp('email_verified'),
  plan:            planTypeEnum('plan').default('free').notNull(),
  plan_expires_at: timestamp('plan_expires_at', { withTimezone: true }),
  trial_ends_at:   timestamp('trial_ends_at', { withTimezone: true }),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/* ── 2. warehouses ──────────────────────────────────────────────────────────── */

export const warehouses = pgTable('warehouses', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

/* ── 3. shops ───────────────────────────────────────────────────────────────── */

export const shops = pgTable('shops', {
  id:                uuid('id').primaryKey().defaultRandom(),
  user_id:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:              text('name').notNull(),
  marketplace:       marketplaceTypeEnum('marketplace').notNull(),
  api_key_encrypted: text('api_key_encrypted'),
  shop_id_external:  text('shop_id_external'),
  is_active:         boolean('is_active').default(true).notNull(),
  token_valid:       boolean('token_valid'),
  last_synced_at:    timestamp('last_synced_at', { withTimezone: true }),
  warehouse_id:      uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  created_at:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('shops_user_id_idx').on(t.user_id),
])

/* ── 4. products ────────────────────────────────────────────────────────────── */

export const products = pgTable('products', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  shop_id:                uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  sku:                    text('sku'),
  title:                  text('title').notNull(),
  cost_price:             numeric('cost_price'),
  selling_price:          numeric('selling_price'),
  stock_quantity:         integer('stock_quantity').default(0).notNull(),
  physical_stock:         integer('physical_stock'),
  // Marketplace-reported lifetime units sold (includes FBO orders we can't read
  // at the order level). Nullable until the next product sync populates it.
  quantity_sold:          integer('quantity_sold'),
  category:               text('category'),
  marketplace_product_id: text('marketplace_product_id'),
  updated_at:             timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('products_shop_id_idx').on(t.shop_id),
  index('products_sku_idx').on(t.sku),
])

/* ── 5. orders ──────────────────────────────────────────────────────────────── */

export const orders = pgTable('orders', {
  id:                uuid('id').primaryKey().defaultRandom(),
  shop_id:           uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  order_id_external: text('order_id_external'),
  marketplace:       marketplaceTypeEnum('marketplace').notNull(),
  // Fulfillment scheme: 'fbs' (by seller), 'fbo' (by marketplace warehouse),
  // 'dbs' (delivery by seller), etc. Nullable for legacy/unknown rows.
  fulfillment_type:  text('fulfillment_type'),
  status:            orderStatusEnum('status').default('pending').notNull(),
  revenue:           numeric('revenue'),
  marketplace_fee:   numeric('marketplace_fee'),
  delivery_cost:     numeric('delivery_cost'),
  items_count:       integer('items_count').default(0).notNull(),
  ordered_at:        timestamp('ordered_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('orders_shop_id_idx').on(t.shop_id),
  index('orders_ordered_at_idx').on(t.ordered_at),
])

/* ── 6. order_items ─────────────────────────────────────────────────────────── */

export const orderItems = pgTable('order_items', {
  id:             uuid('id').primaryKey().defaultRandom(),
  order_id:       uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  product_id:     uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  quantity:       integer('quantity').default(1).notNull(),
  price_per_unit: numeric('price_per_unit'),
  cost_per_unit:  numeric('cost_per_unit'),
}, (t) => [
  index('order_items_order_id_idx').on(t.order_id),
  index('order_items_product_id_idx').on(t.product_id),
])

/* ── 7. ad_campaigns ────────────────────────────────────────────────────────── */

export const adCampaigns = pgTable('ad_campaigns', {
  id:            uuid('id').primaryKey().defaultRandom(),
  shop_id:       uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  type:          adTypeEnum('type').notNull(),
  status:        adStatusEnum('status').default('active').notNull(),
  product_title: text('product_title'),
  spend:         numeric('spend').default('0').notNull(),
  impressions:   integer('impressions').default(0).notNull(),
  clicks:        integer('clicks').default(0).notNull(),
  ctr:           numeric('ctr').default('0').notNull(),
  orders:        integer('orders').default(0).notNull(),
  revenue:       numeric('revenue').default('0').notNull(),
  drr:           numeric('drr').default('0').notNull(),
  start_date:    text('start_date'),
}, (t) => [
  index('ad_campaigns_shop_id_idx').on(t.shop_id),
])

/* ── 8. product_ads_stats ───────────────────────────────────────────────────── */

export const productAdsStats = pgTable('product_ads_stats', {
  id:               uuid('id').primaryKey().defaultRandom(),
  shop_id:          uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  sku:              text('sku').notNull(),
  date:             date('date').notNull(),
  impressions:      integer('impressions').default(0).notNull(),
  clicks:           integer('clicks').default(0).notNull(),
  spend:            numeric('spend').default('0').notNull(),
  orders_from_ads:  integer('orders_from_ads').default(0).notNull(),
  revenue_from_ads: numeric('revenue_from_ads').default('0').notNull(),
}, (t) => [
  uniqueIndex('product_ads_stats_shop_sku_date_idx').on(t.shop_id, t.sku, t.date),
])

/* ── 9. search_phrases ──────────────────────────────────────────────────────── */

export const searchPhrases = pgTable('search_phrases', {
  id:            uuid('id').primaryKey().defaultRandom(),
  shop_id:       uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  product_id:    text('product_id'),
  product_title: text('product_title'),
  phrase:        text('phrase').notNull(),
  impressions:   integer('impressions').default(0).notNull(),
  clicks:        integer('clicks').default(0).notNull(),
  ctr:           numeric('ctr').default('0').notNull(),
  orders:        integer('orders').default(0).notNull(),
  spend:         numeric('spend').default('0').notNull(),
}, (t) => [
  index('search_phrases_shop_id_idx').on(t.shop_id),
])

/* ── 10. sync_logs ──────────────────────────────────────────────────────────── */

export const syncLogs = pgTable('sync_logs', {
  id:        uuid('id').primaryKey().defaultRandom(),
  shop_id:   uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  status:    syncStatusEnum('status').notNull(),
  message:   text('message'),
  synced_at: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('sync_logs_shop_id_idx').on(t.shop_id),
])

/* ── 11. sync_days ──────────────────────────────────────────────────────────── */

export const syncDays = pgTable('sync_days', {
  id:             uuid('id').primaryKey().defaultRandom(),
  shop_id:        uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  sync_date:      date('sync_date').notNull(),
  status:         syncDayStatusEnum('status').default('pending').notNull(),
  products_count: integer('products_count'),
  revenue:        numeric('revenue'),
  ad_spend:       numeric('ad_spend'),
  error_message:  text('error_message'),
  synced_at:      timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('sync_days_shop_date_idx').on(t.shop_id, t.sync_date),
])

/* ── 12. user_settings ──────────────────────────────────────────────────────── */

export const userSettings = pgTable('user_settings', {
  id:                        uuid('id').primaryKey().defaultRandom(),
  user_id:                   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  alert_stock_threshold:     integer('alert_stock_threshold').default(15),
  telegram_bot_token:        text('telegram_bot_token'),
  telegram_chat_id:          text('telegram_chat_id'),
  telegram_username:         text('telegram_username'),
  telegram_pending_token:    text('telegram_pending_token'),
  telegram_token_expires_at: timestamp('telegram_token_expires_at', { withTimezone: true }),
  telegram_link_token:       text('telegram_link_token'),
  telegram_link_expires_at:  timestamp('telegram_link_expires_at', { withTimezone: true }),
  referral_code:             text('referral_code'),
  ue_acquiring_pct:          numeric('ue_acquiring_pct').default('1.5'),
  ue_last_mile_pct:          numeric('ue_last_mile_pct').default('0'),
  ue_ad_pct:                 numeric('ue_ad_pct').default('5'),
  ue_tax_pct:                numeric('ue_tax_pct').default('6'),
  ue_tax_type:               taxTypeEnum('ue_tax_type').default('income'),
  ue_comm_pct:               numeric('ue_comm_pct').default('10'),
  notif_low_stock:           boolean('notif_low_stock').default(true).notNull(),
  notif_daily_summary:       boolean('notif_daily_summary').default(true).notNull(),
  notif_new_orders:          boolean('notif_new_orders').default(true).notNull(),
  notif_weekly_report:       boolean('notif_weekly_report').default(false).notNull(),
  notif_send_time:           text('notif_send_time').default('09:00').notNull(),
  notif_send_days:           integer('notif_send_days').array().default([1, 2, 3, 4, 5, 6, 0]).notNull(),
  notif_lang:                text('notif_lang').default('uz').notNull(),
  created_at:                timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at:                timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('user_settings_user_id_idx').on(t.user_id),
])

/* ── 13. unit_economics_items ───────────────────────────────────────────────── */

export const unitEconomicsItems = pgTable('unit_economics_items', {
  id:              uuid('id').primaryKey().defaultRandom(),
  user_id:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:           text('title').notNull(),
  image:           text('image'),
  sku:             text('sku'),
  category:        text('category'),
  marketplace:     marketplaceTypeEnum('marketplace').notNull(),
  selling_price:   numeric('selling_price').notNull(),
  cost_price:      numeric('cost_price').notNull(),
  // Per-unit cost of actually bringing the product from the supplier (e.g.
  // China): cargo/customs/freight. Separate from cost_price (purchase price)
  // so the margin reflects the true landed cost.
  landed_cost:     numeric('landed_cost'),
  commission_pct:  numeric('commission_pct').notNull(),
  commission:      numeric('commission').notNull(),
  delivery:        numeric('delivery').notNull(),
  last_mile:       numeric('last_mile').notNull(),
  acquiring:       numeric('acquiring').notNull(),
  ad_spend:        numeric('ad_spend').notNull(),
  tax:             numeric('tax').notNull(),
  net_profit:      numeric('net_profit').notNull(),
  roi:             numeric('roi'),
  margin:          numeric('margin').notNull(),
  stock:           integer('stock'),
  weight:          numeric('weight'),
  supplier_url:    text('supplier_url'),
  product_url:     text('product_url'),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('unit_economics_items_user_id_idx').on(t.user_id),
])

/* ── 14. payments ───────────────────────────────────────────────────────────── */

export const payments = pgTable('payments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plan:       text('plan').notNull(),
  amount:     numeric('amount').notNull(),
  status:     paymentStatusEnum('status').default('pending').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('payments_user_id_idx').on(t.user_id),
])

/* ── 15. alerts ─────────────────────────────────────────────────────────────── */

export const alerts = pgTable('alerts', {
  id:               uuid('id').primaryKey().defaultRandom(),
  user_id:          uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  shop_id:          bigint('shop_id', { mode: 'number' }),
  sku_id:           bigint('sku_id', { mode: 'number' }),
  type:             text('type'),
  message:          text('message'),
  sent_to_telegram: boolean('sent_to_telegram').default(false),
  created_at:       timestamp('created_at', { withTimezone: true }).defaultNow(),
})

/* ── 16. competitor_watchlist ───────────────────────────────────────────────── */

export const competitorWatchlist = pgTable('competitor_watchlist', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  user_id:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label:                 text('label').notNull(),
  competitor_url:        text('competitor_url'),
  my_product_title:      text('my_product_title'),
  my_price:              numeric('my_price'),
  last_competitor_price: numeric('last_competitor_price'),
  last_checked_at:       timestamp('last_checked_at', { withTimezone: true }),
  created_at:            timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('competitor_watchlist_user_id_idx').on(t.user_id),
])

/* ── 17. bot_sessions ───────────────────────────────────────────────────────── */

export const botSessions = pgTable('bot_sessions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  user_id:     uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  chat_id:     text('chat_id').notNull(),
  state:       text('state'),
  data:        text('data'),
  lang:        text('lang').default('uz').notNull(),
  step:        text('step').default('lang_select').notNull(),
  shop_name:   text('shop_name'),
  marketplace: text('marketplace'),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('bot_sessions_chat_id_idx').on(t.chat_id),
])

/* ── 18. channel_nonces ─────────────────────────────────────────────────────── */

export const channelNonces = pgTable('channel_nonces', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nonce:      text('nonce').notNull(),
  channel:    text('channel').notNull(),
  used:       boolean('used').default(false).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('channel_nonces_nonce_idx').on(t.nonce),
])

/* ── 19. sessions (NextAuth) ────────────────────────────────────────────────── */

export const sessions = pgTable('sessions', {
  id:         text('id').primaryKey(),
  user_id:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
}, (t) => [
  index('idx_sessions_user_id').on(t.user_id),
  index('idx_sessions_expires_at').on(t.expires_at),
])

/* ── 20. accounts (NextAuth OAuth) ───────────────────────────────────────────── */

export const accounts = pgTable('accounts', {
  id:                  text('id').primaryKey(),
  user_id:             uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider:            text('provider').notNull(),
  provider_account_id: text('provider_account_id').notNull(),
  refresh_token:       text('refresh_token'),
  access_token:        text('access_token'),
  token_expires_at:    timestamp('token_expires_at'),
  created_at:          timestamp('created_at').defaultNow(),
}, (t) => [
  index('idx_accounts_user_id').on(t.user_id),
  uniqueIndex('idx_accounts_provider').on(t.provider, t.provider_account_id),
])

/* ── 21. verification_tokens (Email verification) ──────────────────────────── */

export const verificationTokens = pgTable('verification_tokens', {
  token:      text('token').primaryKey(),
  user_id:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email:      text('email').notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('idx_verification_tokens_user_id').on(t.user_id),
  index('idx_verification_tokens_expires_at').on(t.expires_at),
])

/* ── 22. product_links ──────────────────────────────────────────────────────── */
// Cross-marketplace leftover tracking: products are auto-grouped across
// marketplaces by normalized seller article (match_key). This stores the
// per-group physical stock baseline and low-stock alert threshold.

export const productLinks = pgTable('product_links', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  user_id:              uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  match_key:            text('match_key').notNull(),
  total_physical_stock: integer('total_physical_stock'),
  baseline_at:          timestamp('baseline_at', { withTimezone: true }),
  stock_threshold:      integer('stock_threshold'),
  created_at:           timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:           timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('product_links_user_key_unique').on(t.user_id, t.match_key),
  index('idx_product_links_user_id').on(t.user_id),
])

/* ── 23. product_group_merges ─────────────────────────────────────────────── */
// Manual cross-marketplace product grouping: when the same physical product
// has different SKUs on different marketplaces, users merge them by mapping
// source_key → target_key so they appear as a single stock group.
export const productGroupMerges = pgTable('product_group_merges', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source_key: text('source_key').notNull(),
  target_key: text('target_key').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('product_group_merges_user_source').on(t.user_id, t.source_key),
  index('idx_product_group_merges_user').on(t.user_id),
])
