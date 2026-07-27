-- User settings: per-user preferences + Telegram integration state
create table if not exists public.user_settings (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  telegram_chat_id         text,
  telegram_username        text,
  telegram_link_token      text unique,
  telegram_link_expires_at timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_own" on public.user_settings
  for all using (auth.uid() = user_id);

-- Alerts: history of alerts fired by the extension
create table if not exists public.alerts (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  shop_id  uuid references public.shops(id) on delete set null,
  type     text not null,
  message  text not null,
  priority text not null default 'warning',
  sent_at  timestamptz default now()
);

alter table public.alerts enable row level security;

create policy "alerts_own" on public.alerts
  for all using (auth.uid() = user_id);

create index if not exists idx_alerts_user_id on public.alerts (user_id);
create index if not exists idx_alerts_sent_at on public.alerts (sent_at desc);
