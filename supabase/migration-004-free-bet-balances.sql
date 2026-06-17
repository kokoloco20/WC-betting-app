-- Migration 004 — run once in the Supabase SQL editor (safe to re-run).
-- Tracks remaining free-bet credit per bookmaker.

create table if not exists free_bet_balances (
  user_id uuid not null default auth.uid() references auth.users (id),
  bookmaker_id uuid not null references bookmakers (id) on delete cascade,
  balance numeric not null default 0,
  primary key (user_id, bookmaker_id)
);

alter table free_bet_balances enable row level security;

create policy "own rows" on free_bet_balances for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
