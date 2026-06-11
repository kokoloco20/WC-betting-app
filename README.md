# ⚽ WC 2026 Bet Tracker

Personal betting tracker for the FIFA World Cup 2026. Log bets across
Bet365, Unibet and BetCity, settle them per leg, and see exactly which
teams, players, markets and bet types make or lose you money.

All 104 official matches are preloaded (kickoff times included). Knockout
slots show their bracket labels (e.g. *1A – 3CDFGH*) until you fill in the
real teams from the History tab.

**Stack:** React + TypeScript (Vite) · Tailwind CSS · Recharts · Supabase
(Postgres + magic-link auth) · deployable free on Vercel.

## Features

- **Dashboard** — profit, ROI, staked, win rate, profit-over-time chart, and
  leaderboards by team, player, market, bet type, bookmaker and number of
  legs. Tap any row to see the bets behind it.
- **Open bets** — pending bets by kickoff, total at risk and potential payout.
  Settle per leg (won/lost/void) or enter a cash-out amount.
- **New bet** — straight, parlay, bet builder, super boost or outright. Pick
  matches from the schedule; players are created once and autocompleted
  forever after. Free-bet flag keeps promo money out of your real ROI.
- **History** — filters on everything, CSV export, knockout bracket editor
  and bookmaker management.

Profit attribution rules (what makes "Mbappé lost me €40" precise): a won
bet's profit is split equally over its legs; a lost bet's stake is blamed
only on the legs that actually lost. Free bets count as €0 risk. The math
lives in [src/lib/money.ts](src/lib/money.ts) and is unit-tested.

## Setup (one time, ~10 minutes)

### 1. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, paste and run [supabase/schema.sql](supabase/schema.sql).
3. Authentication → Sign In / Up: make sure **Email** is enabled
   (magic links are the default).
4. Project Settings → API: copy the **Project URL** and **anon public key**.

### 2. Run locally

```bash
cp .env.example .env   # fill in the two values from step 1.4
npm install
npm run dev
```

Log in with your email, click the magic link, done. The three default
bookmakers are created automatically on first login.

### 3. Deploy to Vercel (free, for your phone)

1. Import the GitHub repo at [vercel.com](https://vercel.com)
   (framework preset: **Vite**).
2. Add the two environment variables from `.env` in the Vercel project
   settings, then deploy.
3. In Supabase: Authentication → URL Configuration → set **Site URL** to your
   Vercel URL so magic links redirect to the deployed app.
4. On your phone, open the URL and "Add to Home Screen".

## Development

```bash
npm test        # unit tests (money math)
npm run lint
npm run build
```

Match and team data are generated from the official schedule by
[scripts/gen-data.py](scripts/gen-data.py). The design spec lives in
[docs/superpowers/specs/](docs/superpowers/specs/).
