import { matchByNumber } from '../data/matches'
import { matchLabel, teamName } from './format'
import type { KnockoutTeams, Leg, Player } from './types'
import { MARKET_LABELS } from './types'

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
