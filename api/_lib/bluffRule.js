// The working definition of a bluff, used to label a bet once the bettor's cards are shown.
// Needs team sign-off before the labels are used for training.
//
// A postflop bet or raise is a bluff when, at the moment it was made, the bettor's best hand
// was weaker than a pair that uses at least one of their hole cards, and they were not on a
// flush draw or an open-ended straight draw (a semi-bluff with real equity counts as a value
// bet here). Preflop bets are not labelled.
import { BOARD_SIZE, rankValue } from './cards.js'
import { PAIR, bestHand } from './handEval.js'

function hasFlushDraw(hole, cards) {
  const counts = {}
  for (const card of cards) counts[card[1]] = (counts[card[1]] ?? 0) + 1
  return hole.some((card) => counts[card[1]] === 4)
}

function hasOpenEndedDraw(cards) {
  const values = new Set(cards.map(rankValue))
  for (let low = 2; low <= 10; low += 1) {
    if ([0, 1, 2, 3].every((step) => values.has(low + step))) return true
  }
  return false
}

// true / false for postflop bets, null when the bet should not be labelled.
export function wasBluff(hole, boardAtBet, street) {
  if (!(street in BOARD_SIZE) || street === 'preflop' || boardAtBet.length !== BOARD_SIZE[street]) return null
  const cards = [...hole, ...boardAtBet]
  const rank = bestHand(cards)
  if (rank[0] > PAIR) return false // Two pair or better.
  if (rank[0] === PAIR && hole.map(rankValue).includes(rank[1])) return false // A pair using a hole card.
  if (street !== 'river' && (hasFlushDraw(hole, cards) || hasOpenEndedDraw(cards))) return false
  return true
}
