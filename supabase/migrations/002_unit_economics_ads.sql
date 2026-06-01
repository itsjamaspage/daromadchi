-- Daromadchi — Migration 002: Unit Economics, Advertising, Search Phrases, Sync Days
-- Run via: supabase db push  OR paste into Supabase SQL editor

-- ─── Unit Economics Items ──────────────────────────────────────────────────────
create table if not exists public.unit_economics_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  title           text not null,
  image           text,
  sku             text,
  category        text,
  marketplace     public.marketplace_type not null default 'uzum',
  selling_price   decimal(15,2) not null,
  cost_price      decimal(15,2) not null default 0,
  commission_pct  decimal(5,2)  not null default 10,
  commission      decimal(15,2) not null default 0,
  delivery        decimal(15,2) not null default 0,
  last_mile       decimal(15,2) not null default 0,
  acquiring       decimal(15,2) not null default 0,
  ad_spend        decimal(15,2) not null default 0,
  tax             decimal(15,2) not null default 0,
  net_profit      decimal(15,2) not null default 0,
  roi             decimal(7,2),
  margin          decimal(5,2)  not null default 0,
  stock           integer,
  weight          decimal(8,3),
  supplier_url    text,
  product_url     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.unit_economics_items enable row level security;

create policy "ue_items_all_own" on public.unit_economics_items
  for all using (auth.uid() = user_id);

create index if not exists idx_ue_items_user_id on public.unit_economics_items (user_id);

-- ─── Advertising Campaigns ─────────────────────────────────────────────────────
create table if not exists public.ad_campaigns (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  external_id     text,
  name            text not null,
  type            text not null check (type in ('cpc', 'cpo')),
  status          text not null check (status in ('active', 'paused', 'stopped')) default 'active',
  product_title   text,
  spend           decimal(15,2) not null default 0,
  impressions     bigint        not null default 0,
  clicks          bigint        not null default 0,
  ctr             decimal(6,3)  not null default 0,
  orders          integer       not null default 0,
  revenue         decimal(15,2) not null default 0,
  drr             decimal(6,2)  not null default 0,
  start_date      date,
  period_start    date,
  period_end      date,
  synced_at       timestamptz default now()
);

alter table public.ad_campaigns enable row level security;

create policy "ad_campaigns_all_own" on public.ad_campaigns
  for all using (
    auth.uid() = (select user_id from public.shops where id = shop_id)
  );

create index if not exists idx_ad_campaigns_shop_id   on public.ad_campaigns (shop_id);
create index if not exists idx_ad_campaigns_status     on public.ad_campaigns (status);
create unique index if not exists idx_ad_campaigns_ext on public.ad_campaigns (shop_id, external_id)
  where external_id is not null;

-- ─── Search Phrases ────────────────────────────────────────────────────────────
create table if not exists public.search_phrases (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  product_title   text,
  phrase          text not null,
  impressions     bigint       not null default 0,
  clicks          bigint       not null default 0,
  ctr             decimal(6,3) not null default 0,
  orders          integer      not null default 0,
  spend           decimal(15,2) not null default 0,
  period_start    date,
  period_end      date,
  synced_at       timestamptz default now()
);

alter table public.search_phrases enable row level security;

create policy "search_phrases_all_own" on public.search_phrases
  for all using (
    auth.uid() = (select user_id from public.shops where id = shop_id)
  );

create index if not exists idx_search_phrases_shop_id on public.search_phrases (shop_id);
create index if not exists idx_search_phrases_product  on public.search_phrases (product_id);

-- ─── Sync Day Status ───────────────────────────────────────────────────────────
-- Tracks per-day sync health per shop (products, revenue, ad spend reconciliation)
create table if not exists public.sync_days (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  sync_date       date not null,
  status          text not null check (status in ('ready','error','degraded','pending')) default 'pending',
  products_count  integer,
  revenue         decimal(15,2),
  ad_spend        decimal(15,2),
  error_message   text,
  synced_at       timestamptz default now()
);

alter table public.sync_days enable row level security;

create policy "sync_days_all_own" on public.sync_days
  for all using (
    auth.uid() = (select user_id from public.shops where id = shop_id)
  );

create unique index if not exists idx_sync_days_shop_date on public.sync_days (shop_id, sync_date);
create index         if not exists idx_sync_days_shop_id  on public.sync_days (shop_id);

-- ─── User settings (unit economics defaults) ──────────────────────────────────
create table if not exists public.user_settings (
  user_id           uuid primary key references public.users(id) on delete cascade,
  ue_acquiring_pct  decimal(5,2) not null default 1.5,
  ue_ad_pct         decimal(5,2) not null default 5.0,
  ue_tax_pct        decimal(5,2) not null default 6.0,
  ue_last_mile_pct  decimal(5,2) not null default 0.0,
  ue_tax_type       text         not null default 'income' check (ue_tax_type in ('income','income_minus_expense')),
  ue_comm_pct       decimal(5,2) not null default 10.0,
  updated_at        timestamptz  default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_all_own" on public.user_settings
  for all using (auth.uid() = user_id);
