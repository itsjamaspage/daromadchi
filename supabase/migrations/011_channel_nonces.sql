create table if not exists channel_nonces (
  nonce       text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  telegram_id text,
  verified    boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_channel_nonces_user on channel_nonces(user_id);
create index if not exists idx_channel_nonces_exp  on channel_nonces(expires_at);
