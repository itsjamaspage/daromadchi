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
  serial,
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

// Per-shop API posture. read_only (default) never writes to the marketplace;
// stock_sync opts a single shop into the audited stock-quantity-only writer.
export const apiModeEnum = pgEnum('api_mode', ['read_only', 'stock_sync'])

// How stock-sync splits a shared physical unit across marketplaces (Phase 3).
export const oversellModeEnum = pgEnum('oversell_mode', ['lock_last_unit', 'partition', 'off'])

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
  business_id:       text('business_id'),
  is_active:         boolean('is_active').default(true).notNull(),
  token_valid:       boolean('token_valid'),
  last_synced_at:    timestamp('last_synced_at', { withTimezone: true }),
  // Marketplace rate-limit cooldown. When set to a future timestamp,
  // sync() short-circuits without hitting the marketplace API — lets
  // e.g. Wildberries' per-seller limiter naturally decay instead of
  // getting hammered by our 15-min cron. Persisted (not in-memory) so
  // deploys don't wipe it.
  throttled_until:   timestamp('throttled_until', { withTimezone: true }),
  warehouse_id:      uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  // ── Stock-sync (edit) mode — opt-in, OFF by default ─────────────────────
  // read_only (default): the app only reads marketplace data and NEVER
  // writes. stock_sync: the single audited writer (lib/marketplace/stock-
  // writer.ts) may push ostatok — stock QUANTITY only — to this shop's live
  // listing. Nothing else (price/title/order/invoice/…) is ever written.
  api_mode:                 apiModeEnum('api_mode').default('read_only').notNull(),
  // Dry-run: when true the writer LOGS the intended store write and sends
  // nothing. First enable + this toggle are dry-run; live writes happen only
  // after it's turned off.
  stock_sync_dry_run:       boolean('stock_sync_dry_run').default(true).notNull(),
  // How to allocate the last shared unit across marketplaces (Phase 3).
  oversell_mode:            oversellModeEnum('oversell_mode').default('lock_last_unit').notNull(),
  // Lower number = higher priority; under lock_last_unit the highest-priority
  // (lowest number) channel keeps the last unit at qty=1 while others go to 0.
  // Migration sets existing Uzum rows to 0 (primary); everything else is 100.
  primary_channel_priority: integer('primary_channel_priority').default(100).notNull(),
  // When the user consented to edit mode for this shop (audit trail).
  stock_sync_consent_at:    timestamp('stock_sync_consent_at', { withTimezone: true }),
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
  // 'fbs' (seller ships) | 'fbo' (marketplace warehouse) | 'fby' (Yandex
  // fulfillment) | null (unknown → treated as FBS by stock aggregation).
  fulfillment_type:       text('fulfillment_type'),
  // ── Cross-marketplace stock-WRITE identifiers (populated in Phase 3) ─────
  // Uzum: the STRING barcode from GET /v3/fbs/sku/stocks. The write DTO
  // (POST /v2/fbs/sku/stocks) types barcode as a string, but the product-card
  // read types it as int64 (drops leading zeros). The barcode used for a write
  // MUST be sourced here, never from the product card. Null until the barcode
  // sync step runs — a live Uzum write is refused without it.
  market_barcode:         text('market_barcode'),
  // Yandex Market: the exact shopSku the stock-update PUT expects (sourced
  // from the offers/stocks read).
  market_sku:             text('market_sku'),
  // Yandex Market: the warehouseId the stock-update PUT targets (sourced from
  // the offers/stocks read). Stored as text — it's a marketplace-side id.
  market_warehouse_id:    text('market_warehouse_id'),
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
  penalty:           numeric('penalty').default('0'),
  storage_fee:       numeric('storage_fee').default('0'),
  additional_payment: numeric('additional_payment').default('0'),
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
  id:                       uuid('id').primaryKey().defaultRandom(),
  user_id:                  uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider:                 text('provider').notNull(),
  provider_transaction_id:  text('provider_transaction_id'),
  plan:                     text('plan').notNull(),
  period_months:            integer('period_months').default(1).notNull(),
  amount:                   numeric('amount').notNull(),
  status:                   paymentStatusEnum('status').default('pending').notNull(),
  created_at:               timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:               timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('payments_user_id_idx').on(t.user_id),
  index('payments_provider_tx_idx').on(t.provider_transaction_id),
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

// Matches migration 011: nonce is the PK, telegram_id + verified are the
// state fields the /telegram/webhook route reads/writes. The earlier
// Drizzle model had drifted (extra id/channel/used columns that don't
// exist in the DB, missing telegram_id/verified that do). Corrected here.
export const channelNonces = pgTable('channel_nonces', {
  nonce:       text('nonce').primaryKey(),
  user_id:     uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  telegram_id: text('telegram_id'),
  verified:    boolean('verified').default(false).notNull(),
  expires_at:  timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_channel_nonces_user').on(t.user_id),
  index('idx_channel_nonces_exp').on(t.expires_at),
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

/* ── 21a. ext_activation_codes (Telegram → Chrome extension linking) ─────── */

export const extActivationCodes = pgTable('ext_activation_codes', {
  code:       text('code').primaryKey(),
  chat_id:    text('chat_id').notNull(),
  used:       boolean('used').default(false).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_ext_activation_chat').on(t.chat_id),
])

/* ── 21b. password_reset_tokens (mirrors verification_tokens shape) ────────── */

export const passwordResetTokens = pgTable('password_reset_tokens', {
  token:      text('token').primaryKey(),
  user_id:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email:      text('email').notNull(),
  expires_at: timestamp('expires_at').notNull(),
  used_at:    timestamp('used_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('idx_password_reset_tokens_user_id').on(t.user_id),
  index('idx_password_reset_tokens_expires_at').on(t.expires_at),
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

/* ── 24. categories_canonical ──────────────────────────────────────────────── */
export const categoriesCanonical = pgTable('categories_canonical', {
  id:      serial('id').primaryKey(),
  slug:    text('slug').notNull(),
  name_ru: text('name_ru').notNull(),
  name_uz: text('name_uz').notNull(),
  name_en: text('name_en').notNull(),
}, (t) => [
  uniqueIndex('categories_canonical_name_ru_idx').on(t.name_ru),
  uniqueIndex('categories_canonical_slug_idx').on(t.slug),
])

/* ── 25. category_aliases ──────────────────────────────────────────────────── */
export const categoryAliases = pgTable('category_aliases', {
  id:            serial('id').primaryKey(),
  canonical_id:  integer('canonical_id').notNull().references(() => categoriesCanonical.id, { onDelete: 'cascade' }),
  marketplace:   text('marketplace').notNull(),
  original_name: text('original_name').notNull(),
}, (t) => [
  uniqueIndex('category_aliases_mp_name_idx').on(t.marketplace, t.original_name),
  index('category_aliases_canonical_idx').on(t.canonical_id),
])

/* ── 26. suggested_aliases ─────────────────────────────────────────────────── */
export const suggestedAliases = pgTable('suggested_aliases', {
  id:            serial('id').primaryKey(),
  canonical_id:  integer('canonical_id').notNull().references(() => categoriesCanonical.id, { onDelete: 'cascade' }),
  marketplace:   text('marketplace').notNull(),
  original_name: text('original_name').notNull(),
  score:         numeric('score', { precision: 4, scale: 3 }).notNull(),
  tier:          text('tier').notNull(),
  status:        text('status').notNull().default('pending'),
  reviewed_at:   timestamp('reviewed_at', { withTimezone: true }),
  created_at:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('suggested_aliases_mp_name_idx').on(t.marketplace, t.original_name),
  index('suggested_aliases_status_idx').on(t.status),
  index('suggested_aliases_canonical_idx').on(t.canonical_id),
])

/* ── 27. yandex_settlement_transactions ────────────────────────────────────── */
// Raw per-transaction rows from Yandex Market's united-netting-report.
// One row per financial event; aggregated per-order in lib/db/payouts.ts
// so the Payouts UI shows real settlement numbers instead of
// "Ожидает данных Yandex".
export const yandexSettlementTransactions = pgTable('yandex_settlement_transactions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  shop_id:             uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  transaction_id:      text('transaction_id').notNull(),
  order_id_external:   text('order_id_external'),
  entry_type:          text('entry_type').notNull(),   // "Начисление" | "Удержание"
  entry_source:        text('entry_source'),           // e.g. "Платёж покупателя", "Оплата услуг Market Yandex Go"
  order_type:          text('order_type'),             // e.g. "Продажа физлицу", "Доставка покупателю", "Поручение на продажу"
  sku:                 text('sku'),
  amount:              numeric('amount', { precision: 14, scale: 2 }).notNull(),
  quantity:            integer('quantity'),
  transaction_at:      timestamp('transaction_at', { withTimezone: true }),
  order_created_at:    timestamp('order_created_at', { withTimezone: true }),
  order_delivered_at:  timestamp('order_delivered_at', { withTimezone: true }),
  status_note:         text('status_note'),
  report_id:           text('report_id'),
  synced_at:           timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('yandex_settlement_shop_txn_unique').on(t.shop_id, t.transaction_id),
  index('yandex_settlement_shop_order_idx').on(t.shop_id, t.order_id_external),
  index('yandex_settlement_transaction_at_idx').on(t.transaction_at),
])

/* ── 28. uzum_settlement_orders ──────────────────────────────────────────────── */
// Per-order-item settlement rows from Uzum's /v1/finance/orders — the
// same view Uzum shows the seller in "Финансы → Продажи". Real commission,
// delivery fee, and withdrawn profit, so Payouts stops estimating from
// Unit Economics percentages.
export const uzumSettlementOrders = pgTable('uzum_settlement_orders', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  shop_id:               uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  uzum_order_item_id:    bigint('uzum_order_item_id', { mode: 'number' }).notNull(),
  uzum_order_id:         bigint('uzum_order_id', { mode: 'number' }).notNull(),
  uzum_shop_id:          bigint('uzum_shop_id', { mode: 'number' }),
  product_id:            bigint('product_id', { mode: 'number' }),
  product_title:         text('product_title'),
  sku_title:             text('sku_title'),
  // TO_WITHDRAW | PROCESSING | CANCELED | PARTIALLY_CANCELLED
  status:                text('status').notNull(),
  transaction_at:        timestamp('transaction_at', { withTimezone: true }),
  date_issued_at:        timestamp('date_issued_at', { withTimezone: true }),
  seller_price:          numeric('seller_price', { precision: 14, scale: 2 }).notNull().default('0'),
  commission:            numeric('commission', { precision: 14, scale: 2 }).notNull().default('0'),
  seller_profit:         numeric('seller_profit', { precision: 14, scale: 2 }),
  withdrawn_profit:      numeric('withdrawn_profit', { precision: 14, scale: 2 }),
  purchase_price:        numeric('purchase_price', { precision: 14, scale: 2 }),
  logistic_delivery_fee: numeric('logistic_delivery_fee', { precision: 14, scale: 2 }).notNull().default('0'),
  amount:                integer('amount'),
  amount_returns:        integer('amount_returns'),
  cancelled:             integer('cancelled'),
  return_cause:          text('return_cause'),
  comment:               text('comment'),
  synced_at:             timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('uzum_settlement_shop_item_unique').on(t.shop_id, t.uzum_order_item_id),
  index('uzum_settlement_shop_order_idx').on(t.shop_id, t.uzum_order_id),
  index('uzum_settlement_transaction_at_idx').on(t.transaction_at),
])

/* ── 29. stock_write_log ─────────────────────────────────────────────────────── */
// Audit trail for EVERY stock-write attempt made by lib/marketplace/stock-writer.ts
// — sent, dry-run simulated, skipped, guard-blocked, kill-switched, or errored.
// One row per attempt. This is the only place stock writes are recorded; nothing
// else in the app writes to a marketplace.
export const stockWriteLog = pgTable('stock_write_log', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  shop_id:            uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  product_id:         uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  marketplace:        marketplaceTypeEnum('marketplace').notNull(),
  // Seller article / shopSku (for grouping + the YM write payload).
  sku:                text('sku'),
  // The exact identifier the write used: Uzum string barcode, or YM shopSku.
  identifier:         text('identifier'),
  // YM only — the warehouseId targeted.
  warehouse_id:       text('warehouse_id'),
  endpoint:           text('endpoint'),
  method:             text('method'),
  // Quantity as requested by the caller, before Math.max(0, …) clamping.
  requested_quantity: integer('requested_quantity'),
  // Clamped quantity actually written / simulated.
  quantity:           integer('quantity'),
  // Monotonic freshness version (per shop+sku); enforced in Phase 4.
  version:            integer('version'),
  dry_run:            boolean('dry_run').default(false).notNull(),
  // sent | dry_run | skipped | blocked | killed | error
  status:             text('status').notNull(),
  // Machine-readable reason: missing_barcode, missing_warehouse, not_stock_sync,
  // kill_switch, guard_blocked, http_<code>, exception, …
  reason:             text('reason'),
  http_status:        integer('http_status'),
  request_body:       text('request_body'),
  response_body:      text('response_body'),
  error:              text('error'),
  created_at:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('stock_write_log_shop_id_idx').on(t.shop_id),
  index('stock_write_log_created_at_idx').on(t.created_at),
  index('stock_write_log_status_idx').on(t.status),
])
