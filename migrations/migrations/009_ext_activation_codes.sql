create table if not exists ext_activation_codes (
  code        text primary key,
  chat_id     text not null,
  used        boolean not null default false,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ext_activation_chat on ext_activation_codes(chat_id);
