import { useMemo, useState } from 'react'
import { MatchSelect } from '../components/MatchSelect'
import { parseBet365Html, type ParsedBet } from '../lib/bet365-parser'
import { parseScreenshots, parseSlipText } from '../lib/screenshot-parser'
import { SQUADS } from '../data/players'
import { useData } from '../lib/data'

const findSquadPlayer = (name: string) =>
  SQUADS.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())

/** Content fingerprint to recognize bets that were imported before. */
function fingerprint(betType: string, stake: number, odds: number, legSigs: string[]): string {
  return [betType, Number(stake).toFixed(2), Number(odds).toFixed(2), ...[...legSigs].sort()].join('|')
}

const legSig = (market: string, matchNumber: number | null, teamCode: string | null, line: string | null) =>
  `${market}:${matchNumber ?? ''}:${teamCode ?? ''}:${(line ?? '').toLowerCase().trim()}`
import { eur } from '../lib/format'
import type { BetType, Market } from '../lib/types'
import { BET_TYPE_LABELS, BET_TYPE_OPTIONS, MARKET_LABELS } from '../lib/types'

export function ImportBets() {
  const { bookmakers } = useData()
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [mode, setMode] = useState<'photo' | 'text' | 'html'>('photo')
  const [html, setHtml] = useState('')
  const [pasted, setPasted] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropicKey') ?? '')
  const [bookmakerId, setBookmakerId] = useState(() => localStorage.getItem('lastBookmaker') ?? '')
  const [bets, setBets] = useState<ParsedBet[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseHtml = () => {
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

  const parseWithAi = async (run: (key: string) => Promise<ParsedBet[]>, emptyMessage: string) => {
    setError(null)
    if (!bookmakerId) return setError('Pick the bookmaker these bets belong to.')
    if (!apiKey.trim()) return setError('Paste your Anthropic API key first (stored only on this device).')
    setBusy(true)
    try {
      localStorage.setItem('anthropicKey', apiKey.trim())
      const parsed = await run(apiKey.trim())
      if (parsed.length === 0) {
        setError(emptyMessage)
      } else {
        setBets(parsed)
        setStep('review')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const parsePhotos = () => {
    if (files.length === 0) return setError('Pick at least one screenshot.')
    return parseWithAi(
      (key) => parseScreenshots(key, files),
      'No bets could be read from the screenshot(s). Try a clearer, full-slip screenshot.',
    )
  }

  const parsePasted = () => {
    if (!pasted.trim()) return setError('Paste the copied text first.')
    return parseWithAi(
      (key) => parseSlipText(key, pasted),
      'No bets found in that text. Make sure you copied the whole My Bets page.',
    )
  }

  if (step === 'review') {
    return <Review bets={bets} setBets={setBets} bookmakerId={bookmakerId} onBack={() => setStep('input')} />
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Import bets</h2>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1 text-sm font-medium">
        {([['photo', '📸 Screenshot'], ['text', '📋 Paste text'], ['html', '🧾 Bet365 HTML']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`grow rounded-lg py-1.5 transition-colors ${
              mode === m ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-500 hover:text-neutral-300'
            }`}>
            {label}
          </button>
        ))}
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

      {mode === 'photo' ? (
        <>
          <div className="card space-y-2 text-sm text-neutral-300">
            <p className="lbl mb-0">Scan bet slips with AI</p>
            <p>
              Pick screenshots of your bet slips (any bookmaker app). Claude reads them and turns
              them into bets you can review before saving. Costs a few cents per screenshot, billed
              to your own API key — create one at{' '}
              <a className="text-emerald-400 underline" href="https://console.anthropic.com" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>{' '}
              and add a small credit balance.
            </p>
          </div>
          <div>
            <label className="lbl">Anthropic API key (stays on this device)</label>
            <input className="input" type="password" placeholder="sk-ant-…"
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <label className="lbl">Screenshots</label>
            <input className="input" type="file" accept="image/*" multiple
              onChange={(e) => setFiles([...(e.target.files ?? [])])} />
            {files.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">{files.length} image{files.length === 1 ? '' : 's'} selected</p>
            )}
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button className="btn w-full" onClick={() => void parsePhotos()} disabled={busy}>
            {busy ? 'Reading screenshots… (can take ~30s)' : 'Read screenshots'}
          </button>
        </>
      ) : mode === 'text' ? (
        <>
          <div className="card space-y-2 text-sm text-neutral-300">
            <p className="lbl mb-0">Works with every bookmaker</p>
            <p>
              Open <span className="text-neutral-100">My Bets</span> at BetCity, Toto, Unibet, 711
              or any other bookie, select the whole page (<span className="text-neutral-100">Ctrl/Cmd+A</span>),
              copy, and paste it below. Claude untangles the text into bets you can review before
              saving. Uses your API key — a few cents per import.
            </p>
          </div>
          <div>
            <label className="lbl">Anthropic API key (stays on this device)</label>
            <input className="input" type="password" placeholder="sk-ant-…"
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <label className="lbl">Copied text</label>
            <textarea className="input h-48 text-xs" placeholder="Paste the whole My Bets page here…"
              value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button className="btn w-full" onClick={() => void parsePasted()} disabled={busy}>
            {busy ? 'Reading bets… (can take ~30s)' : 'Read bets from text'}
          </button>
        </>
      ) : (
        <>
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
            <label className="lbl">Bet365 HTML</label>
            <textarea
              className="input h-48 font-mono text-xs"
              placeholder="<div class=&quot;myb-BetItemsContainer_Container&quot;>…"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button className="btn w-full" onClick={parseHtml} disabled={!html.trim()}>
            Parse bets
          </button>
        </>
      )}
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
  const { addBet, getOrCreatePlayer, refresh } = useData()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const update = (id: string, patch: Partial<ParsedBet>) =>
    setBets(bets.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  // bets already in the database for this bookmaker, by content fingerprint
  const { bets: existingBets } = useData()
  const existingFps = useMemo(
    () =>
      new Set(
        existingBets
          .filter((b) => b.bookmaker_id === bookmakerId)
          .map((b) =>
            fingerprint(b.bet_type, b.stake, b.total_odds,
              b.legs.map((l) => legSig(l.market, l.match_number, l.team_code, l.line))),
          ),
      ),
    [existingBets, bookmakerId],
  )
  const isDuplicate = (b: ParsedBet) =>
    existingFps.has(
      fingerprint(b.betType, b.stake, b.totalOdds,
        b.legs.map((l) => legSig(l.market, l.matchNumber, l.teamCode, l.line))),
    )
  // duplicates start out skipped; the user can re-include them
  const [skipped, setSkipped] = useState<Set<string>>(
    () => new Set(bets.filter(isDuplicate).map((b) => b.id)),
  )
  const toImport = bets.filter((b) => !skipped.has(b.id))

  // "type once, reuse after": dedupes by name; skips linking when no team is known
  const resolvePlayer = async (leg: ParsedBet['legs'][number]): Promise<string | null> => {
    const name = leg.playerName?.trim()
    if (!name) return null
    const squad = findSquadPlayer(name)
    const team = squad?.team ?? leg.teamCode ?? leg.homeCode ?? leg.awayCode
    try {
      return await getOrCreatePlayer(squad?.name ?? name, team ?? '')
    } catch {
      return null // unknown new player with no team — keep the name on the leg instead
    }
  }

  const importAll = async () => {
    setBusy(true)
    setErrors([])
    let ok = 0
    const failures: string[] = []
    for (const bet of toImport) {
      try {
        const legs = []
        for (const l of bet.legs) {
          const playerId = await resolvePlayer(l)
          legs.push({
            match_number: l.matchNumber,
            market: l.market,
            player_id: playerId,
            team_code: l.teamCode,
            // keep the player's name visible if we couldn't link him
            line: !playerId && l.playerName ? [l.playerName, l.line].filter(Boolean).join(' ') : l.line,
            custom_event: null,
          })
        }
        await addBet({
          bookmaker_id: bookmakerId,
          bet_type: bet.betType,
          stake: bet.stake,
          total_odds: Math.max(bet.totalOdds, 1),
          is_free_bet: bet.isFreeBet,
          is_super_boost: bet.isSuperBoost,
          notes: `Imported · ${bet.betTypeRaw}`,
          legs,
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

  const dupCount = bets.length - toImport.length
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{bets.length} bets found</h2>
          {dupCount > 0 && (
            <p className="text-xs text-amber-400">
              {dupCount} look{dupCount === 1 ? 's' : ''} already imported — skipped automatically
            </p>
          )}
        </div>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
      </div>
      {bets.map((bet) => (
        <div key={bet.id} className={skipped.has(bet.id) ? 'opacity-50' : undefined}>
          {skipped.has(bet.id) && (
            <div className="mb-1 flex items-center justify-between rounded-lg border border-amber-600/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              Already imported — will be skipped
              <button className="underline"
                onClick={() => setSkipped((s) => { const next = new Set(s); next.delete(bet.id); return next })}>
                import anyway
              </button>
            </div>
          )}
          <BetReviewCard bet={bet}
            onChange={(patch) => update(bet.id, patch)}
            onRemove={() => setBets(bets.filter((b) => b.id !== bet.id))} />
        </div>
      ))}
      {errors.map((e, i) => (
        <p key={i} className="text-sm text-rose-400">{e}</p>
      ))}
      <button className="btn w-full" onClick={importAll} disabled={busy || toImport.length === 0}>
        {busy ? 'Importing…' : `Import ${toImport.length} bet${toImport.length === 1 ? '' : 's'}`}
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
                {BET_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-1 pb-2 text-sm text-neutral-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bet.isFreeBet} className="h-4 w-4 accent-emerald-500"
                  onChange={(e) => onChange({ isFreeBet: e.target.checked })} />
                Free bet
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bet.isSuperBoost} className="h-4 w-4 accent-amber-500"
                  onChange={(e) => onChange({ isSuperBoost: e.target.checked })} />
                ⚡ Super boost
              </label>
            </div>
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
