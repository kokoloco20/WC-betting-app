import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useData } from '../lib/data'
import type { Drill } from '../lib/filters'
import { eur, pct, profitColor, signedEur } from '../lib/format'
import {
  cumulativeProfit,
  profitByBetType,
  profitByBookmaker,
  profitByLegCount,
  profitByMarket,
  profitByPlayer,
  profitByTeam,
  totals,
  type LeaderRow,
} from '../lib/stats'

export function Dashboard({ onDrill }: { onDrill: (d: Drill) => void }) {
  const { bets, players, bookmakers, loading } = useData()

  const t = useMemo(() => totals(bets), [bets])
  const series = useMemo(
    () =>
      cumulativeProfit(bets).map((p) => ({
        ...p,
        label: new Date(p.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      })),
    [bets],
  )
  const bookmakerNames = useMemo(
    () => new Map(bookmakers.map((b) => [b.id, b.name])),
    [bookmakers],
  )

  const boards = useMemo(
    () =>
      [
        { title: 'Teams', kind: 'team', rows: profitByTeam(bets, players) },
        { title: 'Players', kind: 'player', rows: profitByPlayer(bets, players) },
        { title: 'Markets', kind: 'market', rows: profitByMarket(bets) },
        { title: 'Bet types', kind: 'betType', rows: profitByBetType(bets) },
        { title: 'Bookmakers', kind: 'bookmaker', rows: profitByBookmaker(bets, bookmakerNames) },
        { title: 'Number of legs', kind: 'legs', rows: profitByLegCount(bets) },
      ] as const,
    [bets, players, bookmakerNames],
  )

  if (loading) return <p className="text-neutral-400">Loading…</p>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Profit" value={signedEur(t.profit)} color={profitColor(t.profit)} />
        <StatCard label="ROI" value={t.roi === null ? '—' : pct(t.roi)} color={profitColor(t.roi ?? 0)} />
        <StatCard label="Total staked" value={eur(t.staked)} />
        <StatCard label="Win rate" value={t.winRate === null ? '—' : pct(t.winRate)} />
      </div>

      {series.length > 1 && (
        <div className="card">
          <p className="lbl">Profit over time</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#737373" fontSize={11} />
                <YAxis stroke="#737373" fontSize={11} />
                <Tooltip
                  formatter={(v) => [eur(Number(v)), 'Cumulative profit']}
                  contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {boards.map((b) => (
        <Board key={b.kind} title={b.title} rows={b.rows}
          onPick={(key) => onDrill({ kind: b.kind, key })} />
      ))}

      {bets.length === 0 && (
        <p className="text-neutral-400">No bets yet — add your first one under “New”.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'text-neutral-100' }: { label: string; value: string; color?: string }) {
  return (
    <div className="card">
      <p className="lbl">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function Board({ title, rows, onPick }: { title: string; rows: LeaderRow[]; onPick: (key: string) => void }) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) return null
  const visible = showAll || rows.length <= 6 ? rows : [...rows.slice(0, 3), ...rows.slice(-2)]
  return (
    <div className="card">
      <p className="lbl">{title}</p>
      <ul className="divide-y divide-neutral-800">
        {visible.map((r) => (
          <li key={r.key}>
            <button
              className="flex w-full items-center justify-between py-1.5 text-sm hover:text-emerald-300"
              onClick={() => onPick(r.key)}
            >
              <span className="text-neutral-200">
                {r.label} <span className="text-xs text-neutral-500">({r.betCount})</span>
              </span>
              <span className={`font-medium ${profitColor(r.profit)}`}>{signedEur(r.profit)}</span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > 6 && (
        <button className="mt-1 text-xs text-neutral-400 hover:text-neutral-200" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'show less' : `show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}
