import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MATCHES } from '../data/matches'
import { MatchBetsModal } from '../components/MatchBetsModal'
import { useData } from '../lib/data'
import type { Drill } from '../lib/filters'
import { eur, matchLabel, pct, profitColor, signedEur, stagePrefix } from '../lib/format'
import { betProfit } from '../lib/money'
import { isReadyToSettle } from '../lib/ready'
import {
  cumulativeProfit,
  highlights,
  profitByBetType,
  profitByBookmaker,
  profitByDay,
  profitByLegCount,
  profitByMarket,
  profitByPlayer,
  profitByTeam,
  totals,
  type LeaderRow,
} from '../lib/stats'

export function Dashboard({ onDrill, onOpenBets }: { onDrill: (d: Drill) => void; onOpenBets: () => void }) {
  const { bets, players, bookmakers, loading } = useData()
  const [matchModal, setMatchModal] = useState<number | null>(null)

  const t = useMemo(() => totals(bets), [bets])
  const record = useMemo(() => {
    const settled = bets.filter((b) => b.status !== 'pending' && b.status !== 'void')
    const wins = settled.filter((b) => (betProfit(b) ?? 0) > 0).length
    return { wins, losses: settled.length - wins, open: bets.length - settled.length }
  }, [bets])
  const series = useMemo(() => {
    // collapse the per-bet running total to one point per day (keeps the day's
    // final total) so a busy day shows once, not five times, and it fits the card
    const byDay = new Map<string, { label: string; cumulative: number }>()
    for (const p of cumulativeProfit(bets)) {
      const d = new Date(p.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      byDay.set(key, {
        label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        cumulative: p.cumulative,
      })
    }
    return [...byDay.values()]
  }, [bets])
  const bookmakerNames = useMemo(() => new Map(bookmakers.map((b) => [b.id, b.name])), [bookmakers])

  const teamRows = useMemo(() => profitByTeam(bets, players), [bets, players])
  const playerRows = useMemo(() => profitByPlayer(bets, players), [bets, players])
  const boards = useMemo(
    () =>
      [
        { title: 'Markets', kind: 'market', rows: profitByMarket(bets) },
        { title: 'Bet types', kind: 'betType', rows: profitByBetType(bets) },
        { title: 'Bookmakers', kind: 'bookmaker', rows: profitByBookmaker(bets, bookmakerNames) },
        { title: 'Parlay size', kind: 'legs', rows: profitByLegCount(bets) },
      ] as const,
    [bets, bookmakerNames],
  )

  if (loading) return <p className="text-neutral-400">Loading…</p>

  const heroGlow =
    t.profit > 0 ? 'bg-emerald-500/15' : t.profit < 0 ? 'bg-rose-500/15' : 'bg-sky-500/15'
  const heroBorder =
    t.profit > 0 ? '!border-emerald-500/20' : t.profit < 0 ? '!border-rose-500/20' : '!border-sky-500/20'

  const readyCount = bets.filter((b) => isReadyToSettle(b)).length
  const hl = highlights(bets)
  const days = profitByDay(bets)

  return (
    // grid-cols-1 (minmax(0,1fr)) constrains each column so a wide scrollable
    // chart scrolls inside its card instead of stretching the whole page
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Bets whose matches have finished */}
      {readyCount > 0 && (
        <button
          className="card flex items-center justify-between !border-amber-500/30 !py-3 text-left transition-transform active:scale-[0.99] lg:col-span-2"
          onClick={onOpenBets}
        >
          <span className="text-sm">
            ⏱️ <span className="font-semibold text-amber-300">{readyCount} bet{readyCount === 1 ? '' : 's'}</span>{' '}
            <span className="text-neutral-300">ready to settle — the matches are finished</span>
          </span>
          <span className="text-amber-300">→</span>
        </button>
      )}

      {/* Hero */}
      <div className={`card relative overflow-hidden !p-5 ${heroBorder}`}>
        <div className={`pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-2xl ${heroGlow}`} />
        <p className="lbl">Tournament profit</p>
        <p className={`num text-4xl font-extrabold tracking-tight ${profitColor(t.profit)}`}>
          {signedEur(t.profit)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="ROI" value={t.roi === null ? '—' : pct(t.roi)} accent={t.roi !== null && t.roi > 0} />
          <Chip label="Staked" value={eur(t.staked)} />
          <Chip label="Win rate" value={t.winRate === null ? '—' : pct(t.winRate)} />
          <Chip label="Record" value={`${record.wins}W – ${record.losses}L · ${record.open} open`} />
        </div>
      </div>

      {/* Profit curve */}
      {series.length > 1 && (
        <div className="card min-w-0">
          <p className="lbl">Profit over time</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#7a7490" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a7490" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v) => [eur(Number(v)), 'Total profit']}
                  contentStyle={{
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    color: 'var(--color-neutral-100)',
                  }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2.5}
                  fill="url(#profitFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Streak & highlights */}
      {hl.streakType && (
        <div className="card">
          <p className="lbl">Form</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`num text-2xl font-extrabold ${hl.streakType === 'won' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hl.streakType === 'won' ? '🔥' : '❄️'} {hl.streakType === 'won' ? 'W' : 'L'}{hl.streak}
            </span>
            <span className="badge num">best win <span className="ml-1 text-emerald-400">{signedEur(hl.biggestWin)}</span></span>
            <span className="badge num">worst loss <span className="ml-1 text-rose-400">{signedEur(hl.biggestLoss)}</span></span>
            {hl.bestStreak > 1 && <span className="badge num">best run <span className="ml-1 text-emerald-400">W{hl.bestStreak}</span></span>}
            {hl.avgOdds !== null && <span className="badge num">avg odds <span className="ml-1 text-neutral-200">{hl.avgOdds.toFixed(2)}</span></span>}
            {hl.avgStake !== null && <span className="badge num">avg stake <span className="ml-1 text-neutral-200">{eur(hl.avgStake)}</span></span>}
            <span className="badge num">biggest bet <span className="ml-1 text-neutral-200">{eur(hl.biggestBet)}</span></span>
          </div>
        </div>
      )}

      {/* Profit per day */}
      {days.length > 1 && (
        <div className="card min-w-0">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="lbl mb-0">Profit per day</p>
            {days.length > 8 && <p className="text-[11px] text-neutral-500">swipe ↔</p>}
          </div>
          <div className="overflow-x-auto">
          <div className="h-40" style={{ minWidth: `${Math.max(days.length * 50, 280)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="#7a7490" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#7a7490" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v) => [eur(Number(v)), 'Profit']}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: 'var(--color-neutral-100)' }}
                  itemStyle={{ color: 'var(--color-neutral-100)' }}
                />
                <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                  {days.map((d, i) => (
                    <Cell key={i} fill={d.profit >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>
      )}

      <TodayStrip onOpenMatch={setMatchModal} />

      {/* Heroes & villains */}
      {(teamRows.length > 0 || playerRows.length > 0) && (
        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
          <Podium icon="🏆" label="Best team" row={teamRows[0]} onPick={(k) => onDrill({ kind: 'team', key: k })} />
          <Podium icon="💸" label="Worst team" row={worst(teamRows)} onPick={(k) => onDrill({ kind: 'team', key: k })} />
          <Podium icon="⭐" label="Best player" row={playerRows[0]} onPick={(k) => onDrill({ kind: 'player', key: k })} />
          <Podium icon="🧨" label="Worst player" row={worst(playerRows)} onPick={(k) => onDrill({ kind: 'player', key: k })} />
        </div>
      )}

      {teamRows.length > 1 && (
        <BarBoard title="All teams" rows={teamRows} onPick={(k) => onDrill({ kind: 'team', key: k })} />
      )}
      {playerRows.length > 1 && (
        <BarBoard title="All players" rows={playerRows} onPick={(k) => onDrill({ kind: 'player', key: k })} />
      )}
      {boards.map(
        (b) =>
          b.rows.length > 0 && (
            <BarBoard key={b.kind} title={b.title} rows={b.rows} onPick={(k) => onDrill({ kind: b.kind, key: k })} />
          ),
      )}

      {bets.length === 0 && (
        <div className="card text-center lg:col-span-2">
          <p className="text-3xl">🎯</p>
          <p className="mt-1 font-medium">No bets yet</p>
          <p className="text-sm text-neutral-400">Hit “New” below and log your first one.</p>
        </div>
      )}

      {matchModal !== null && <MatchBetsModal matchNumber={matchModal} onClose={() => setMatchModal(null)} />}
    </div>
  )
}

function worst(rows: LeaderRow[]): LeaderRow | undefined {
  const last = rows[rows.length - 1]
  // only show a "worst" if it's actually different from the best
  return rows.length > 1 ? last : undefined
}

function Chip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={`badge num !py-1 ${accent ? '!border-emerald-500/40 !bg-emerald-500/10 text-emerald-300' : ''}`}>
      <span className="mr-1 text-neutral-500">{label}</span>
      {value}
    </span>
  )
}

function Podium({
  icon, label, row, onPick,
}: {
  icon: string
  label: string
  row: LeaderRow | undefined
  onPick: (key: string) => void
}) {
  if (!row) return null
  return (
    <button className="card text-left transition-transform active:scale-[0.98]" onClick={() => onPick(row.key)}>
      <p className="text-xl">{icon}</p>
      <p className="lbl mt-1 mb-0">{label}</p>
      <p className="truncate font-semibold">{row.label}</p>
      <p className={`num text-sm font-bold ${profitColor(row.profit)}`}>{signedEur(row.profit)}</p>
    </button>
  )
}

function BarBoard({ title, rows, onPick }: { title: string; rows: LeaderRow[]; onPick: (key: string) => void }) {
  const [showAll, setShowAll] = useState(false)
  const max = Math.max(...rows.map((r) => Math.abs(r.profit)), 0.01)
  const visible = showAll ? rows : rows.slice(0, 6)
  return (
    <div className="card">
      <p className="lbl">{title}</p>
      <ul className="space-y-1">
        {visible.map((r) => (
          <li key={r.key}>
            <button
              className="relative flex w-full items-center justify-between overflow-hidden rounded-lg px-2.5 py-1.5 text-sm hover:bg-white/5"
              onClick={() => onPick(r.key)}
            >
              <span
                className={`absolute inset-y-1 left-0 rounded-md ${r.profit >= 0 ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}
                style={{ width: `${(Math.abs(r.profit) / max) * 100}%` }}
              />
              <span className="relative truncate text-neutral-200">
                {r.label} <span className="text-xs text-neutral-500">({r.betCount})</span>
              </span>
              <span className={`num relative font-semibold ${profitColor(r.profit)}`}>{signedEur(r.profit)}</span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > 6 && (
        <button className="mt-1.5 text-xs text-neutral-500 hover:text-neutral-300" onClick={() => setShowAll((s) => !s)}>
          {showAll ? '− show less' : `+ show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

function TodayStrip({ onOpenMatch }: { onOpenMatch: (n: number) => void }) {
  const { knockout, bets } = useData()
  const [today] = useState(() => new Date().toDateString())
  const matches = useMemo(
    () =>
      MATCHES.filter((m) => new Date(m.kickoffUtc).toDateString() === today).sort((a, b) =>
        a.kickoffUtc.localeCompare(b.kickoffUtc),
      ),
    [today],
  )
  const betCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const b of bets) {
      for (const n of new Set(b.legs.map((l) => l.match_number))) {
        if (n !== null) counts.set(n, (counts.get(n) ?? 0) + 1)
      }
    }
    return counts
  }, [bets])

  if (matches.length === 0) return null
  return (
    <div className="card !p-3 lg:col-span-2">
      <p className="lbl ml-1">Today's matches · tap to see your bets</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {matches.map((m) => {
          const count = betCounts.get(m.matchNumber) ?? 0
          return (
            <button key={m.matchNumber} onClick={() => onOpenMatch(m.matchNumber)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors active:scale-[0.98] ${
                count > 0 ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10' : 'border-white/10 bg-black/30 hover:bg-white/5'
              }`}>
              <p className="text-sm font-medium whitespace-nowrap">{matchLabel(m, knockout)}</p>
              <p className="num text-xs text-neutral-500">
                {stagePrefix(m)} ·{' '}
                {new Date(m.kickoffUtc).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                {count > 0 && <span className="ml-1.5 text-emerald-400">· {count} bet{count === 1 ? '' : 's'}</span>}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
