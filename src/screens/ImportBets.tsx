import { useState } from 'react'
import { MatchSelect } from '../components/MatchSelect'
import { parseBet365Html, type ParsedBet } from '../lib/bet365-parser'
import { useData } from '../lib/data'
import { eur } from '../lib/format'
import type { BetType, Market } from '../lib/types'
import { BET_TYPE_LABELS, MARKET_LABELS } from '../lib/types'

export function ImportBets() {
  const { bookmakers } = useData()
  const [step, setStep] = useState<'paste' | 'review'>('paste')
  const [html, setHtml] = useState('')
  const [bookmakerId, setBookmakerId] = useState(() => localStorage.getItem('lastBookmaker') ?? '')
  const [bets, setBets] = useState<ParsedBet[]>([])
  const [error, setError] = useState<string | null>(null)

  const parse = () => {
    setError(null)
    if (!bookmakerId) return setError('Pick the bookmaker these bets belong to.')
    try {
      const parsed = parseBet365Html(html)
      if (parsed.length === 0)
        return setError('No bets found in that HTML. Make sure you copied the outerHTML of the bets container.')
      setBets(parsed)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (step === 'review') {
    return <Review bets={bets} setBets={setBets} bookmakerId={bookmakerId} onBack={() => setStep('paste')} />
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Import from Bet365</h2>
      <div className="card space-y-2 text-sm text-neutral-300">
        <p className="lbl mb-0">How to copy your bets</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Open Bet365 → <span className="text-neutral-100">My Bets</span> in a desktop browser</li>
          <li>Right-click a bet → <span className="text-neutral-100">Inspect</span></li>
          <li>
            In the elements panel, find the container
            <code className="mx-1 rounded bg-black/30 px-1">.myb-BetItemsContainer_Container</code>
          </li>
          <li>Right-click it → Copy → <span className="text-neutral-100">Copy outerHTML</span></li>
          <li>Paste it below</li>
        </ol>
      </div>
      <div>
        <label className="lbl">Bookmaker</label>
        <select className="input" value={bookmakerId} onChange={(e) => setBookmakerId(e.target.value)}>
          <option value="">— pick —</option>
          {bookmakers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">Bet365 HTML</label>
        <textarea
          className="input h-48 font-mono text-xs"
          placeholder="<div class=&quot;myb-BetItemsContainer_Container&quot;>…"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button className="btn w-full" onClick={parse} disabled={!html.trim()}>
        Parse bets
      </button>
    </div>
  )
}

function Review({
  bets, setBets, bookmakerId, onBack,
}: {
  bets: ParsedBet[]
  setBets: (b: ParsedBet[]) => void
  bookmakerId: string
  onBack: () => void
}) {
  const { addBet, refresh } = useData()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const update = (id: string, patch: Partial<ParsedBet>) =>
    setBets(bets.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const importAll = async () => {
    setBusy(true)
    setErrors([])
    let ok = 0
    const failures: string[] = []
    for (const bet of bets) {
      try {
        await addBet({
          bookmaker_id: bookmakerId,
          bet_type: bet.betType,
          stake: bet.stake,
          total_odds: Math.max(bet.totalOdds, 1),
          is_free_bet: bet.isFreeBet,
          notes: `Imported from Bet365 · ${bet.betTypeRaw}`,
          legs: bet.legs.map((l) => ({
            match_number: l.matchNumber,
            market: l.market,
            player_id: null,
            team_code: l.teamCode,
            line: l.line,
          })),
        })
        ok++
      } catch (err) {
        failures.push(err instanceof Error ? err.message : String(err))
      }
    }
    await refresh()
    setBusy(false)
    setDone({ ok, failed: failures.length })
    setErrors(failures)
    if (failures.length === 0) setBets([])
  }

  if (done && errors.length === 0) {
    return (
      <div className="card space-y-2 text-center">
        <p className="text-3xl">✅</p>
        <p className="font-semibold">{done.ok} bets imported</p>
        <p className="text-sm text-neutral-400">Find them under Open bets.</p>
        <button className="btn-ghost" onClick={onBack}>Import more</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{bets.length} bets found</h2>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
      </div>
      {bets.map((bet) => (
        <BetReviewCard key={bet.id} bet={bet}
          onChange={(patch) => update(bet.id, patch)}
          onRemove={() => setBets(bets.filter((b) => b.id !== bet.id))} />
      ))}
      {errors.map((e, i) => (
        <p key={i} className="text-sm text-rose-400">{e}</p>
      ))}
      <button className="btn w-full" onClick={importAll} disabled={busy || bets.length === 0}>
        {busy ? 'Importing…' : `Import ${bets.length} bet${bets.length === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}

function BetReviewCard({
  bet, onChange, onRemove,
}: {
  bet: ParsedBet
  onChange: (patch: Partial<ParsedBet>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const warnings = bet.legs.filter((l) => (l.homeTeam && !l.homeCode) || (l.awayTeam && !l.awayCode) || (l.homeCode && l.awayCode && l.matchNumber === null))
  const summary = bet.legs.map((l) => l.selection).filter(Boolean).join(' · ')

  const updateLeg = (i: number, patch: Partial<ParsedBet['legs'][number]>) =>
    onChange({ legs: bet.legs.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  return (
    <div className="card space-y-3">
      <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num font-semibold">{eur(bet.stake)}</span>
            <span className="badge">{BET_TYPE_LABELS[bet.betType]}</span>
            <span className="num text-sm text-neutral-400">@ {bet.totalOdds}</span>
            {bet.isFreeBet && <span className="badge border-amber-600 text-amber-400">Free bet</span>}
            <span className="text-xs text-neutral-500">{bet.legs.length} leg{bet.legs.length === 1 ? '' : 's'}</span>
          </div>
          <p className="mt-1 truncate text-xs text-neutral-500">{summary}</p>
        </div>
        <span className="text-neutral-500">{open ? '▲' : '▼'}</span>
      </button>

      {warnings.length > 0 && (
        <p className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
          {warnings.length} leg{warnings.length === 1 ? '' : 's'} need attention — team or match not recognized. Expand to fix.
        </p>
      )}

      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">Stake (€)</label>
              <input className="input" type="number" min="0" step="0.01" value={bet.stake}
                onChange={(e) => onChange({ stake: Number(e.target.value) })} />
            </div>
            <div>
              <label className="lbl">Total odds</label>
              <input className="input" type="number" min="1" step="0.01" value={bet.totalOdds}
                onChange={(e) => onChange({ totalOdds: Number(e.target.value) })} />
            </div>
            <div>
              <label className="lbl">Bet type</label>
              <select className="input" value={bet.betType}
                onChange={(e) => onChange({ betType: e.target.value as BetType })}>
                {(Object.keys(BET_TYPE_LABELS) as BetType[]).map((t) => (
                  <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-neutral-300">
              <input type="checkbox" checked={bet.isFreeBet} className="h-4 w-4 accent-emerald-500"
                onChange={(e) => onChange({ isFreeBet: e.target.checked })} />
              Free bet
            </label>
          </div>

          {bet.legs.map((leg, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <span className="lbl mb-0">Leg {i + 1}</span>
                {bet.legs.length > 1 && (
                  <button className="text-xs text-rose-400"
                    onClick={() => onChange({ legs: bet.legs.filter((_, j) => j !== i) })}>
                    remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="lbl">Selection / line</label>
                  <input className="input" value={leg.line ?? leg.selection}
                    onChange={(e) => updateLeg(i, { line: e.target.value })} />
                </div>
                <div>
                  <label className="lbl">Odds</label>
                  <input className="input" type="number" min="1" step="0.01" value={leg.odds ?? ''}
                    onChange={(e) => updateLeg(i, { odds: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="lbl">
                  Market{leg.market === 'other' && leg.marketRaw && (
                    <span className="ml-1 text-amber-400 normal-case">— Bet365 said: “{leg.marketRaw}”</span>
                  )}
                </label>
                <select className="input" value={leg.market}
                  onChange={(e) => updateLeg(i, { market: e.target.value as Market })}>
                  {(Object.keys(MARKET_LABELS) as Market[]).map((m) => (
                    <option key={m} value={m}>{MARKET_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">
                  Match{leg.matchNumber === null && leg.homeTeam && (
                    <span className="ml-1 text-amber-400 normal-case">— “{leg.homeTeam} – {leg.awayTeam}” not matched</span>
                  )}
                </label>
                <MatchSelect value={leg.matchNumber} onChange={(n) => updateLeg(i, { matchNumber: n })} />
              </div>
            </div>
          ))}

          <button className="btn-ghost w-full !border-rose-900/60 !text-rose-400" onClick={onRemove}>
            Remove this bet
          </button>
        </div>
      )}
    </div>
  )
}
