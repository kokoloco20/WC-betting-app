import { useMemo, useState } from 'react'
import { BetCard } from '../components/BetCard'
import { matchByNumber } from '../data/matches'
import { useData } from '../lib/data'
import { legDescription } from '../lib/describe'
import { eur } from '../lib/format'
import { deriveStatus, potentialPayout, riskedStake } from '../lib/money'
import type { Bet, BetType, LegResult } from '../lib/types'
import { BET_TYPE_LABELS } from '../lib/types'

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
        <p className="num text-sm text-neutral-400">
          {eur(atRisk)} at risk · <span className="text-emerald-400">{eur(potential)}</span> potential
        </p>
      </div>
      {open.length === 0 && <p className="text-neutral-400">No open bets. 🎉</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {open.map((bet) => (
          <BetCard key={bet.id} bet={bet}>
            <BetActions bet={bet} />
          </BetCard>
        ))}
      </div>
    </div>
  )
}

const RESULT_OPTIONS: { value: LegResult; label: string; active: string }[] = [
  { value: 'pending', label: '·', active: 'bg-white/10 text-neutral-200' },
  { value: 'won', label: '✓ won', active: 'bg-emerald-500/25 text-emerald-300' },
  { value: 'lost', label: '✗ lost', active: 'bg-rose-500/25 text-rose-300' },
  { value: 'void', label: '– void', active: 'bg-sky-500/20 text-sky-300' },
]

function BetActions({ bet }: { bet: Bet }) {
  const { deleteBet } = useData()
  const [panel, setPanel] = useState<'none' | 'settle' | 'edit'>('none')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className="btn-ghost grow" onClick={() => setPanel(panel === 'settle' ? 'none' : 'settle')}>
          Settle / cash out
        </button>
        <button className="btn-ghost" title="Edit bet"
          onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}>
          ✏️
        </button>
        <button className="btn-ghost !border-rose-900/60" title="Delete bet"
          onClick={async () => {
            if (!window.confirm('Delete this bet entirely?')) return
            try {
              await deleteBet(bet.id)
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}>
          🗑️
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {panel === 'settle' && <SettlePanel bet={bet} onClose={() => setPanel('none')} />}
      {panel === 'edit' && <EditPanel bet={bet} onClose={() => setPanel('none')} />}
    </div>
  )
}

function SettlePanel({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const { players, knockout, settleBet } = useData()
  const [results, setResults] = useState<Record<string, LegResult>>(
    () => Object.fromEntries(bet.legs.map((l) => [l.id, l.result])),
  )
  const [cashout, setCashout] = useState(false)
  const [adjust, setAdjust] = useState(false)
  const [payout, setPayout] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const derived = deriveStatus(bet.legs.map((l) => ({ result: results[l.id] })))
  const defaultPayout =
    derived === 'won' ? potentialPayout(bet) : derived === 'void' ? riskedStake(bet) : 0
  const manualEntry = cashout || adjust
  const payoutValue = manualEntry && payout !== '' ? Number(payout) : defaultPayout
  const effectiveStatus = cashout ? 'cashed_out' : derived

  const save = async () => {
    setError(null)
    if (cashout && payout === '') return setError('Enter the cash-out amount you received.')
    if (!cashout && derived === 'pending')
      return setError('Set every leg to won/lost/void, or tick cash-out.')
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
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
      {bet.legs.map((leg) => {
        const d = legDescription(leg, players, knockout)
        const current = results[leg.id]
        return (
          <div key={leg.id} className="space-y-1.5">
            <p className="text-sm text-neutral-200">{d.main}</p>
            <div className="flex gap-1">
              {RESULT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setResults((cur) => ({ ...cur, [leg.id]: o.value }))}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    current === o.value ? o.active : 'text-neutral-600 hover:bg-white/5 hover:text-neutral-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <label className="flex items-center gap-2 border-t border-white/10 pt-3 text-sm text-neutral-300">
        <input type="checkbox" checked={cashout} onChange={(e) => setCashout(e.target.checked)}
          className="h-4 w-4 accent-emerald-500" />
        Cashed out early
      </label>

      {cashout ? (
        <div>
          <label className="lbl">Amount received (€)</label>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
            value={payout} placeholder="0.00" onChange={(e) => setPayout(e.target.value)} autoFocus />
        </div>
      ) : derived === 'pending' ? (
        <p className="text-xs text-neutral-500">Set each leg above — the payout is calculated for you.</p>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <p className="num">
            <span className="text-neutral-400 capitalize">{derived}</span>
            <span className="mx-1.5 text-neutral-600">→</span>
            <span className={derived === 'won' ? 'font-semibold text-emerald-400' : 'text-neutral-300'}>
              returns {eur(payoutValue)}
            </span>
          </p>
          <button className="text-xs text-neutral-500 underline hover:text-neutral-300"
            onClick={() => setAdjust((a) => !a)}>
            {adjust ? 'auto' : 'adjust'}
          </button>
        </div>
      )}
      {adjust && !cashout && (
        <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
          value={payout} placeholder={String(defaultPayout)}
          onChange={(e) => setPayout(e.target.value)} autoFocus />
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex gap-2">
        <button className="btn grow !py-2" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : `Save · ${effectiveStatus.replace('_', ' ')}`}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function EditPanel({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const { bookmakers, updateBet } = useData()
  const [bookmakerId, setBookmakerId] = useState(bet.bookmaker_id)
  const [betType, setBetType] = useState<BetType>(bet.bet_type)
  const [stake, setStake] = useState(String(bet.stake))
  const [odds, setOdds] = useState(String(bet.total_odds))
  const [freeBet, setFreeBet] = useState(bet.is_free_bet)
  const [notes, setNotes] = useState(bet.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    const stakeN = Number(stake)
    const oddsN = Number(odds)
    if (!(stakeN > 0)) return setError('Stake must be above €0.')
    if (!(oddsN >= 1)) return setError('Odds must be 1.00 or higher.')
    setBusy(true)
    try {
      await updateBet(bet.id, {
        bookmaker_id: bookmakerId,
        bet_type: betType,
        stake: stakeN,
        total_odds: oddsN,
        is_free_bet: freeBet,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="lbl">Bookmaker</label>
          <select className="input" value={bookmakerId} onChange={(e) => setBookmakerId(e.target.value)}>
            {bookmakers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Bet type</label>
          <select className="input" value={betType} onChange={(e) => setBetType(e.target.value as BetType)}>
            {(Object.keys(BET_TYPE_LABELS) as BetType[]).map((t) => (
              <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Stake (€)</label>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
            value={stake} onChange={(e) => setStake(e.target.value)} />
        </div>
        <div>
          <label className="lbl">Total odds</label>
          <input className="input" type="number" min="1" step="0.01" inputMode="decimal"
            value={odds} onChange={(e) => setOdds(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={freeBet} onChange={(e) => setFreeBet(e.target.checked)}
          className="h-4 w-4 accent-emerald-500" />
        Free bet / promo money
      </label>
      <div>
        <label className="lbl">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button className="btn grow !py-2" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
