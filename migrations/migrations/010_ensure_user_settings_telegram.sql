-- Ensure user_settings table and telegram columns exist
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_settings add column if not exists telegram_chat_id         text;
alter table public.user_settings add column if not exists telegram_username        text;
alter table public.user_settings add column if not exists telegram_link_token      text;
alter table public.user_settings add column if not exists telegram_link_expires_at timestamptz;

-- Unique constraint on link token (ignore if already exists)
do $$ begin
  alter table public.user_settings add constraint user_settings_link_token_unique unique (telegram_link_token);
exception when duplicate_table or duplicate_object then null;
end $$;

alter table public.user_settings enable row level security;

do $$ begin
  create policy "user_settings_own" on public.user_settings
    for all using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
