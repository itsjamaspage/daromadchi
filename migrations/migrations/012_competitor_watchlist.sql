create table if not exists competitor_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  competitor_url text,
  my_product_title text,
  my_price bigint,
  last_competitor_price bigint,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitor_watchlist_user on competitor_watchlist(user_id);
