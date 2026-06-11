import { describe, expect, it } from 'vitest'
import { attributeProfit, betProfit, deriveStatus, potentialPayout } from './money'
import { cumulativeProfit, profitByLegCount, profitByPlayer, profitByTeam, totals } from './stats'
import type { Bet, Leg, LegResult, Market, Player } from './types'

let nextId = 0
function leg(result: LegResult, extra: Partial<Leg> = {}): Leg {
  return {
    id: `leg-${nextId++}`,
    bet_id: 'b',
    match_number: 1,
    market: 'shots_on_target' as Market,
    player_id: null,
    team_code: null,
    line: null,
    result,
    ...extra,
  }
}

function bet(extra: Partial<Bet> = {}): Bet {
  return {
    id: `bet-${nextId++}`,
    bookmaker_id: 'bk1',
    bet_type: 'straight',
    stake: 10,
    total_odds: 2,
    is_free_bet: false,
    is_super_boost: false,
    status: 'pending',
    payout: null,
    placed_at: '2026-06-12T12:00:00Z',
    settled_at: null,
    notes: null,
    legs: [leg('pending')],
    ...extra,
  }
}

describe('deriveStatus', () => {
  it('is lost as soon as any leg is lost', () => {
    expect(deriveStatus([leg('won'), leg('lost'), leg('pending')])).toBe('lost')
  })
  it('is won when all legs are won', () => {
    expect(deriveStatus([leg('won'), leg('won')])).toBe('won')
  })
  it('ignores void legs when all others won', () => {
    expect(deriveStatus([leg('won'), leg('void')])).toBe('won')
  })
  it('is void when every leg is void', () => {
    expect(deriveStatus([leg('void'), leg('void')])).toBe('void')
  })
  it('stays pending while legs are undecided', () => {
    expect(deriveStatus([leg('won'), leg('pending')])).toBe('pending')
  })
})

describe('betProfit', () => {
  it('is null while pending', () => {
    expect(betProfit(bet())).toBeNull()
  })
  it('won: payout minus stake', () => {
    expect(betProfit(bet({ status: 'won', payout: 25, stake: 10 }))).toBe(15)
  })
  it('lost: minus stake', () => {
    expect(betProfit(bet({ status: 'lost', payout: 0, stake: 10 }))).toBe(-10)
  })
  it('void: refund means zero profit', () => {
    expect(betProfit(bet({ status: 'void', payout: 10, stake: 10 }))).toBe(0)
  })
  it('free bet risks nothing: whole payout is profit, loss is zero', () => {
    expect(betProfit(bet({ status: 'won', payout: 25, stake: 10, is_free_bet: true }))).toBe(25)
    expect(betProfit(bet({ status: 'lost', payout: 0, stake: 10, is_free_bet: true }))).toBe(0)
  })
  it('cash out: custom payout', () => {
    expect(betProfit(bet({ status: 'cashed_out', payout: 7.5, stake: 10 }))).toBe(-2.5)
  })
})

describe('potentialPayout', () => {
  it('is stake times total odds', () => {
    expect(potentialPayout(bet({ stake: 10, total_odds: 3.5 }))).toBe(35)
  })
})

describe('attributeProfit', () => {
  it('won bet: profit split equally across legs', () => {
    const legs = [leg('won'), leg('won'), leg('won')]
    const b = bet({ status: 'won', payout: 40, stake: 10, legs })
    const attr = attributeProfit(b)
    for (const l of legs) expect(attr.get(l.id)).toBe(10)
  })
  it('won bet: void legs get nothing', () => {
    const legs = [leg('won'), leg('void')]
    const b = bet({ status: 'won', payout: 30, stake: 10, legs })
    const attr = attributeProfit(b)
    expect(attr.get(legs[0].id)).toBe(20)
    expect(attr.get(legs[1].id)).toBe(0)
  })
  it('lost parlay: loss split across losing legs only', () => {
    const legs = [leg('won'), leg('lost'), leg('lost')]
    const b = bet({ status: 'lost', payout: 0, stake: 12, legs })
    const attr = attributeProfit(b)
    expect(attr.get(legs[0].id)).toBe(0)
    expect(attr.get(legs[1].id)).toBe(-6)
    expect(attr.get(legs[2].id)).toBe(-6)
  })
  it('negative cash-out with no lost legs: falls back to non-void legs', () => {
    const legs = [leg('won'), leg('pending')]
    const b = bet({ status: 'cashed_out', payout: 4, stake: 10, legs })
    const attr = attributeProfit(b)
    expect(attr.get(legs[0].id)).toBe(-3)
    expect(attr.get(legs[1].id)).toBe(-3)
  })
  it('pending bets attribute nothing', () => {
    const legs = [leg('pending')]
    const attr = attributeProfit(bet({ legs }))
    expect(attr.get(legs[0].id)).toBe(0)
  })
  it('lost free bet attributes zero (no real money lost)', () => {
    const legs = [leg('lost')]
    const b = bet({ status: 'lost', payout: 0, is_free_bet: true, legs })
    expect(attributeProfit(b).get(legs[0].id)).toBe(0)
  })
})

describe('totals', () => {
  it('computes staked, profit, roi and win rate over settled bets', () => {
    const bets = [
      bet({ status: 'won', payout: 25, stake: 10, legs: [leg('won')] }),
      bet({ status: 'lost', payout: 0, stake: 10, legs: [leg('lost')] }),
      bet({ status: 'void', payout: 10, stake: 10, legs: [leg('void')] }),
      bet({ stake: 99 }), // pending: excluded everywhere
    ]
    const t = totals(bets)
    expect(t.staked).toBe(30)
    expect(t.returned).toBe(35)
    expect(t.profit).toBe(5)
    expect(t.roi).toBeCloseTo(5 / 30)
    expect(t.winRate).toBe(0.5) // void bet not counted as decided
  })
})

describe('leaderboards', () => {
  const players = new Map<string, Player>([
    ['p1', { id: 'p1', name: 'Mbappé', team_code: 'FRA' }],
    ['p2', { id: 'p2', name: 'Depay', team_code: 'NED' }],
  ])

  it('profitByPlayer splits a won builder between its players', () => {
    const legs = [leg('won', { player_id: 'p1' }), leg('won', { player_id: 'p2' })]
    const rows = profitByPlayer([bet({ status: 'won', payout: 30, stake: 10, legs })], players)
    expect(rows).toHaveLength(2)
    expect(rows[0].profit).toBe(10)
    expect(rows[1].profit).toBe(10)
  })

  it('profitByTeam uses explicit team, else the player team', () => {
    const legs = [
      leg('lost', { team_code: 'GER', market: 'match_result' }),
      leg('won', { player_id: 'p1' }),
    ]
    const rows = profitByTeam([bet({ status: 'lost', payout: 0, stake: 10, legs })], players)
    const ger = rows.find((r) => r.key === 'GER')
    const fra = rows.find((r) => r.key === 'FRA')
    expect(ger?.profit).toBe(-10) // only the losing leg is blamed
    expect(ger?.label).toBe('Germany')
    expect(fra?.profit).toBe(0)
  })

  it('profitByLegCount groups whole-bet profit by number of legs', () => {
    const bets = [
      bet({ status: 'won', payout: 20, stake: 10, legs: [leg('won')] }),
      bet({ status: 'lost', payout: 0, stake: 5, legs: [leg('lost'), leg('won'), leg('won')] }),
    ]
    const rows = profitByLegCount(bets)
    expect(rows.map((r) => r.label)).toEqual(['1 leg', '3 legs'])
    expect(rows.map((r) => r.profit)).toEqual([10, -5])
  })
})

describe('cumulativeProfit', () => {
  it('runs a cumulative total in settlement order', () => {
    const bets = [
      bet({ status: 'lost', payout: 0, stake: 10, settled_at: '2026-06-14T00:00:00Z', legs: [leg('lost')] }),
      bet({ status: 'won', payout: 30, stake: 10, settled_at: '2026-06-13T00:00:00Z', legs: [leg('won')] }),
    ]
    const points = cumulativeProfit(bets)
    expect(points.map((p) => p.cumulative)).toEqual([20, 10])
  })
})
