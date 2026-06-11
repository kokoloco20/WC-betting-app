import { matchByNumber } from '../data/matches'
import type { Bet } from './types'

/** Generous buffer past kickoff: 90 min + half-time + stoppage, extra time + pens. */
const MATCH_DURATION_MS = 165 * 60 * 1000

/**
 * A pending bet is ready to settle when every leg is tied to a match
 * and all those matches have finished. Outright legs never finish early,
 * so any leg without a match keeps the bet out of the list.
 */
export function isReadyToSettle(bet: Bet, now = Date.now()): boolean {
  if (bet.status !== 'pending' || bet.legs.length === 0) return false
  return bet.legs.every((leg) => {
    if (!leg.match_number) return false
    const match = matchByNumber.get(leg.match_number)
    if (!match) return false
    return new Date(match.kickoffUtc).getTime() + MATCH_DURATION_MS < now
  })
}
