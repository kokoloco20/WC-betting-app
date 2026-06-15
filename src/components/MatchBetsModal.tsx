import { useMemo } from 'react'
import { matchByNumber } from '../data/matches'
import { useData } from '../lib/data'
import { eur, kickoffLocal, matchLabel, profitColor, signedEur, stagePrefix } from '../lib/format'
import { betProfit, potentialPayout, riskedStake } from '../lib/money'
import { BetCard } from './BetCard'

/** Overlay listing every bet that has a leg on a given match. */
export function MatchBetsModal({ matchNumber, onClose }: { matchNumber: number; onClose: () => void }) {
  const { bets, knockout } = useData()
  const match = matchByNumber.get(matchNumber)

  const onMatch = useMemo(
    () => bets.filter((b) => b.legs.some((l) => l.match_number === matchNumber)),
    [bets, matchNumber],
  )

  const open = onMatch.filter((b) => b.status === 'pending')
  const settled = onMatch.filter((b) => b.status !== 'pending')
  const atRisk = open.reduce((s, b) => s + riskedStake(b), 0)
  const potential = open.reduce((s, b) => s + potentialPayout(b), 0)
  const settledProfit = settled.reduce((s, b) => s + (betProfit(b) ?? 0), 0)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}>
      <div
        className="panel max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-white/10 p-4">
          <div>
            <p className="font-semibold">{match ? matchLabel(match, knockout) : 'Match'}</p>
            {match && (
              <p className="num text-xs text-neutral-500">
                {stagePrefix(match)} · {kickoffLocal(match.kickoffUtc)}
              </p>
            )}
          </div>
          <button className="text-neutral-500 hover:text-neutral-200" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-4 p-4">
          {onMatch.length === 0 && <p className="text-neutral-400">No bets on this match yet.</p>}

          {open.length > 0 && (
            <p className="num text-sm text-neutral-400">
              {open.length} open · {eur(atRisk)} at risk ·{' '}
              <span className="text-emerald-400">{eur(potential)}</span> potential
            </p>
          )}
          {settled.length > 0 && (
            <p className="num text-sm text-neutral-400">
              {settled.length} settled ·{' '}
              <span className={profitColor(settledProfit)}>{signedEur(settledProfit)}</span>
            </p>
          )}

          {[...open, ...settled].map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      </div>
    </div>
  )
}
