import { useMemo, useState } from 'react'
import { MATCHES } from '../data/matches'
import { useData } from '../lib/data'
import { kickoffLocal, matchLabel, stagePrefix } from '../lib/format'

export function MatchSelect({
  value,
  onChange,
}: {
  value: number | null
  onChange: (matchNumber: number | null) => void
}) {
  const { knockout } = useData()
  const [now] = useState(() => Date.now())

  const groups = useMemo(() => {
    const sorted = [...MATCHES].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
    // upcoming matches first, then past ones (still selectable for late logging)
    const upcoming = sorted.filter((m) => new Date(m.kickoffUtc).getTime() >= now - 3 * 3600_000)
    const past = sorted.filter((m) => new Date(m.kickoffUtc).getTime() < now - 3 * 3600_000).reverse()
    const byDay = (list: typeof sorted, suffix: string) => {
      const acc = new Map<string, typeof sorted>()
      for (const m of list) {
        const day =
          new Date(m.kickoffUtc).toLocaleDateString('nl-NL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }) + suffix
        acc.set(day, [...(acc.get(day) ?? []), m])
      }
      return acc
    }
    return [...byDay(upcoming, ''), ...byDay(past, ' (played)')]
  }, [now])

  return (
    <select
      className="input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">— pick a match —</option>
      {groups.map(([day, matches]) => (
        <optgroup key={day} label={day}>
          {matches.map((m) => (
            <option key={m.matchNumber} value={m.matchNumber}>
              {matchLabel(m, knockout)} · {stagePrefix(m)} · {kickoffLocal(m.kickoffUtc)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
