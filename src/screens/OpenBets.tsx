import { useMemo, useState } from 'react'
import { BetCard } from '../components/BetCard'
import { matchByNumber } from '../data/matches'
import { useData } from '../lib/data'
import { legDescription } from '../lib/describe'
import { eur } from '../lib/format'
import { deriveStatus, potentialPayout, riskedStake } from '../lib/money'
import type { Bet, LegResult } from '../lib/types'

function earliestKickoff(bet: Bet): string {
  const times = bet.legs
    .map((l) => (l.match_number ? matchByNumber.get(l.match_number)?.kickoffUtc : null))
    .filter((t): t is string => !!t)
  return times.length ? times.reduce((a, b) => (a < b ? a : b)) : '9999'
}

export function OpenBets() {
  const { bets, loading } = useData()
  const open = useMemo(
    () =>
      bets
        .filter((b) => b.status === 'pending')
        .sort((a, b) => earliestKickoff(a).localeCompare(earliestKickoff(b))),
    [bets],
  )
  const atRisk = open.reduce((s, b) => s + riskedStake(b), 0)
  const potential = open.reduce((s, b) => s + potentialPayout(b), 0)

  if (loading) return <p className="text-neutral-400">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Open bets</h2>
        <p className="text-sm text-neutral-400">
          {eur(atRisk)} at risk · {eur(potential)} potential
        </p>
      </div>
      {open.length === 0 && <p className="text-neutral-400">No open bets. 🎉</p>}
      {open.map((bet) => (
        <BetCard key={bet.id} bet={bet}>
          <SettlePanel bet={bet} />
        </BetCard>
      ))}
    </div>
  )
}

const CYCLE: LegResult[] = ['pending', 'won', 'lost', 'void']

function SettlePanel({ bet }: { bet: Bet }) {
  const { players, knockout, settleBet, deleteBet } = useData()
  const [openPanel, setOpenPanel] = useState(false)
  const [results, setResults] = useState<Record<string, LegResult>>(
    () => Object.fromEntries(bet.legs.map((l) => [l.id, l.result])),
  )
  const [cashout, setCashout] = useState(false)
  const [payout, setPayout] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const derived = deriveStatus(bet.legs.map((l) => ({ result: results[l.id] })))
  const defaultPayout =
    derived === 'won'
      ? potentialPayout(bet)
      : derived === 'void'
        ? riskedStake(bet)
        : 0
  const effectiveStatus = cashout ? 'cashed_out' : derived
  const payoutValue = payout === '' ? defaultPayout : Number(payout)

  if (!openPanel) {
    return (
      <button className="btn-ghost w-full" onClick={() => setOpenPanel(true)}>
        Settle / cash out
      </button>
    )
  }

  const save = async () => {
    setError(null)
    if (cashout && payout === '') return setError('Enter the cash-out amount you received.')
    if (!cashout && derived === 'pending')
      return setError('Mark every leg, or tick cash-out with an amount.')
    if (Number.isNaN(payoutValue) || payoutValue < 0) return setError('Payout must be € 0 or more.')
    setBusy(true)
    try {
      await settleBet(bet, results, { cashedOut: cashout, payout: payoutValue })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <p className="lbl mb-0">Tap each leg to cycle: pending → won → lost → void</p>
      {bet.legs.map((leg) => {
        const d = legDescription(leg, players, knockout)
        const r = results[leg.id]
        const color =
          r === 'won' ? 'border-emerald-600 text-emerald-400'
          : r === 'lost' ? 'border-red-600 text-red-400'
          : 'border-neutral-700 text-neutral-400'
        return (
          <button
            key={leg.id}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${color}`}
            onClick={() =>
              setResults((cur) => ({
                ...cur,
                [leg.id]: CYCLE[(CYCLE.indexOf(cur[leg.id]) + 1) % CYCLE.length],
              }))
            }
          >
            <span className="text-neutral-200">{d.main}</span>
            <span className="font-semibold uppercase">{r}</span>
          </button>
        )
      })}

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={cashout} onChange={(e) => setCashout(e.target.checked)}
          className="h-4 w-4 accent-emerald-500" />
        Cashed out (enter the amount you received)
      </label>

      <div className="flex items-center gap-3">
        <div className="grow">
          <label className="lbl">Payout (€)</label>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
            value={payout} placeholder={String(defaultPayout)}
            onChange={(e) => setPayout(e.target.value)} />
        </div>
        <div className="pt-4 text-sm text-neutral-400">
          → {effectiveStatus.replace('_', ' ')}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button className="btn grow" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save result'}
        </button>
        <button className="btn-ghost" onClick={() => setOpenPanel(false)}>Cancel</button>
        <button
          className="btn-ghost border-red-900 text-red-400"
          onClick={async () => {
            if (window.confirm('Delete this bet entirely?')) await deleteBet(bet.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
