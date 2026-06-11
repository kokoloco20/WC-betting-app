import { useMemo, useState } from 'react'
import { BetCard } from '../components/BetCard'
import { MATCHES } from '../data/matches'
import { TEAMS } from '../data/teams'
import { betsToCsv, downloadCsv } from '../lib/csv'
import { useData } from '../lib/data'
import type { Drill } from '../lib/filters'
import { kickoffLocal, STAGE_LABELS, matchLabel } from '../lib/format'
import { legTeamCode } from '../lib/stats'
import type { Bet, BetType, Market } from '../lib/types'
import { BET_TYPE_LABELS, MARKET_LABELS } from '../lib/types'

function matchesDrill(bet: Bet, drill: Drill, players: Parameters<typeof legTeamCode>[1]): boolean {
  switch (drill.kind) {
    case 'bookmaker':
      return bet.bookmaker_id === drill.key
    case 'betType':
      return bet.bet_type === drill.key
    case 'legs':
      return String(bet.legs.length).padStart(2, '0') === drill.key
    case 'team':
      return bet.legs.some((l) => legTeamCode(l, players) === drill.key)
    case 'player':
      return bet.legs.some((l) => l.player_id === drill.key)
    case 'market':
      return bet.legs.some((l) => l.market === drill.key)
  }
}

export function History({ drill, onDrillChange }: { drill: Drill | null; onDrillChange: (d: Drill | null) => void }) {
  const { bets, players, bookmakers, knockout, loading } = useData()
  const [showOpen, setShowOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = showOpen ? bets : bets.filter((b) => b.status !== 'pending')
    if (drill) list = list.filter((b) => matchesDrill(b, drill, players))
    return list
  }, [bets, drill, players, showOpen])

  if (loading) return <p className="text-neutral-400">Loading…</p>

  const drillLabel =
    drill &&
    {
      team: TEAMS.find((t) => t.code === drill.key)?.name ?? drill.key,
      player: players.get(drill.key)?.name ?? drill.key,
      market: MARKET_LABELS[drill.key as Market] ?? drill.key,
      betType: BET_TYPE_LABELS[drill.key as BetType] ?? drill.key,
      bookmaker: bookmakers.find((b) => b.id === drill.key)?.name ?? drill.key,
      legs: `${Number(drill.key)} legs`,
    }[drill.kind]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">History</h2>
        <button
          className="btn-ghost"
          onClick={() => downloadCsv(betsToCsv(bets, players, bookmakers, knockout), 'wc2026-bets.csv')}
        >
          ⬇ CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Bookmaker" value={drill?.kind === 'bookmaker' ? drill.key : ''}
          options={bookmakers.map((b) => [b.id, b.name])}
          onChange={(key) => onDrillChange(key ? { kind: 'bookmaker', key } : null)}
        />
        <FilterSelect
          label="Bet type" value={drill?.kind === 'betType' ? drill.key : ''}
          options={(Object.keys(BET_TYPE_LABELS) as BetType[]).map((t) => [t, BET_TYPE_LABELS[t]])}
          onChange={(key) => onDrillChange(key ? { kind: 'betType', key } : null)}
        />
        <FilterSelect
          label="Team" value={drill?.kind === 'team' ? drill.key : ''}
          options={TEAMS.map((t) => [t.code, t.name])}
          onChange={(key) => onDrillChange(key ? { kind: 'team', key } : null)}
        />
        <FilterSelect
          label="Player" value={drill?.kind === 'player' ? drill.key : ''}
          options={[...players.values()].map((p) => [p.id, p.name])}
          onChange={(key) => onDrillChange(key ? { kind: 'player', key } : null)}
        />
        <FilterSelect
          label="Market" value={drill?.kind === 'market' ? drill.key : ''}
          options={(Object.keys(MARKET_LABELS) as Market[]).map((m) => [m, MARKET_LABELS[m]])}
          onChange={(key) => onDrillChange(key ? { kind: 'market', key } : null)}
        />
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input type="checkbox" checked={showOpen} onChange={(e) => setShowOpen(e.target.checked)}
            className="h-4 w-4 accent-emerald-500" />
          include open
        </label>
      </div>

      {drill && (
        <p className="text-sm text-neutral-400">
          Filtered on <span className="text-neutral-200">{drillLabel}</span>{' '}
          <button className="text-emerald-400" onClick={() => onDrillChange(null)}>× clear</button>
        </p>
      )}

      {filtered.length === 0 && <p className="text-neutral-400">No bets match.</p>}
      {filtered.map((bet) => (
        <BetCard key={bet.id} bet={bet}>
          <SettledActions bet={bet} />
        </BetCard>
      ))}

      <KnockoutEditor />
      <BookmakerManager />
    </div>
  )
}

function FilterSelect({
  label, value, options, onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (key: string) => void
}) {
  return (
    <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}: all</option>
      {options.map(([key, text]) => (
        <option key={key} value={key}>{text}</option>
      ))}
    </select>
  )
}

function SettledActions({ bet }: { bet: Bet }) {
  const { reopenBet, deleteBet } = useData()
  const [error, setError] = useState<string | null>(null)
  if (bet.status === 'pending') return null
  const act = async (fn: () => Promise<void>) => {
    try {
      setError(null)
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <div className="flex gap-2 text-xs">
      <button className="text-neutral-500 hover:text-neutral-300" onClick={() => act(() => reopenBet(bet))}>
        reopen
      </button>
      <button
        className="text-neutral-500 hover:text-red-400"
        onClick={() => {
          if (window.confirm('Delete this bet entirely?')) void act(() => deleteBet(bet.id))
        }}
      >
        delete
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  )
}

function KnockoutEditor() {
  const { knockout, setKnockoutTeams } = useData()
  const [error, setError] = useState<string | null>(null)
  const slots = MATCHES.filter((m) => m.stage !== 'group')

  return (
    <details className="card">
      <summary className="cursor-pointer font-medium">Knockout matches — fill in teams</summary>
      <p className="mt-1 text-xs text-neutral-500">
        Once the bracket is known, set the teams here; bets can then be logged on these matches.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <div className="mt-3 space-y-2">
        {slots.map((m) => {
          const ko = knockout.get(m.matchNumber)
          const set = (side: 'home' | 'away', code: string) =>
            setKnockoutTeams(
              m.matchNumber,
              side === 'home' ? code || null : (ko?.home_code ?? null),
              side === 'away' ? code || null : (ko?.away_code ?? null),
            ).catch((err) => setError(err instanceof Error ? err.message : String(err)))
          return (
            <div key={m.matchNumber} className="grid grid-cols-[1fr_1fr] gap-2 text-sm">
              <div className="col-span-2 mt-1 text-xs text-neutral-500">
                {STAGE_LABELS[m.stage]} · {matchLabel(m, knockout)} · {kickoffLocal(m.kickoffUtc)}
              </div>
              <TeamPick value={ko?.home_code ?? ''} placeholder={m.homeLabel ?? 'home'} onChange={(c) => void set('home', c)} />
              <TeamPick value={ko?.away_code ?? ''} placeholder={m.awayLabel ?? 'away'} onChange={(c) => void set('away', c)} />
            </div>
          )
        })}
      </div>
    </details>
  )
}

function TeamPick({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (code: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {TEAMS.map((t) => (
        <option key={t.code} value={t.code}>{t.name}</option>
      ))}
    </select>
  )
}

function BookmakerManager() {
  const { bookmakers, addBookmaker } = useData()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <details className="card">
      <summary className="cursor-pointer font-medium">Bookmakers</summary>
      <ul className="mt-2 space-y-1 text-sm text-neutral-300">
        {bookmakers.map((b) => (
          <li key={b.id}>{b.name}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="input" placeholder="New bookmaker" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn-ghost shrink-0"
          onClick={async () => {
            if (!name.trim()) return
            try {
              setError(null)
              await addBookmaker(name.trim())
              setName('')
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        >
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </details>
  )
}
