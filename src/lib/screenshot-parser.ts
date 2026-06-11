import Anthropic from '@anthropic-ai/sdk'
import {
  findMatchNumber,
  findSquadPlayerName,
  isSuperBoostText,
  resolveBetType,
  resolveMarket,
  resolveTeamCode,
  type ParsedBet,
} from './bet365-parser'

const MODEL = 'claude-opus-4-8'

const nullable = (type: 'string' | 'number') => ({ anyOf: [{ type }, { type: 'null' }] })

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bets'],
  properties: {
    bets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['stake', 'betTypeRaw', 'isFreeBet', 'totalOdds', 'potentialPayout', 'legs'],
        properties: {
          stake: { type: 'number', description: 'Stake in euros, e.g. 15.0' },
          betTypeRaw: {
            type: 'string',
            description: 'Bet type exactly as shown, e.g. "Enkelvoudig", "7-voud", "Bet Builder", "Super Boost"',
          },
          isFreeBet: {
            type: 'boolean',
            description: 'True if placed with free bet / promo credit ("wedtegoed", "bet credit")',
          },
          totalOdds: { type: 'number', description: 'Combined decimal odds of the whole bet' },
          potentialPayout: {
            ...nullable('number'),
            description: 'Potential or actual payout in euros if visible, else null',
          },
          legs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['selection', 'odds', 'marketRaw', 'homeTeam', 'awayTeam', 'playerName', 'line'],
              properties: {
                selection: { type: 'string', description: 'The pick exactly as shown' },
                odds: { ...nullable('number'), description: 'Decimal odds of this leg if shown' },
                marketRaw: { type: 'string', description: 'Market name as shown, e.g. "Eindresultaat"' },
                homeTeam: { ...nullable('string'), description: 'Home team of the fixture if shown' },
                awayTeam: { ...nullable('string'), description: 'Away team of the fixture if shown' },
                playerName: { ...nullable('string'), description: 'Player the pick is about, if any' },
                line: {
                  ...nullable('string'),
                  description: 'Threshold like "2+" or "Meer dan 2,5" if applicable',
                },
              },
            },
          },
        },
      },
    },
  },
} as const

const PROMPT = `These are screenshots of sports bet slips (Dutch or English bookmaker apps such as Bet365, Unibet, BetCity, Toto or 711) for the FIFA World Cup 2026.

Extract every bet visible across all screenshots. Amounts use Dutch formatting ("€15,00" = 15.00). A bet placed with "wedtegoed" or "bet credit" is a free bet. For each leg, copy team, player, market and selection text exactly as displayed. If the same bet is partially visible in two screenshots, report it once.`

const TEXT_PROMPT = `Below is text copied from the "My Bets" page of a Dutch or English bookmaker (Bet365, Unibet, BetCity, Toto, 711, ...) containing sports bets for the FIFA World Cup 2026. The text is messy because it was copied straight from the page — navigation labels and promotional text may be mixed in.

Extract every distinct bet. Amounts may use Dutch ("€15,00") or English ("€15.00") formatting. A bet placed with "wedtegoed" or "bet credit" is a free bet. For each leg, copy team, player, market and selection text exactly as displayed. Report each bet once.`

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

async function toImageBlock(file: File): Promise<Anthropic.ImageBlockParam> {
  const buf = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  const mediaType: MediaType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
    ? (file.type as MediaType)
    : 'image/jpeg'
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: btoa(binary) } }
}

interface RawLeg {
  selection: string
  odds: number | null
  marketRaw: string
  homeTeam: string | null
  awayTeam: string | null
  playerName: string | null
  line: string | null
}

interface RawBet {
  stake: number
  betTypeRaw: string
  isFreeBet: boolean
  totalOdds: number
  potentialPayout: number | null
  legs: RawLeg[]
}

async function extract(apiKey: string, content: Anthropic.ContentBlockParam[]): Promise<ParsedBet[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to read this input. Try a clearer copy of the bet slip.')
  }
  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No bets could be read.')

  const raw = JSON.parse(text) as { bets: RawBet[] }
  return raw.bets.map((b) => {
    const legs = b.legs.map((l) => {
      const homeCode = resolveTeamCode(l.homeTeam)
      const awayCode = resolveTeamCode(l.awayTeam)
      const teamCode = resolveTeamCode(l.selection)
      const playerName = findSquadPlayerName(l.playerName) ?? (l.playerName?.trim() || null)
      return {
        selection: l.selection,
        odds: l.odds,
        market: resolveMarket(l.marketRaw),
        marketRaw: l.marketRaw,
        homeTeam: l.homeTeam,
        awayTeam: l.awayTeam,
        homeCode,
        awayCode,
        teamCode,
        playerName: teamCode ? null : playerName,
        matchNumber: findMatchNumber(homeCode, awayCode),
        result: 'pending' as const,
        line: l.line ?? (teamCode || playerName ? null : l.selection),
      }
    })
    return {
      id: crypto.randomUUID(),
      stake: b.stake,
      betType: resolveBetType(b.betTypeRaw, legs.length),
      betTypeRaw: b.betTypeRaw,
      totalOdds: b.totalOdds,
      isFreeBet: b.isFreeBet,
      isSuperBoost: isSuperBoostText(b.betTypeRaw),
      potentialPayout: b.potentialPayout,
      legs,
    }
  })
}

export async function parseScreenshots(apiKey: string, files: File[]): Promise<ParsedBet[]> {
  const images = await Promise.all(files.map(toImageBlock))
  return extract(apiKey, [...images, { type: 'text', text: PROMPT }])
}

/** Universal import: text copied from any bookmaker's My Bets page. */
export function parseSlipText(apiKey: string, pasted: string): Promise<ParsedBet[]> {
  const trimmed = pasted.length > 100_000 ? pasted.slice(0, 100_000) : pasted
  return extract(apiKey, [{ type: 'text', text: `${TEXT_PROMPT}\n\n---\n\n${trimmed}` }])
}
