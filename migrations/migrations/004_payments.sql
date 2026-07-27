-- Payments table for Click and Payme transactions
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  provider              text not null check (provider in ('click', 'payme')),
  provider_transaction_id text,
  amount                integer not null,          -- in UZS so'm
  plan                  text not null,
  period_months         integer not null default 1,
  status                text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'failed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_provider_tx_idx on public.payments(provider_transaction_id);
create index if not exists payments_status_idx on public.payments(status);

alter table public.payments enable row level security;

create policy "users_view_own_payments"
  on public.payments for select
  using (auth.uid() = user_id);
