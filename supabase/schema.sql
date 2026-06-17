-- WC 2026 betting tracker — run once in the Supabase SQL editor.
-- Teams and matches are static app data; only user data lives here.

create table bookmakers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id),
  name text not null,
  unique (user_id, name)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id),
  name text not null,
  team_code text not null
);

create table bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id),
  bookmaker_id uuid not null references bookmakers (id),
  bet_type text not null check (bet_type in ('straight', 'parlay', 'bet_builder', 'super_boost', 'outright')),
  stake numeric not null check (stake >= 0),
  total_odds numeric not null check (total_odds >= 1),
  is_free_bet boolean not null default false,
  is_super_boost boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void', 'cashed_out')),
  payout numeric,
  placed_at timestamptz not null default now(),
  settled_at timestamptz,
  notes text
);

create table legs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id),
  bet_id uuid not null references bets (id) on delete cascade,
  match_number int,
  market text not null check (market in (
    'shots_on_target', 'shots', 'passes', 'tackles', 'goals', 'assists',
    'goal_or_assist', 'saves', 'cards', 'corners', 'match_result',
    'over_under_goals', 'btts', 'outright', 'bet_builder', 'other'
  )),
  player_id uuid references players (id),
  team_code text,
  line text,
  result text not null default 'pending' check (result in ('pending', 'won', 'lost', 'void'))
);

-- Remaining free-bet credit per bookmaker.
create table free_bet_balances (
  user_id uuid not null default auth.uid() references auth.users (id),
  bookmaker_id uuid not null references bookmakers (id) on delete cascade,
  balance numeric not null default 0,
  primary key (user_id, bookmaker_id)
);

-- Knockout bracket slots the user fills in once teams are known.
create table knockout_teams (
  user_id uuid not null default auth.uid() references auth.users (id),
  match_number int not null,
  home_code text,
  away_code text,
  primary key (user_id, match_number)
);

alter table bookmakers enable row level security;
alter table players enable row level security;
alter table bets enable row level security;
alter table legs enable row level security;
alter table knockout_teams enable row level security;
alter table free_bet_balances enable row level security;

create policy "own rows" on bookmakers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on players for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on bets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on legs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on knockout_teams for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on free_bet_balances for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
