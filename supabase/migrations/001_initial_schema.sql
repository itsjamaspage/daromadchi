-- Daromadchi — multi-marketplace analytics SaaS (Uzum + Yandex Market)
-- Run via: supabase db push  OR paste into Supabase SQL editor

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.marketplace_type as enum ('uzum', 'yandex_market');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'delivered', 'cancelled', 'returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sync_status as enum ('success', 'error');
exception when duplicate_object then null; end $$;

-- ─── Users ────────────────────────────────────────────────────────────────────
-- Mirrors auth.users; auto-populated via trigger on signup
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Shops ────────────────────────────────────────────────────────────────────
create table if not exists public.shops (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  name              text not null,
  marketplace       public.marketplace_type not null,
  api_key_encrypted text,
  shop_id_external  text,
  is_active         boolean not null default true,
  last_synced_at    timestamptz,
  created_at        timestamptz default now()
);

alter table public.shops enable row level security;

create policy "shops_all_own" on public.shops
  for all using (auth.uid() = user_id);

create index if not exists idx_shops_user_id    on public.shops (user_id);
create index if not exists idx_shops_marketplace on public.shops (marketplace);

-- ─── Products ─────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id                     uuid primary key default gen_random_uuid(),
  shop_id                uuid not null references public.shops(id) on delete cascade,
  sku                    text,
  title                  text not null,
  cost_price             decimal(15, 2),
  selling_price          decimal(15, 2),
  stock_quantity         int not null default 0,
  category               text,
  marketplace_product_id text,
  updated_at             timestamptz default now()
);

alter table public.products enable row level security;

create policy "products_all_own" on public.products
  for all using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
        and shops.user_id = auth.uid()
    )
  );

create index if not exists idx_products_shop_id on public.products (shop_id);

-- ─── Orders ───────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops(id) on delete cascade,
  order_id_external text,
  marketplace       public.marketplace_type not null,
  status            public.order_status not null default 'pending',
  revenue           decimal(15, 2),
  marketplace_fee   decimal(15, 2),
  delivery_cost     decimal(15, 2),
  items_count       int not null default 1,
  ordered_at        timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "orders_all_own" on public.orders
  for all using (
    exists (
      select 1 from public.shops
      where shops.id = orders.shop_id
        and shops.user_id = auth.uid()
    )
  );

create index if not exists idx_orders_shop_id    on public.orders (shop_id);
create index if not exists idx_orders_ordered_at on public.orders (ordered_at desc);
create index if not exists idx_orders_marketplace on public.orders (marketplace);
create index if not exists idx_orders_status      on public.orders (status);

-- ─── Order Items ──────────────────────────────────────────────────────────────
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  quantity       int not null default 1,
  price_per_unit decimal(15, 2),
  cost_per_unit  decimal(15, 2)
);

alter table public.order_items enable row level security;

create policy "order_items_all_own" on public.order_items
  for all using (
    exists (
      select 1
      from public.orders o
      join public.shops s on s.id = o.shop_id
      where o.id = order_items.order_id
        and s.user_id = auth.uid()
    )
  );

create index if not exists idx_order_items_order_id   on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);

-- ─── Sync Logs ────────────────────────────────────────────────────────────────
create table if not exists public.sync_logs (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  marketplace   public.marketplace_type not null,
  status        public.sync_status not null,
  error_message text,
  synced_at     timestamptz default now()
);

alter table public.sync_logs enable row level security;

create policy "sync_logs_all_own" on public.sync_logs
  for all using (
    exists (
      select 1 from public.shops
      where shops.id = sync_logs.shop_id
        and shops.user_id = auth.uid()
    )
  );

create index if not exists idx_sync_logs_shop_id   on public.sync_logs (shop_id);
create index if not exists idx_sync_logs_synced_at on public.sync_logs (synced_at desc);
create index if not exists idx_sync_logs_marketplace on public.sync_logs (marketplace);
