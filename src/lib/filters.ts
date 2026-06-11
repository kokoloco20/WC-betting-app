/** A dashboard drill-down: clicking a leaderboard row opens History filtered to it. */
export interface Drill {
  kind: 'team' | 'player' | 'market' | 'betType' | 'bookmaker' | 'legs'
  key: string
}
