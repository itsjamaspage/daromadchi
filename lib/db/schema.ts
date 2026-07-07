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
  id:             uuid('id').primaryKey().defaultRandom(),
  email:          text('email').notNull(),
  full_name:      text('full_name'),
  phone:          text('phone'),
  plan:           planTypeEnum('plan').default('free').notNull(),
  plan_expires_at: timestamp('plan_expires_at', { withTimezone: true }),
  trial_ends_at:  timestamp('trial_ends_at', { withTimezone: true }),
  created_at:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:     timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
  quantity:        integer('quantity').default(1).notNull(),
  price_per_unit: numeric('price_per_unit'),
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
  id:                    uuid('id').primaryKey().defaultRandom(),
  user_id:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  alert_stock_threshold: integer('alert_stock_threshold').default(15),
  telegram_bot_token:    text('telegram_bot_token'),
  telegram_chat_id:      text('telegram_chat_id'),
  referral_code:         text('referral_code'),
  ue_acquiring_pct:      numeric('ue_acquiring_pct').default('1.5'),
  ue_last_mile_pct:      numeric('ue_last_mile_pct').default('0'),
  ue_ad_pct:             numeric('ue_ad_pct').default('5'),
  ue_tax_pct:            numeric('ue_tax_pct').default('6'),
  ue_tax_type:           taxTypeEnum('ue_tax_type').default('income'),
  ue_comm_pct:           numeric('ue_comm_pct').default('10'),
  updated_at:            timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
  id:                uuid('id').primaryKey().defaultRandom(),
  user_id:           uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  shop_id:           bigint('shop_id', { mode: 'number' }),
  sku_id:            bigint('sku_id', { mode: 'number' }),
  type:              text('type'),
  message:           text('message'),
  sent_to_telegram:  boolean('sent_to_telegram').default(false),
  created_at:        timestamp('created_at', { withTimezone: true }).defaultNow(),
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
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  chat_id:    text('chat_id').notNull(),
  state:      text('state'),
  data:       text('data'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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
