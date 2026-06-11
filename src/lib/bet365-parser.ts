import { MATCHES } from '../data/matches'
import { TEAMS } from '../data/teams'
import type { BetType, LegResult, Market } from './types'

export interface ParsedLeg {
  selection: string
  odds: number | null
  market: Market
  marketRaw: string
  homeTeam: string | null
  awayTeam: string | null
  homeCode: string | null
  awayCode: string | null
  teamCode: string | null
  matchNumber: number | null
  result: LegResult
  line: string | null
}

export interface ParsedBet {
  id: string
  stake: number
  betType: BetType
  betTypeRaw: string
  totalOdds: number
  isFreeBet: boolean
  potentialPayout: number | null
  legs: ParsedLeg[]
}

/** "€15,00" → 15.00 (Dutch formatting: "." thousands, "," decimals) */
export function parseEuro(text: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

const DUTCH_TEAMS: Record<string, string> = {
  spanje: 'ESP', frankrijk: 'FRA', 'brazilië': 'BRA', 'argentinië': 'ARG',
  duitsland: 'GER', engeland: 'ENG', nederland: 'NED', 'belgië': 'BEL',
  portugal: 'POR', 'kroatië': 'CRO', uruguay: 'URU', oostenrijk: 'AUT',
  noorwegen: 'NOR', zweden: 'SWE', zwitserland: 'SUI', turkije: 'TUR',
  schotland: 'SCO', japan: 'JPN', 'zuid-korea': 'KOR', 'australië': 'AUS',
  mexico: 'MEX', 'verenigde staten': 'USA', canada: 'CAN', marokko: 'MAR',
  senegal: 'SEN', ghana: 'GHA', egypte: 'EGY', 'tunesië': 'TUN',
  ivoorkust: 'CIV', algerije: 'ALG', 'zuid-afrika': 'RSA',
  'saoedi-arabië': 'KSA', iran: 'IRN', irak: 'IRQ', qatar: 'QAT',
  'jordanië': 'JOR', ecuador: 'ECU', colombia: 'COL', paraguay: 'PAR',
  panama: 'PAN', 'haïti': 'HAI', 'kaapverdië': 'CPV',
  'congo-kinshasa': 'COD', oezbekistan: 'UZB', 'nieuw-zeeland': 'NZL',
  'curaçao': 'CUW', 'bosnië en herzegovina': 'BIH', 'tsjechië': 'CZE',
  haiti: 'HAI', kameroen: 'CMR', // not qualified; resolves to null downstream
}

// English names from the team data as fallback
const ENGLISH_TEAMS = new Map(TEAMS.map((t) => [t.name.toLowerCase(), t.code]))
const VALID_CODES = new Set(TEAMS.map((t) => t.code))

export function resolveTeamCode(name: string | null | undefined): string | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  const code = DUTCH_TEAMS[key] ?? ENGLISH_TEAMS.get(key) ?? null
  return code && VALID_CODES.has(code) ? code : null
}

const DUTCH_MARKETS: [RegExp, Market][] = [
  [/eindresultaat/i, 'match_result'],
  [/meer\/minder doelpunten|meer\s*\/\s*minder/i, 'over_under_goals'],
  [/beide teams scoren/i, 'btts'],
  [/schoten op doel/i, 'shots_on_target'],
  [/hoekschoppen/i, 'corners'],
  [/kaarten/i, 'cards'],
  [/doelpuntenmakers|score op elk moment/i, 'goals'],
  [/assists?/i, 'assists'],
  [/passes/i, 'passes'],
  [/tackles/i, 'tackles'],
  [/bet builder/i, 'bet_builder'],
]

export function resolveMarket(raw: string): Market {
  for (const [re, market] of DUTCH_MARKETS) if (re.test(raw)) return market
  return 'other'
}

export function resolveBetType(raw: string, legCount: number): BetType {
  const t = raw.toLowerCase()
  if (/enkelvoudig|single/.test(t)) return 'straight'
  if (/\d+-voud|\d+-fold/.test(t)) return 'parlay'
  if (/bet builder/.test(t)) return 'bet_builder'
  if (/super boost/.test(t)) return 'super_boost'
  if (/winnaar|outright/.test(t)) return 'outright'
  return legCount > 1 ? 'parlay' : 'straight'
}

function findMatchNumber(home: string | null, away: string | null): number | null {
  if (!home || !away) return null
  const match = MATCHES.find(
    (m) => (m.home === home && m.away === away) || (m.home === away && m.away === home),
  )
  return match?.matchNumber ?? null
}

function legResult(indicator: Element | null): LegResult {
  const cls = indicator?.className ?? ''
  if (cls.includes('-won')) return 'won'
  if (cls.includes('-lost')) return 'lost'
  if (cls.includes('-void')) return 'void'
  return 'pending'
}

const text = (root: Element, selector: string): string =>
  root.querySelector(selector)?.textContent?.trim() ?? ''

export function parseBet365Html(html: string): ParsedBet[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const bets: ParsedBet[] = []

  for (const el of doc.querySelectorAll('.myb-OpenBetItem')) {
    const stake = parseEuro(text(el, '.myb-OpenBetItem_StakeDesc')) ?? 0
    const betTypeRaw = text(el, '.myb-OpenBetItem_HeaderText')
    const creditText = text(el, '.myb-BetCreditMessage_Text').toLowerCase()
    const isFreeBet = creditText.includes('wedtegoed') || creditText.includes('bet credit')
    const potentialPayout = parseEuro(text(el, '.myb-OpenBetItemInnerView_BetInformationText'))

    const legs: ParsedLeg[] = []
    for (const legEl of el.querySelectorAll('.myb-BetParticipant')) {
      const selection = text(legEl, '.myb-BetParticipant_ParticipantSpan')
      const oddsText = text(legEl, '.myb-BetParticipant_HeaderOdds')
      const odds = oddsText ? parseFloat(oddsText.replace(',', '.')) : NaN
      const marketRaw = text(legEl, '.myb-BetParticipant_MarketDescription')
      const homeTeam = text(legEl, '.myb-BetParticipant_Team1Name') || null
      const awayTeam = text(legEl, '.myb-BetParticipant_Team2Name') || null
      const homeCode = resolveTeamCode(homeTeam)
      const awayCode = resolveTeamCode(awayTeam)
      const selectionCode = resolveTeamCode(selection)

      legs.push({
        selection,
        odds: Number.isFinite(odds) ? odds : null,
        market: resolveMarket(marketRaw),
        marketRaw,
        homeTeam,
        awayTeam,
        homeCode,
        awayCode,
        teamCode: selectionCode,
        matchNumber: findMatchNumber(homeCode, awayCode),
        result: legResult(legEl.querySelector('.myb-WinLossIndicator')),
        // keep the bookie's wording when the pick isn't simply a team
        line: selectionCode ? null : selection || null,
      })
    }

    if (legs.length === 0) continue
    const product = legs.reduce((acc, l) => acc * (l.odds ?? 1), 1)
    bets.push({
      id: crypto.randomUUID(),
      stake,
      betType: resolveBetType(betTypeRaw, legs.length),
      betTypeRaw,
      totalOdds: Math.round(product * 100) / 100,
      isFreeBet,
      potentialPayout,
      legs,
    })
  }

  return bets
}
