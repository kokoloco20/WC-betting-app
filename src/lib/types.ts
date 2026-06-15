export type BetType = 'straight' | 'parlay' | 'bet_builder' | 'super_boost' | 'outright'
export type BetStatus = 'pending' | 'won' | 'lost' | 'void' | 'cashed_out'
export type LegResult = 'pending' | 'won' | 'lost' | 'void'

export type Market =
  | 'shots_on_target'
  | 'shots'
  | 'passes'
  | 'tackles'
  | 'goals'
  | 'assists'
  | 'cards'
  | 'corners'
  | 'match_result'
  | 'over_under_goals'
  | 'btts'
  | 'outright'
  | 'bet_builder'
  | 'other'

/** The markets offered in the bet form, in display order. */
export const MARKET_OPTIONS: Market[] = [
  'shots_on_target',
  'shots',
  'passes',
  'tackles',
  'goals',
  'assists',
  'match_result',
  'over_under_goals',
  'btts',
  'outright',
  'bet_builder',
]

export const BET_TYPE_LABELS: Record<BetType, string> = {
  straight: 'Straight',
  parlay: 'Parlay',
  bet_builder: 'Bet builder',
  super_boost: 'Super boost', // legacy value; new bets use the is_super_boost flag
  outright: 'Outright',
}

/** Bet types offered in forms — super boost is a toggle, not a type. */
export const BET_TYPE_OPTIONS: BetType[] = ['straight', 'parlay', 'bet_builder', 'outright']

export const MARKET_LABELS: Record<Market, string> = {
  shots_on_target: 'Shots on target',
  shots: 'Shots',
  passes: 'Passes',
  tackles: 'Tackles',
  goals: 'Goals',
  assists: 'Assists',
  cards: 'Cards',
  corners: 'Corners',
  match_result: 'Match result',
  over_under_goals: 'Over/under',
  btts: 'Both teams to score',
  outright: 'Outright',
  bet_builder: 'Bet builder',
  other: 'Other',
}

export interface Bookmaker {
  id: string
  name: string
}

export interface Player {
  id: string
  name: string
  team_code: string
}

export interface Leg {
  id: string
  bet_id: string
  match_number: number | null
  market: Market
  player_id: string | null
  team_code: string | null
  line: string | null
  result: LegResult
}

export interface Bet {
  id: string
  bookmaker_id: string
  bet_type: BetType
  stake: number
  total_odds: number
  is_free_bet: boolean
  is_super_boost: boolean
  status: BetStatus
  payout: number | null
  placed_at: string
  settled_at: string | null
  notes: string | null
  legs: Leg[]
}

/** User-filled teams for a knockout placeholder match. */
export interface KnockoutTeams {
  match_number: number
  home_code: string | null
  away_code: string | null
}
