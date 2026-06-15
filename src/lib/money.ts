import type { Bet, BetStatus, Leg } from './types'

/** Stake actually at risk: free bets risk nothing of your own money. */
export function riskedStake(bet: Pick<Bet, 'stake' | 'is_free_bet'>): number {
  return bet.is_free_bet ? 0 : bet.stake
}

/** Realised profit of a settled bet, or null while pending. */
export function betProfit(bet: Bet): number | null {
  if (bet.status === 'pending') return null
  return (bet.payout ?? 0) - riskedStake(bet)
}

/**
 * What you actually receive if every leg wins. For a free / bonus bet the
 * stake is not returned ("stake not returned"), so you only get the winnings.
 */
export function potentialPayout(bet: Pick<Bet, 'stake' | 'total_odds' | 'is_free_bet'>): number {
  return bet.is_free_bet ? bet.stake * (bet.total_odds - 1) : bet.stake * bet.total_odds
}

/**
 * Overall bet status derived from leg results:
 * any leg lost -> lost; all legs void -> void;
 * all decided (won/void, at least one won) -> won; otherwise pending.
 */
export function deriveStatus(legs: Pick<Leg, 'result'>[]): BetStatus {
  if (legs.some((l) => l.result === 'lost')) return 'lost'
  if (legs.length > 0 && legs.every((l) => l.result === 'void')) return 'void'
  if (legs.length > 0 && legs.every((l) => l.result === 'won' || l.result === 'void')) return 'won'
  return 'pending'
}

/**
 * Split a bet's realised profit across its legs, for per-player/team/market stats.
 *
 * - won (or cashed out in profit): split equally across non-void legs
 * - lost: loss split equally across losing legs only (winning legs in a lost
 *   parlay are not blamed); if nothing is marked lost (e.g. a negative
 *   cash-out), fall back to all non-void legs
 * - void legs and fully void bets attribute 0
 *
 * Returns leg id -> attributed profit. Pending bets attribute nothing.
 */
export function attributeProfit(bet: Bet): Map<string, number> {
  const out = new Map<string, number>(bet.legs.map((l) => [l.id, 0]))
  const profit = betProfit(bet)
  if (profit === null || profit === 0 || bet.legs.length === 0) return out

  const nonVoid = bet.legs.filter((l) => l.result !== 'void')
  let targets: Leg[]
  if (profit < 0) {
    const lost = bet.legs.filter((l) => l.result === 'lost')
    targets = lost.length > 0 ? lost : nonVoid
  } else {
    targets = nonVoid
  }
  if (targets.length === 0) return out

  for (const leg of targets) out.set(leg.id, profit / targets.length)
  return out
}
