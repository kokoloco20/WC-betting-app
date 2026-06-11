import type { ReactNode } from 'react'
import { useData } from '../lib/data'
import { legDescription } from '../lib/describe'
import { eur, profitColor, signedEur } from '../lib/format'
import { betProfit, potentialPayout } from '../lib/money'
import type { Bet, LegResult } from '../lib/types'
import { BET_TYPE_LABELS } from '../lib/types'

const RESULT_ICON: Record<LegResult, string> = {
  pending: '·',
  won: '✓',
  lost: '✗',
  void: '–',
}

const RESULT_COLOR: Record<LegResult, string> = {
  pending: 'text-neutral-500',
  won: 'text-emerald-400',
  lost: 'text-red-400',
  void: 'text-neutral-500',
}

export function BetCard({ bet, children }: { bet: Bet; children?: ReactNode }) {
  const { bookmakers, players, knockout } = useData()
  const bookmaker = bookmakers.find((b) => b.id === bet.bookmaker_id)?.name ?? '?'
  const profit = betProfit(bet)

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{bookmaker}</span>
          <span className="badge">{BET_TYPE_LABELS[bet.bet_type]}</span>
          {bet.is_super_boost && <span className="badge !border-amber-500/50 !bg-amber-500/10 text-amber-300">⚡ Boost</span>}
          {bet.is_free_bet && <span className="badge border-amber-600 text-amber-400">Free bet</span>}
        </div>
        <div className="text-right text-sm">
          {profit === null ? (
            <>
              <div className="text-neutral-300">
                {eur(bet.stake)} @ {bet.total_odds}
              </div>
              <div className="text-xs text-neutral-500">→ {eur(potentialPayout(bet))}</div>
            </>
          ) : (
            <>
              <div className={`font-semibold ${profitColor(profit)}`}>{signedEur(profit)}</div>
              <div className="text-xs text-neutral-500">
                {eur(bet.stake)} @ {bet.total_odds}
                {bet.status === 'cashed_out' && ' · cashed out'}
                {bet.status === 'void' && ' · void'}
              </div>
            </>
          )}
        </div>
      </div>

      <ul className="space-y-1">
        {bet.legs.map((leg) => {
          const d = legDescription(leg, players, knockout)
          return (
            <li key={leg.id} className="flex items-baseline gap-2 text-sm">
              <span className={`w-3 shrink-0 text-center font-bold ${RESULT_COLOR[leg.result]}`}>
                {RESULT_ICON[leg.result]}
              </span>
              <span className="text-neutral-200">{d.main}</span>
              {d.context && <span className="truncate text-xs text-neutral-500">{d.context}</span>}
            </li>
          )
        })}
      </ul>

      {bet.notes && <p className="text-xs text-neutral-500 italic">{bet.notes}</p>}
      {children}
    </div>
  )
}
