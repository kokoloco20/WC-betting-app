# World Cup 2026 Betting Tracker — Design

**Date:** 2026-06-11
**Status:** Approved by user (brainstorming session)

## Purpose

A personal web app for Koray to track his bets on the FIFA World Cup 2026
(June 11 – July 19, 2026) across three bookmakers, and to see which teams,
players, markets, and bet types make or lose him money. Single user. Used on
phone and laptop with synced data. Source code lives on his GitHub.

## Architecture

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, Recharts for charts.
  Mobile-first layout with a bottom tab bar; works equally well on desktop.
- **Backend:** Supabase free tier — Postgres database, auth via email magic
  link, row-level security so only Koray's login can read/write his rows.
  No custom server.
- **Hosting:** Vercel free tier (static deploy from the GitHub repo).
- **Currency:** EUR. **Odds format:** decimal.

## Data model

Six tables. All user data rows carry the owner's `user_id` for RLS.

### `bookmakers`
Seeded with Bet365, Unibet, BetCity. User can add more (see History screen).
Fields: `id`, `name`.

### `teams`
All 48 qualified teams, preloaded (static seed data).
Fields: `id`, `name`, `code` (FIFA 3-letter), `group` (A–L).

### `matches`
All 104 World Cup matches preloaded as seed data:
- 72 group-stage fixtures with real teams, kickoff times (stored UTC,
  displayed local), and stage label.
- 32 knockout fixtures (Round of 32 through Final, incl. third-place match)
  preloaded as placeholders with their real kickoff times but null teams,
  labeled by official match number (e.g. "R32 — Match 74"). The user fills in
  teams via an edit screen once the bracket is known.

Fields: `id`, `match_number`, `stage`
(`group | r32 | r16 | qf | sf | third_place | final`),
`home_team_id` (nullable), `away_team_id` (nullable), `kickoff_utc`.

The real fixture list (teams, match numbers, kickoff times) is sourced during
implementation from the official FIFA schedule.

### `players`
Created on first use ("type once, reuse after"): when logging a leg, the user
types a player name (and picks the team); the player is saved and offered via
autocomplete from then on. No preloaded squads.
Fields: `id`, `name`, `team_id`.

### `bets`
One row per bet placed.
Fields: `id`, `bookmaker_id`, `bet_type`
(`straight | parlay | bet_builder | super_boost | outright`),
`stake` (EUR), `total_odds` (decimal), `is_free_bet` (bool),
`status` (`pending | won | lost | void | cashed_out`),
`payout` (actual amount returned; null while pending — supports cash-outs at
any amount), `placed_at`, `notes` (optional free text).

### `legs`
One or more per bet.
Fields: `id`, `bet_id`, `match_id` (nullable — null for outrights),
`market` (`shots_on_target | shots | passes | tackles | goals | assists |
cards | corners | match_result | over_under_goals | btts | outright | other`),
`player_id` (nullable), `team_id` (nullable — e.g. "France to win"),
`line` (nullable text, e.g. "2+", "Over 2.5"),
`result` (`pending | won | lost | void`).

Bet-type behavior in the form:
- **Straight:** exactly one leg.
- **Parlay:** multiple legs, any matches.
- **Bet builder:** multiple legs; match picked once and pre-filled for all legs.
- **Super boost:** same as straight/builder but flagged as the boost type.
- **Outright:** legs have no match; team and/or player + `outright` market
  (e.g. tournament winner, top scorer).

## Money math (the rules that make stats meaningful)

- **Bet profit:** `payout − stake` (free bets: stake counts as €0 risk, so
  profit = payout).
- **Overall result derives from legs:** all legs won (voids ignored) → won;
  any leg lost → lost; cash-out is set manually with a custom payout.
- **Profit attribution to legs** (powers per-player/team/market stats):
  - Bet **won**: profit split equally across non-void legs.
  - Bet **lost**: stake loss split equally across **losing legs only** —
    winning legs inside a lost parlay are not blamed.
  - **Void** legs and fully void bets attribute €0.
  - **Cashed out**: treated as won/lost by sign of profit, same split rules
    applied to non-void legs (losing legs if profit < 0, all non-void legs if
    profit ≥ 0).
- A leg's attributed profit rolls up to its player, its team(s), its market,
  and its match's teams where applicable.

## Screens

Bottom tab bar: **Dashboard · Open bets · New bet · History**.

### Dashboard
- Headline cards: total profit, ROI (profit ÷ total real-money staked),
  total staked, win rate (settled bets won ÷ settled).
- Profit-over-time line chart (cumulative, by settlement date).
- Leaderboards (ranked lists, tap an entry to see its underlying bets):
  best/worst **team**, best/worst **player**, profit by **market**, by
  **bet type**, by **bookmaker**, by **number of legs** (1, 2, 3, …).

### Open bets
- Pending bets sorted by earliest leg kickoff; total stake at risk and total
  potential payout shown at top.
- Tap a bet → settlement: mark each leg won/lost/void (overall result
  derived), or enter a cash-out amount.

### New bet
- One form: bookmaker, bet type, stake, total odds, free-bet toggle, legs.
- Per leg: match dropdown (grouped by date, upcoming first), market dropdown,
  optional player (autocomplete; "add new player" inline), optional line.
- Defaults tuned for speed: today's date, last-used bookmaker.

### History
- All settled bets; filters: bookmaker, bet type, team, player, market.
- **CSV export** of all bets + legs.
- **Matches** section: edit knockout placeholder fixtures to set real teams.
- **Bookmakers** section: add/rename bookmakers (covers the "extendable
  bookmaker list" — no separate settings screen).

## Error handling

- Failed saves (e.g. offline at the stadium) keep the form state and show a
  retry button — input is never silently lost.
- Supabase writes are awaited and surfaced; no optimistic UI that can lie.
- Settled bets can be edited (typos happen); stats always recompute from data.

## Testing

- Unit tests on the money math: profit attribution, result derivation,
  cash-outs, free bets, ROI/win-rate — the code where a bug actually matters.
- Light smoke tests for rendering and the new-bet form flow.

## Out of scope (v1)

- Live scores / auto-settlement APIs (manual settlement keeps it free and
  never wrong; revisit if settling gets tedious).
- Preloaded full squads (~1,250 players).
- Multi-user support, odds-history tracking, bankroll/deposit ledger.
