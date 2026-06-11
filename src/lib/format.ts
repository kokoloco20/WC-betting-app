import type { MatchInfo, Stage } from '../data/matches'
import { teamByCode } from '../data/teams'
import type { KnockoutTeams } from './types'

const EUR = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

export const eur = (n: number) => EUR.format(n)
export const signedEur = (n: number) => (n > 0 ? '+' : '') + EUR.format(n)

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export function profitColor(n: number): string {
  return n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-sky-300'
}

export function kickoffLocal(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STAGE_LABELS: Record<Stage, string> = {
  group: 'Group',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  third_place: 'Third place',
  final: 'Final',
}

export function teamName(code: string | null | undefined): string | null {
  return code ? (teamByCode.get(code)?.name ?? code) : null
}

/** "Netherlands – Japan" or "1A – 3CEFHI" for unfilled knockout slots. */
export function matchLabel(m: MatchInfo, knockout: Map<number, KnockoutTeams>): string {
  const ko = knockout.get(m.matchNumber)
  const home = teamName(m.home ?? ko?.home_code) ?? m.homeLabel ?? 'TBD'
  const away = teamName(m.away ?? ko?.away_code) ?? m.awayLabel ?? 'TBD'
  return `${home} – ${away}`
}

export function stagePrefix(m: MatchInfo): string {
  return m.stage === 'group' ? `Group ${m.group}` : STAGE_LABELS[m.stage]
}
