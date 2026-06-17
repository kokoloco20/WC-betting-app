-- Migration 005 — run once in the Supabase SQL editor (safe to re-run).
-- Adds the "goal or assist" and "saves" leg markets.

alter table legs drop constraint legs_market_check;
alter table legs add constraint legs_market_check check (market in (
  'shots_on_target', 'shots', 'passes', 'tackles', 'goals', 'assists',
  'goal_or_assist', 'saves', 'cards', 'corners', 'match_result',
  'over_under_goals', 'btts', 'outright', 'bet_builder', 'other'
));
