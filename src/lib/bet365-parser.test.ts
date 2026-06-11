// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseBet365Html, parseEuro, resolveBetType, resolveMarket, resolveTeamCode } from './bet365-parser'

const leg = (opts: {
  selection: string
  odds: string
  market: string
  home?: string
  away?: string
  indicator?: string
}) => `
  <div class="myb-BetParticipant">
    <div class="myb-WinLossIndicator ${opts.indicator ?? '-torun'}"></div>
    <span class="myb-BetParticipant_ParticipantSpan">${opts.selection}</span>
    <span class="myb-BetParticipant_HeaderOdds">${opts.odds}</span>
    <div class="myb-BetParticipant_MarketDescription">${opts.market}</div>
    ${opts.home ? `<span class="myb-BetParticipant_Team1Name">${opts.home}</span>` : ''}
    ${opts.away ? `<span class="myb-BetParticipant_Team2Name">${opts.away}</span>` : ''}
  </div>`

const bet = (opts: { stake: string; header: string; payout?: string; credit?: string; legs: string }) => `
  <div class="myb-OpenBetItem">
    <div class="myb-OpenBetItem_HeaderText">${opts.header}</div>
    <div class="myb-OpenBetItem_StakeDesc">${opts.stake}</div>
    ${opts.credit ? `<div class="myb-BetCreditMessage_Text">${opts.credit}</div>` : ''}
    ${opts.legs}
    <div class="myb-OpenBetItemInnerView_BetInformationText">${opts.payout ?? ''}</div>
  </div>`

describe('parseEuro', () => {
  it('parses Dutch euro formats', () => {
    expect(parseEuro('€15,00')).toBe(15)
    expect(parseEuro('€1.250,50')).toBe(1250.5)
    expect(parseEuro('€15,5')).toBe(15.5)
    expect(parseEuro('')).toBeNull()
  })
  it('parses English euro formats', () => {
    expect(parseEuro('€15.00')).toBe(15)
    expect(parseEuro('€1,250.50')).toBe(1250.5)
    expect(parseEuro('€80.29')).toBe(80.29)
  })
  it('treats a trailing 3-digit group as thousands', () => {
    expect(parseEuro('€1.250')).toBe(1250)
    expect(parseEuro('€1,250')).toBe(1250)
  })
})

describe('resolvers', () => {
  it('maps Dutch and English team names', () => {
    expect(resolveTeamCode('Spanje')).toBe('ESP')
    expect(resolveTeamCode('Bosnië en Herzegovina')).toBe('BIH')
    expect(resolveTeamCode('Netherlands')).toBe('NED')
    expect(resolveTeamCode('Kameroen')).toBeNull() // not at this World Cup
    expect(resolveTeamCode('FC Knudde')).toBeNull()
  })
  it('maps Dutch and English markets', () => {
    expect(resolveMarket('Eindresultaat')).toBe('match_result')
    expect(resolveMarket('Full Time Result')).toBe('match_result')
    expect(resolveMarket('Meer/minder doelpunten')).toBe('over_under_goals')
    expect(resolveMarket('Goals Over/Under')).toBe('over_under_goals')
    expect(resolveMarket('Score op elk moment')).toBe('goals')
    expect(resolveMarket('Anytime Scorer')).toBe('goals')
    expect(resolveMarket('Both Teams to Score')).toBe('btts')
    expect(resolveMarket('Iets exotisch')).toBe('other')
  })
  it('maps Dutch bet types', () => {
    expect(resolveBetType('Enkelvoudig', 1)).toBe('straight')
    expect(resolveBetType('7-voud', 7)).toBe('parlay')
    expect(resolveBetType('Bet Builder', 3)).toBe('bet_builder')
    expect(resolveBetType('???', 2)).toBe('parlay')
  })
})

describe('parseBet365Html', () => {
  it('parses a straight bet with match resolution', () => {
    const html = bet({
      stake: '€15,00',
      header: 'Enkelvoudig',
      payout: '€16,50',
      legs: leg({ selection: 'Mexico', odds: '1.10', market: 'Eindresultaat', home: 'Mexico', away: 'Zuid-Afrika' }),
    })
    const [b] = parseBet365Html(html)
    expect(b.stake).toBe(15)
    expect(b.betType).toBe('straight')
    expect(b.isFreeBet).toBe(false)
    expect(b.potentialPayout).toBe(16.5)
    expect(b.legs[0].market).toBe('match_result')
    expect(b.legs[0].teamCode).toBe('MEX')
    expect(b.legs[0].matchNumber).toBe(1) // opening match MEX–RSA
    expect(b.legs[0].line).toBeNull()
  })

  it('parses a free-bet parlay, multiplies odds, keeps non-team picks as line', () => {
    const html = bet({
      stake: '€10,00',
      header: '2-voud',
      credit: 'Geplaatst met wedtegoed',
      legs:
        leg({ selection: 'Spanje', odds: '1.50', market: 'Eindresultaat', home: 'Spanje', away: 'Uruguay', indicator: '-won' }) +
        leg({ selection: 'Meer dan 2,5', odds: '2.00', market: 'Meer/minder doelpunten', home: 'Nederland', away: 'Japan' }),
    })
    const [b] = parseBet365Html(html)
    expect(b.betType).toBe('parlay')
    expect(b.isFreeBet).toBe(true)
    expect(b.totalOdds).toBe(3)
    expect(b.legs[0].result).toBe('won')
    expect(b.legs[1].line).toBe('Meer dan 2,5')
    expect(b.legs[1].matchNumber).not.toBeNull() // NED–JPN is a real group F fixture
  })

  it('recognizes squad players in the selection', () => {
    const html = bet({
      stake: '€5,00',
      header: 'Enkelvoudig',
      legs: leg({ selection: 'Virgil van Dijk', odds: '3.00', market: 'Kaarten', home: 'Nederland', away: 'Japan' }),
    })
    const [b] = parseBet365Html(html)
    expect(b.legs[0].playerName).toBe('Virgil van Dijk')
    expect(b.legs[0].line).toBeNull()
  })

  it('returns empty array for unrelated HTML', () => {
    expect(parseBet365Html('<div>hoi</div>')).toEqual([])
  })
})
