import { matchByNumber } from '../data/matches'
import { matchLabel, teamName } from './format'
import type { Bet, KnockoutTeams, Leg, Player } from './types'
import { BET_TYPE_LABELS, MARKET_LABELS } from './types'

/** Human line for a leg: "Mbappé 2+ Shots on target · France – Senegal". */
export function legDescription(
  leg: Leg,
  players: Map<string, Player>,
  knockout: Map<number, KnockoutTeams>,
): { main: string; context: string | null } {
  const parts: string[] = []
  if (leg.player_id) parts.push(players.get(leg.player_id)?.name ?? 'Unknown player')
  else if (leg.team_code) parts.push(teamName(leg.team_code)!)
  if (leg.line) parts.push(leg.line)
  parts.push(MARKET_LABELS[leg.market])
  const match = leg.match_number ? matchByNumber.get(leg.match_number) : undefined
  return {
    main: parts.join(' '),
    context: match ? matchLabel(match, knockout) : null,
  }
}

/** Lower-cased haystack for free-text bet search. */
export function betSearchText(
  bet: Bet,
  players: Map<string, Player>,
  knockout: Map<number, KnockoutTeams>,
  bookmakerName: string,
): string {
  const parts = [bookmakerName, BET_TYPE_LABELS[bet.bet_type], bet.notes ?? '']
  for (const leg of bet.legs) {
    const d = legDescription(leg, players, knockout)
    parts.push(d.main, d.context ?? '')
  }
  return parts.join(' ').toLowerCase()
}
