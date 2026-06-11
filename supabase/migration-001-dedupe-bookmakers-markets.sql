-- Migration 001 — run once in the Supabase SQL editor (safe to re-run).
-- Fixes duplicated default bookmakers and adds the bet-builder market.

-- 1. Re-point any bets at the canonical (first) bookmaker row
update bets set bookmaker_id = c.keep_id
from bookmakers b
join (
  select user_id, name, min(id::text)::uuid as keep_id
  from bookmakers group by user_id, name
) c on b.user_id = c.user_id and b.name = c.name
where bets.bookmaker_id = b.id and b.id <> c.keep_id;

-- 2. Delete the duplicate rows
delete from bookmakers b
using (
  select user_id, name, min(id::text)::uuid as keep_id
  from bookmakers group by user_id, name
) c
where b.user_id = c.user_id and b.name = c.name and b.id <> c.keep_id;

-- 3. Make duplicates impossible from now on
create unique index if not exists bookmakers_user_name_key
  on bookmakers (user_id, name);

-- 4. Allow 'bet_builder' as a leg market
alter table legs drop constraint legs_market_check;
alter table legs add constraint legs_market_check check (market in (
  'shots_on_target', 'shots', 'passes', 'tackles', 'goals', 'assists',
  'cards', 'corners', 'match_result', 'over_under_goals', 'btts',
  'outright', 'bet_builder', 'other'
));
