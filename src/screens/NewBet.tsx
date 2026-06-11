import { useState } from 'react'
import { MatchSelect } from '../components/MatchSelect'
import { matchByNumber } from '../data/matches'
import { SQUADS } from '../data/players'
import { TEAMS, teamByCode } from '../data/teams'
import { useData } from '../lib/data'
import type { BetType, Market } from '../lib/types'
import { BET_TYPE_LABELS, MARKET_LABELS, MARKET_OPTIONS } from '../lib/types'

function findSquadPlayer(name: string) {
  const n = name.trim().toLowerCase()
  return n ? SQUADS.find((p) => p.name.toLowerCase() === n) : undefined
}

interface LegDraft {
  matchNumber: number | null
  market: Market
  playerName: string
  playerTeam: string
  teamCode: string
  line: string
}

const emptyLeg = (): LegDraft => ({
  matchNumber: null,
  market: 'match_result',
  playerName: '',
  playerTeam: '',
  teamCode: '',
  line: '',
})

const MULTI_LEG_TYPES: BetType[] = ['parlay', 'bet_builder', 'super_boost', 'outright']

export function NewBet() {
  const { bookmakers, players, knockout, addBet, addPlayer } = useData()
  const [bookmakerId, setBookmakerId] = useState(
    () => localStorage.getItem('lastBookmaker') ?? '',
  )
  const [betType, setBetType] = useState<BetType>('straight')
  const [stake, setStake] = useState('')
  const [odds, setOdds] = useState('')
  const [freeBet, setFreeBet] = useState(false)
  const [notes, setNotes] = useState('')
  const [builderMatch, setBuilderMatch] = useState<number | null>(null)
  const [legs, setLegs] = useState<LegDraft[]>([emptyLeg()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const playerList = [...players.values()]

  /** Both team codes of a match, including user-filled knockout teams. */
  const matchTeamCodes = (n: number | null): [string, string] | null => {
    if (n === null) return null
    const m = matchByNumber.get(n)
    if (!m) return null
    const ko = knockout.get(n)
    const home = m.home ?? ko?.home_code
    const away = m.away ?? ko?.away_code
    return home && away ? [home, away] : null
  }

  /** Autocomplete names: squad players + custom ones, narrowed to the match's teams when known. */
  const playerOptionsFor = (codes: [string, string] | null): string[] => {
    const names = new Set<string>()
    for (const p of SQUADS) if (!codes || codes.includes(p.team)) names.add(p.name)
    for (const p of players.values()) if (!codes || codes.includes(p.team_code)) names.add(p.name)
    return [...names].sort()
  }

  const isOutright = betType === 'outright'
  const isBuilder = betType === 'bet_builder'
  const canAddLegs = MULTI_LEG_TYPES.includes(betType)

  const updateLeg = (i: number, patch: Partial<LegDraft>) =>
    setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const changeBetType = (t: BetType) => {
    setBetType(t)
    if (t === 'straight') setLegs((ls) => ls.slice(0, 1))
  }

  const submit = async () => {
    setError(null)
    setSaved(false)
    const stakeN = Number(stake)
    const oddsN = Number(odds)
    if (!bookmakerId) return setError('Pick a bookmaker.')
    if (!(stakeN > 0)) return setError('Enter a stake above €0.')
    if (!(oddsN >= 1)) return setError('Enter total odds of 1.00 or higher.')
    if (isBuilder && builderMatch === null) return setError('Pick the match for this bet builder.')
    if (!isOutright && !isBuilder && legs.some((l) => l.matchNumber === null))
      return setError('Every leg needs a match.')

    setSaving(true)
    try {
      const legInputs = []
      for (const l of legs) {
        let playerId: string | null = null
        const name = l.playerName.trim()
        if (name) {
          const existing = playerList.find((p) => p.name.toLowerCase() === name.toLowerCase())
          if (existing) {
            playerId = existing.id
          } else {
            const squad = findSquadPlayer(name)
            const team = squad?.team ?? l.playerTeam
            if (!team) throw new Error(`Pick a team for new player “${name}”.`)
            playerId = (await addPlayer(squad?.name ?? name, team)).id
          }
        }
        legInputs.push({
          match_number: isOutright ? null : isBuilder ? builderMatch : l.matchNumber,
          market: l.market,
          player_id: playerId,
          team_code: l.teamCode || null,
          line: l.line.trim() || null,
        })
      }
      await addBet({
        bookmaker_id: bookmakerId,
        bet_type: betType,
        stake: stakeN,
        total_odds: oddsN,
        is_free_bet: freeBet,
        notes: notes.trim() || null,
        legs: legInputs,
      })
      localStorage.setItem('lastBookmaker', bookmakerId)
      setStake('')
      setOdds('')
      setFreeBet(false)
      setNotes('')
      setBuilderMatch(null)
      setLegs([emptyLeg()])
      setSaved(true)
    } catch (err) {
      // keep all form state so nothing is lost — fix and press save again
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">New bet</h2>

      <div className="card grid grid-cols-2 gap-3">
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
          <label className="lbl">Bet type</label>
          <select className="input" value={betType} onChange={(e) => changeBetType(e.target.value as BetType)}>
            {(Object.keys(BET_TYPE_LABELS) as BetType[]).map((t) => (
              <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Stake (€)</label>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal"
            value={stake} onChange={(e) => setStake(e.target.value)} placeholder="10.00" />
        </div>
        <div>
          <label className="lbl">Total odds</label>
          <input className="input" type="number" min="1" step="0.01" inputMode="decimal"
            value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="2.50" />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={freeBet} onChange={(e) => setFreeBet(e.target.checked)}
            className="h-4 w-4 accent-emerald-500" />
          Free bet / promo money (your own money is not at risk)
        </label>
      </div>

      {isBuilder && (
        <div className="card">
          <label className="lbl">Match (all legs)</label>
          <MatchSelect value={builderMatch} onChange={setBuilderMatch} />
        </div>
      )}

      {legs.map((leg, i) => {
        const squadMatch = findSquadPlayer(leg.playerName)
        const unknownPlayer =
          leg.playerName.trim() &&
          !squadMatch &&
          !playerList.some((p) => p.name.toLowerCase() === leg.playerName.trim().toLowerCase())
        const effectiveMatch = isOutright ? null : isBuilder ? builderMatch : leg.matchNumber
        const codes = matchTeamCodes(effectiveMatch)
        const isMatchResult = leg.market === 'match_result' && codes !== null
        return (
          <div key={i} className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="lbl mb-0">Leg {i + 1}</span>
              {legs.length > 1 && (
                <button className="text-xs text-red-400" onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))}>
                  remove
                </button>
              )}
            </div>
            {!isOutright && !isBuilder && (
              <MatchSelect value={leg.matchNumber} onChange={(n) => updateLeg(i, { matchNumber: n })} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl">Market</label>
                <select className="input" value={leg.market} onChange={(e) => updateLeg(i, { market: e.target.value as Market })}>
                  {MARKET_OPTIONS.map((m) => (
                    <option key={m} value={m}>{MARKET_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              {isMatchResult ? (
                <div>
                  <label className="lbl">Outcome</label>
                  <select className="input"
                    value={leg.line === 'Draw' ? 'DRAW' : leg.teamCode}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'DRAW') updateLeg(i, { teamCode: '', line: 'Draw' })
                      else updateLeg(i, { teamCode: v, line: leg.line === 'Draw' ? '' : leg.line })
                    }}>
                    <option value="">— pick —</option>
                    <option value={codes![0]}>{teamByCode.get(codes![0])?.name} wins</option>
                    <option value="DRAW">Draw</option>
                    <option value={codes![1]}>{teamByCode.get(codes![1])?.name} wins</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="lbl">Line (optional)</label>
                  <input className="input" value={leg.line} placeholder="2+ / Over 2.5"
                    onChange={(e) => updateLeg(i, { line: e.target.value })} />
                </div>
              )}
              <div>
                <label className="lbl">Player (optional)</label>
                <datalist id={`player-options-${i}`}>
                  {playerOptionsFor(codes).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <input className="input" list={`player-options-${i}`} value={leg.playerName}
                  placeholder="e.g. Depay" onChange={(e) => updateLeg(i, { playerName: e.target.value })} />
              </div>
              {squadMatch ? (
                <div>
                  <label className="lbl">Player team</label>
                  <p className="input border-emerald-900 text-emerald-300">
                    {teamByCode.get(squadMatch.team)?.name} · {squadMatch.pos}
                  </p>
                </div>
              ) : unknownPlayer ? (
                <div>
                  <label className="lbl">New player's team</label>
                  <select className="input" value={leg.playerTeam} onChange={(e) => updateLeg(i, { playerTeam: e.target.value })}>
                    <option value="">— pick —</option>
                    {TEAMS.map((t) => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="lbl">Team (optional)</label>
                  <select className="input" value={leg.teamCode} onChange={(e) => updateLeg(i, { teamCode: e.target.value })}>
                    <option value="">—</option>
                    {(codes ? TEAMS.filter((t) => codes.includes(t.code)) : TEAMS).map((t) => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {canAddLegs && (
        <button className="btn-ghost w-full" onClick={() => setLegs((ls) => [...ls, emptyLeg()])}>
          + Add leg
        </button>
      )}

      <div>
        <label className="lbl">Notes (optional)</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. boosted from 1.80" />
      </div>

      {error && <p className="text-sm text-red-400">{error} Your input is kept — fix it and save again.</p>}
      {saved && <p className="text-sm text-emerald-400">Bet saved ✓</p>}

      <button className="btn w-full" onClick={submit} disabled={saving}>
        {saving ? 'Saving…' : 'Save bet'}
      </button>
    </div>
  )
}
