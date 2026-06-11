import { legDescription } from './describe'
import { eur, signedEur } from './format'
import { betProfit } from './money'
import type { Bet, KnockoutTeams, Player } from './types'
import { BET_TYPE_LABELS } from './types'

const W = 1080
const H = 1350

function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 90)
  ctx.fill()
  ctx.restore()
}

/** Draw a WC26-styled share image for a winning bet and return it as a PNG blob. */
export function drawWinCard(
  bet: Bet,
  players: Map<string, Player>,
  knockout: Map<number, KnockoutTeams>,
  bookmakerName: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const font = (px: number, weight = 700) => `${weight} ${px}px 'Space Grotesk', sans-serif`

  // background + key-art blocks + dark wash
  ctx.fillStyle = '#0c0a12'
  ctx.fillRect(0, 0, W, H)
  block(ctx, -60, 140, 520, 640, 12, 'rgba(109,40,217,0.7)')
  block(ctx, W - 40, 320, 480, 600, -12, 'rgba(225,29,72,0.6)')
  block(ctx, W - 150, H - 100, 540, 560, 6, 'rgba(132,204,22,0.5)')
  block(ctx, 100, H - 160, 480, 520, -6, 'rgba(5,150,105,0.6)')
  ctx.fillStyle = 'rgba(12,10,18,0.62)'
  ctx.fillRect(0, 0, W, H)

  // header: 26 badge + wordmark
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(72, 72, 92, 64, 14)
  ctx.fill()
  ctx.fillStyle = '#0c0a12'
  ctx.font = font(44, 800)
  ctx.fillText('26', 88, 118)
  ctx.fillStyle = '#ffffff'
  ctx.font = font(40, 800)
  ctx.fillText('World Cup', 186, 116)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = font(24, 500)
  ctx.fillText('BET TRACKER', 420, 112)

  // trophy + WINNER
  ctx.font = '160px serif'
  ctx.fillText('🏆', 72, 360)
  ctx.fillStyle = '#34d399'
  ctx.font = font(56, 800)
  ctx.fillText('WINNER', 300, 290)
  const profit = betProfit(bet) ?? 0
  ctx.fillStyle = '#ffffff'
  ctx.font = font(120, 800)
  ctx.fillText(signedEur(profit), 300, 400)

  // slip card
  ctx.fillStyle = 'rgba(16,14,24,0.85)'
  ctx.beginPath()
  ctx.roundRect(72, 470, W - 144, 620, 32)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = font(28, 500)
  ctx.fillText(`${bookmakerName} · ${BET_TYPE_LABELS[bet.bet_type]}${bet.is_free_bet ? ' · free bet' : ''}`, 110, 540)

  let y = 612
  const maxLegs = 7
  for (const leg of bet.legs.slice(0, maxLegs)) {
    const d = legDescription(leg, players, knockout)
    ctx.fillStyle = leg.result === 'lost' ? '#fb7185' : '#34d399'
    ctx.font = font(34, 700)
    ctx.fillText(leg.result === 'lost' ? '✗' : '✓', 110, y)
    ctx.fillStyle = '#f5f5f5'
    let text = d.main + (d.context ? `  ·  ${d.context}` : '')
    if (text.length > 52) text = text.slice(0, 51) + '…'
    ctx.font = font(32, 500)
    ctx.fillText(text, 160, y)
    y += 56
  }
  if (bet.legs.length > maxLegs) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = font(30, 500)
    ctx.fillText(`+ ${bet.legs.length - maxLegs} more legs`, 160, y)
  }

  // stake → payout
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.moveTo(110, 1000)
  ctx.lineTo(W - 110, 1000)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = font(30, 500)
  ctx.fillText(`Stake ${eur(bet.stake)}  @  ${bet.total_odds}`, 110, 1056)
  const payoutText = `→ ${eur(bet.payout ?? 0)}`
  ctx.fillStyle = '#34d399'
  ctx.font = font(40, 800)
  ctx.fillText(payoutText, W - 110 - ctx.measureText(payoutText).width, 1058)

  // footer
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = font(26, 500)
  ctx.fillText('⚽ WC26 Bet Tracker · bet responsibly 🍀', 72, H - 80)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render image'))), 'image/png')
  })
}

/** Share via the native sheet on mobile; download on desktop. */
export async function shareWinCard(
  bet: Bet,
  players: Map<string, Player>,
  knockout: Map<number, KnockoutTeams>,
  bookmakerName: string,
): Promise<void> {
  await document.fonts.load("800 40px 'Space Grotesk'")
  const blob = await drawWinCard(bet, players, knockout, bookmakerName)
  const file = new File([blob], 'wc26-win.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'WC26 win' })
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wc26-win.png'
    a.click()
    URL.revokeObjectURL(url)
  }
}
