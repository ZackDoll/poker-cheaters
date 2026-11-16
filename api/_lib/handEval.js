// Texas Hold'em hand evaluation. A hand is an array of numbers; bigger beats smaller
// when compared left to right (see compareHands).
import { rankValue } from './cards.js'

export const HIGH_CARD = 0
export const PAIR = 1
export const TWO_PAIR = 2
export const TRIPS = 3
export const STRAIGHT = 4
export const FLUSH = 5
export const FULL_HOUSE = 6
export const QUADS = 7
export const STRAIGHT_FLUSH = 8

// Highest card of a five-card straight in `values`, counting the ace low. Null if none.
function straightHigh(values) {
  const set = new Set(values)
  if (set.has(14)) set.add(1)
  for (let high = 14; high >= 5; high -= 1) {
    let all = true
    for (let v = high - 4; v <= high; v += 1) if (!set.has(v)) all = false
    if (all) return high
  }
  return null
}

export function compareHands(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function evaluateFive(cards) {
  const values = cards.map(rankValue).sort((x, y) => y - x)
  const flush = new Set(cards.map((c) => c[1])).size === 1
  const straight = new Set(values).size === 5 ? straightHigh(values) : null

  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const groups = [...counts.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])
  const shape = groups.map(([, count]) => count).join('')
  const ordered = groups.map(([value]) => value)

  if (straight && flush) return [STRAIGHT_FLUSH, straight]
  if (shape === '41') return [QUADS, ...ordered]
  if (shape === '32') return [FULL_HOUSE, ...ordered]
  if (flush) return [FLUSH, ...values]
  if (straight) return [STRAIGHT, straight]
  if (shape === '311') return [TRIPS, ...ordered]
  if (shape === '221') return [TWO_PAIR, ...ordered]
  if (shape === '2111') return [PAIR, ...ordered]
  return [HIGH_CARD, ...values]
}

function* combinations(items, size, start = 0, chosen = []) {
  if (chosen.length === size) {
    yield chosen
    return
  }
  for (let i = start; i <= items.length - (size - chosen.length); i += 1) {
    yield* combinations(items, size, i + 1, [...chosen, items[i]])
  }
}

// Best five-card hand from five to seven cards.
export function bestHand(cards) {
  if (cards.length < 5) throw new Error('need at least 5 cards')
  let best = null
  for (const combo of combinations(cards, 5)) {
    const hand = evaluateFive(combo)
    if (!best || compareHands(hand, best) > 0) best = hand
  }
  return best
}
