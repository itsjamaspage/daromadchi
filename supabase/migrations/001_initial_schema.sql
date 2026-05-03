-- Daromadchi schema
-- Run this in your Supabase SQL editor or via supabase db push

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  store_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Products ─────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  sku        text not null,
  category   text not null,
  price      bigint not null,  -- stored in so'm (UZS)
  cost       bigint not null,
  stock      int  not null default 0,
  created_at timestamptz default now(),
  unique (user_id, sku)
);

alter table public.products enable row level security;

create policy "Users manage own products"
  on public.products for all
  using (auth.uid() = user_id);

create index on public.products (user_id);

-- ─── Orders ───────────────────────────────────────────────────────────────────
create type public.order_status as enum ('processing', 'shipped', 'delivered', 'cancelled');

create table if not exists public.orders (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  order_ref    text not null,             -- e.g. UZM-001842
  customer     text not null,
  product_id   bigint references public.products (id) on delete set null,
  product_name text not null,             -- denormalized for display
  amount       bigint not null,           -- total in so'm
  status       public.order_status not null default 'processing',
  ordered_at   date not null default current_date,
  created_at   timestamptz default now(),
  unique (user_id, order_ref)
);

alter table public.orders enable row level security;

create policy "Users manage own orders"
  on public.orders for all
  using (auth.uid() = user_id);

create index on public.orders (user_id, ordered_at desc);
create index on public.orders (user_id, status);

-- ─── Daily revenue view ───────────────────────────────────────────────────────
-- Aggregates delivered + shipped orders by day (excludes cancelled)
create or replace view public.daily_revenue as
select
  user_id,
  ordered_at                  as date,
  sum(amount)                 as revenue,
  count(*)                    as order_count
from public.orders
where status in ('delivered', 'shipped', 'processing')
group by user_id, ordered_at
order by ordered_at;

-- ─── KPI function ─────────────────────────────────────────────────────────────
-- Returns a single-row summary for the authenticated user
create or replace function public.get_kpis()
returns table (
  total_revenue bigint,
  total_profit  bigint,
  total_orders  bigint,
  total_stock   bigint
) language sql security definer set search_path = public as $$
  select
    coalesce(sum(o.amount), 0)                          as total_revenue,
    coalesce(sum(o.amount - p.cost), 0)                 as total_profit,
    count(distinct o.id)                                as total_orders,
    coalesce((select sum(stock) from products
               where user_id = auth.uid()), 0)          as total_stock
  from orders o
  left join products p on p.id = o.product_id
  where o.user_id = auth.uid()
    and o.status != 'cancelled';
$$;
