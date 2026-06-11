create table if not exists bot_sessions (
  chat_id    text primary key,
  lang       text not null default 'uz',
  step       text not null default 'lang_select',
  shop_name  text,
  marketplace text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table bot_sessions enable row level security;
-- Only service role (supabaseAdmin) can read/write — anon and authenticated users cannot
