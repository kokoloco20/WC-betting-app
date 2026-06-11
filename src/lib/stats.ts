import { teamByCode } from '../data/teams'
import { attributeProfit, betProfit, riskedStake } from './money'
import type { Bet, Player } from './types'
import { BET_TYPE_LABELS, MARKET_LABELS } from './types'

export interface Totals {
  staked: number
  returned: number
  profit: number
  roi: number | null
  winRate: number | null
}

export function totals(bets: Bet[]): Totals {
  const settled = bets.filter((b) => b.status !== 'pending')
  const staked = settled.reduce((s, b) => s + riskedStake(b), 0)
  const returned = settled.reduce((s, b) => s + (b.payout ?? 0), 0)
  const profit = returned - staked
  const decided = settled.filter((b) => b.status !== 'void')
  const won = decided.filter((b) => (betProfit(b) ?? 0) > 0)
  return {
    staked,
    returned,
    profit,
    roi: staked > 0 ? profit / staked : null,
    winRate: decided.length > 0 ? won.length / decided.length : null,
  }
}

export interface LeaderRow {
  key: string
  label: string
  profit: number
  betCount: number
}

function toRows(acc: Map<string, { label: string; profit: number; bets: Set<string> }>): LeaderRow[] {
  return [...acc.entries()]
    .map(([key, v]) => ({ key, label: v.label, profit: v.profit, betCount: v.bets.size }))
    .sort((a, b) => b.profit - a.profit)
}

function accumulate(
  acc: Map<string, { label: string; profit: number; bets: Set<string> }>,
  key: string,
  label: string,
  profit: number,
  betId: string,
) {
  const cur = acc.get(key) ?? { label, profit: 0, bets: new Set<string>() }
  cur.profit += profit
  cur.bets.add(betId)
  acc.set(key, cur)
}

/** Team a leg's money belongs to: explicit team, else the player's team. */
function legTeamCode(leg: Bet['legs'][number], players: Map<string, Player>): string | null {
  if (leg.team_code) return leg.team_code
  if (leg.player_id) return players.get(leg.player_id)?.team_code ?? null
  return null
}

export function profitByTeam(bets: Bet[], players: Map<string, Player>): LeaderRow[] {
  const acc = new Map<string, { label: string; profit: number; bets: Set<string> }>()
  for (const bet of bets) {
    const attr = attributeProfit(bet)
    for (const leg of bet.legs) {
      const code = legTeamCode(leg, players)
      if (!code) continue
      accumulate(acc, code, teamByCode.get(code)?.name ?? code, attr.get(leg.id) ?? 0, bet.id)
    }
  }
  return toRows(acc)
}

export function profitByPlayer(bets: Bet[], players: Map<string, Player>): LeaderRow[] {
  const acc = new Map<string, { label: string; profit: number; bets: Set<string> }>()
  for (const bet of bets) {
    const attr = attributeProfit(bet)
    for (const leg of bet.legs) {
      if (!leg.player_id) continue
      const name = players.get(leg.player_id)?.name ?? 'Unknown player'
      accumulate(acc, leg.player_id, name, attr.get(leg.id) ?? 0, bet.id)
    }
  }
  return toRows(acc)
}

export function profitByMarket(bets: Bet[]): LeaderRow[] {
  const acc = new Map<string, { label: string; profit: number; bets: Set<string> }>()
  for (const bet of bets) {
    const attr = attributeProfit(bet)
    for (const leg of bet.legs) {
      accumulate(acc, leg.market, MARKET_LABELS[leg.market], attr.get(leg.id) ?? 0, bet.id)
    }
  }
  return toRows(acc)
}

export function profitByBetType(bets: Bet[]): LeaderRow[] {
  const acc = new Map<string, { label: string; profit: number; bets: Set<string> }>()
  for (const bet of bets) {
    const profit = betProfit(bet)
    if (profit === null) continue
    accumulate(acc, bet.bet_type, BET_TYPE_LABELS[bet.bet_type], profit, bet.id)
  }
  return toRows(acc)
}

export function profitByBookmaker(bets: Bet[], bookmakerNames: Map<string, string>): LeaderRow[] {
  const acc = new Map<string, { label: string; profit: number; bets: Set<string> }>()
  for (const bet of bets) {
    const profit = betProfit(bet)
    if (profit === null) continue
    accumulate(acc, bet.bookmaker_id, bookmakerNames.get(bet.bookmaker_id) ?? '?', profit, bet.id)
  }
  return toRows(acc)
}

export function profitByLegCount(bets: Bet[]): LeaderRow[] {
  const acc = new Map<string, { label: string; profit: number; bets: Set<string> }>()
  for (const bet of bets) {
    const profit = betProfit(bet)
    if (profit === null) continue
    const n = bet.legs.length
    accumulate(acc, String(n).padStart(2, '0'), n === 1 ? '1 leg' : `${n} legs`, profit, bet.id)
  }
  return toRows(acc).sort((a, b) => a.key.localeCompare(b.key))
}

export interface ProfitPoint {
  date: string // ISO timestamp of settlement
  cumulative: number
}

export function cumulativeProfit(bets: Bet[]): ProfitPoint[] {
  const settled = bets
    .filter((b) => b.status !== 'pending')
    .sort((a, b) => (a.settled_at ?? a.placed_at).localeCompare(b.settled_at ?? b.placed_at))
  let running = 0
  return settled.map((b) => {
    running += betProfit(b) ?? 0
    return { date: b.settled_at ?? b.placed_at, cumulative: running }
  })
}
