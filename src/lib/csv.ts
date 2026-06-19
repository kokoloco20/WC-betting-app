import { matchByNumber } from '../data/matches'
import { matchLabel } from './format'
import { betProfit } from './money'
import type { Bet, Bookmaker, KnockoutTeams, Player } from './types'
import { teamByCode } from '../data/teams'

function esc(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per leg, bet-level columns repeated — easy to pivot in a spreadsheet. */
export function betsToCsv(
  bets: Bet[],
  players: Map<string, Player>,
  bookmakers: Bookmaker[],
  knockout: Map<number, KnockoutTeams>,
): string {
  const bookmakerName = new Map(bookmakers.map((b) => [b.id, b.name]))
  const header = [
    'bet_id', 'placed_at', 'bookmaker', 'bet_type', 'stake', 'total_odds',
    'free_bet', 'super_boost', 'status', 'payout', 'profit', 'settled_at', 'notes',
    'leg_match', 'leg_market', 'leg_player', 'leg_team', 'leg_line', 'leg_result',
  ]
  const rows = [header.join(',')]
  for (const bet of bets) {
    const base = [
      bet.id, bet.placed_at, bookmakerName.get(bet.bookmaker_id) ?? '', bet.bet_type,
      bet.stake, bet.total_odds, bet.is_free_bet, bet.is_super_boost, bet.status, bet.payout,
      betProfit(bet), bet.settled_at, bet.notes,
    ]
    for (const leg of bet.legs) {
      const match = leg.match_number ? matchByNumber.get(leg.match_number) : undefined
      const player = leg.player_id ? players.get(leg.player_id) : undefined
      rows.push(
        [
          ...base,
          match ? matchLabel(match, knockout) : (leg.custom_event ?? ''),
          leg.market,
          player?.name,
          leg.team_code ? (teamByCode.get(leg.team_code)?.name ?? leg.team_code) : '',
          leg.line,
          leg.result,
        ]
          .map(esc)
          .join(','),
      )
    }
  }
  return rows.join('\n')
}

export function downloadCsv(content: string, filename: string) {
  // BOM so Excel opens it as UTF-8
  const bom = String.fromCharCode(0xfeff)
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
