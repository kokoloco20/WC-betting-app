import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { BetCard } from '../components/BetCard'
import { matchByNumber } from '../data/matches'
import { useData } from '../lib/data'
import { betSearchText, legDescription } from '../lib/describe'
import { isReadyToSettle } from '../lib/ready'
import { eur } from '../lib/format'
import { deriveStatus, potentialPayout, riskedStake } from '../lib/money'
import type { Bet, BetType, LegResult } from '../lib/types'
import { BET_TYPE_LABELS, BET_TYPE_OPTIONS } from '../lib/types'

function earliestKickoff(bet: Bet): string {
  const times = bet.legs
    .map((l) => (l.match_number ? matchByNumber.get(l.match_number)?.kickoffUtc : null))
    .filter((t): t is string => !!t)
  return times.length ? times.reduce((a, b) => (a < b ? a : b)) : '9999'
}

export function OpenBets() {
  const { bets, players, knockout, bookmakers, freeBetBalances, loading } = useData()
  const [view, setView] = useState<'open' | 'freebets'>('open')
  const [query, setQuery] = useState('')
  const open = useMemo(() => {
    const bookmakerName = new Map(bookmakers.map((b) => [b.id, b.name]))
    const q = query.trim().toLowerCase()
    return bets
      .filter((b) => b.status === 'pending')
      .filter((b) => !q || betSearchText(b, players, knockout, bookmakerName.get(b.bookmaker_id) ?? '').includes(q))
      .sort((a, b) => earliestKickoff(a).localeCompare(earliestKickoff(b)))
  }, [bets, query, players, knockout, bookmakers])
  const atRisk = open.reduce((s, b) => s + riskedStake(b), 0)
  const potential = open.reduce((s, b) => s + potentialPayout(b), 0)
  const totalFreeBet = bookmakers.reduce((s, b) => s + (freeBetBalances.get(b.id) ?? 0), 0)

  if (loading) return <p className="text-neutral-400">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1 text-sm font-medium">
        {([['open', `⏳ Open (${open.length})`], ['freebets', `⚡ Free bets (${eur(totalFreeBet)})`]] as const).map(
          ([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`grow rounded-lg py-1.5 transition-colors ${
                view === v ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-500 hover:text-neutral-300'
              }`}>
              {label}
            </button>
          ),
        )}
      </div>

      {view === 'freebets' ? (
        <FreeBetBalances />
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Open bets</h2>
            <p className="num text-sm text-neutral-400">
              {eur(atRisk)} at risk · <span className="text-emerald-400">{eur(potential)}</span> potential
            </p>
          </div>
          <input className="input" placeholder="🔍 Search team, player, market…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          {open.length === 0 && (
            <p className="text-neutral-400">{query ? 'No bets match your search.' : 'No open bets. 🎉'}</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {open.map((bet) => (
              <BetCard key={bet.id} bet={bet}>
                {isReadyToSettle(bet) && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                    ⏱️ Matches finished — ready to settle
                  </p>
                )}
                <BetActions bet={bet} />
              </BetCard>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FreeBetBalances() {
  const { bookmakers, freeBetBalances, setFreeBetBalance } = useData()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async (bookmakerId: string, raw: string) => {
    const value = Number(raw)
    if (raw.trim() === '' || Number.isNaN(value) || value < 0) return setError('Enter an amount of € 0 or more.')
    setBusy(bookmakerId)
    setError(null)
    try {
      await setFreeBetBalance(bookmakerId, value)
      setDrafts((d) => {
        const next = { ...d }
        delete next[bookmakerId]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Your remaining free-bet credit per bookmaker. Placing a free bet automatically subtracts its
        stake here.
      </p>
      {bookmakers.map((b) => {
        const current = freeBetBalances.get(b.id) ?? 0
        const draft = drafts[b.id]
        const dirty = draft !== undefined && Number(draft) !== current
        return (
          <div key={b.id} className="card flex items-center gap-3">
            <span className="grow font-medium">{b.name}</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-2 left-3 text-sm text-neutral-500">€</span>
              <input
                className="input num w-28 pl-6 text-right"
                type="number" min="0" step="0.01" inputMode="decimal"
                value={draft ?? current}
                onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
              />
            </div>
            <button className="btn !py-2 disabled:opacity-30"
              disabled={!dirty || busy === b.id}
              onClick={() => save(b.id, draft ?? String(current))}>
              {busy === b.id ? '…' : 'Save'}
            </button>
          </div>
        )
      })}
      {error && <p className="text-sm text-rose-400">{error}</p>}
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
  const [payout, setPayout] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const celebrate = () =>
    confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.7 },
      colors: ['#10b981', '#84cc16', '#7c3aed', '#e11d48', '#ffffff'],
    })

  const run = async (fn: () => Promise<void>, win = false) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
      if (win) celebrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  // quick settle: mark every leg at once, payout computed automatically
  const quick = (result: 'won' | 'lost') =>
    run(
      () =>
        settleBet(bet, Object.fromEntries(bet.legs.map((l) => [l.id, result])), {
          payout: result === 'won' ? potentialPayout(bet) : 0,
        }),
      result === 'won',
    )

  const saveCashout = () => {
    const amount = Number(payout)
    if (payout === '' || Number.isNaN(amount) || amount < 0)
      return setError('Enter the cash-out amount you received.')
    return run(() => settleBet(bet, results, { cashedOut: true, payout: amount }), amount > riskedStake(bet))
  }

  // per-leg path (optional, more precise stats)
  const derived = deriveStatus(bet.legs.map((l) => ({ result: results[l.id] })))
  const detailPayout = derived === 'won' ? potentialPayout(bet) : derived === 'void' ? riskedStake(bet) : 0
  const saveDetail = () => {
    if (derived === 'pending') return setError('Set every leg to won/lost/void first.')
    return run(() => settleBet(bet, results, { payout: detailPayout }), derived === 'won')
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex gap-2">
        <button className="grow rounded-xl bg-emerald-500/20 py-2.5 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
          disabled={busy} onClick={() => void quick('won')}>
          ✓ Won · {eur(potentialPayout(bet))}
        </button>
        <button className="grow rounded-xl bg-rose-500/20 py-2.5 font-semibold text-rose-300 transition-colors hover:bg-rose-500/30 disabled:opacity-40"
          disabled={busy} onClick={() => void quick('lost')}>
          ✗ Lost
        </button>
        <button className={`grow rounded-xl py-2.5 font-semibold transition-colors disabled:opacity-40 ${
            cashout ? 'bg-sky-500/30 text-sky-200' : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
          }`}
          disabled={busy} onClick={() => setCashout((c) => !c)}>
          💰 Cashed
        </button>
      </div>

      {cashout && (
        <div className="flex items-end gap-2">
          <div className="grow">
            <label className="lbl">Amount received (€)</label>
            <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
              value={payout} placeholder="0.00" onChange={(e) => setPayout(e.target.value)} autoFocus />
          </div>
          <button className="btn !py-2" disabled={busy} onClick={() => void saveCashout()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {bet.legs.length > 1 && (
        <details className="border-t border-white/10 pt-2">
          <summary className="cursor-pointer text-xs text-neutral-500">
            Per leg (optional — makes player/team stats more precise)
          </summary>
          <div className="mt-2 space-y-3">
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
            <button className="btn w-full !py-2" disabled={busy || derived === 'pending'} onClick={() => void saveDetail()}>
              {busy ? 'Saving…' : derived === 'pending'
                ? 'Set every leg first'
                : `Save · ${derived} · returns ${eur(detailPayout)}`}
            </button>
          </div>
        </details>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300" onClick={onClose}>
        Cancel
      </button>
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
  const [superBoost, setSuperBoost] = useState(bet.is_super_boost)
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
        is_super_boost: superBoost,
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
            {BET_TYPE_OPTIONS.map((t) => (
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
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={superBoost} onChange={(e) => setSuperBoost(e.target.checked)}
          className="h-4 w-4 accent-amber-500" />
        ⚡ Super boost
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
