-- Migration 003 — run once in the Supabase SQL editor (safe to re-run).
-- Corrects free bets that were settled as WON before the "stake not returned"
-- fix: their payout was stored as stake * odds, but a free/bonus bet returns
-- only the winnings (stake * (odds - 1)). Applies to every user's rows.
--
-- It only touches rows whose stored payout still equals the old auto-filled
-- value (stake * odds), so any cash-outs or hand-edited payouts are left alone.

update bets
set payout = round((stake * (total_odds - 1))::numeric, 2)
where is_free_bet = true
  and status = 'won'
  and payout is not null
  and abs(payout - stake * total_odds) < 0.01;

-- Show what changed (run this select after, optional):
-- select id, stake, total_odds, payout from bets where is_free_bet and status = 'won';
