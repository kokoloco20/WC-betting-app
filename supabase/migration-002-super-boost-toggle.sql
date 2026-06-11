-- Migration 002 — run once in the Supabase SQL editor (safe to re-run).
-- Super boost becomes a toggle on any bet instead of a bet type.

alter table bets add column if not exists is_super_boost boolean not null default false;

-- Convert legacy super_boost bets: flag them and restore the structural type
update bets set is_super_boost = true where bet_type = 'super_boost';
update bets b
set bet_type = case
  when (select count(*) from legs l where l.bet_id = b.id) > 1 then 'parlay'
  else 'straight'
end
where bet_type = 'super_boost';
