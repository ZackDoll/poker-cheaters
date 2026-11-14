// Turns one bet or raise into a bluff estimate: hand-set rules on the bet and the board, plus
// the browser's face score, fused as log-odds. Placeholders chosen by hand, not fitted to data,
// so the output is an uncalibrated estimate and must never be described as a probability.
//
// Positive log-odds mean toward a bluff. Every reason shown to the user is a real term of the sum.
import { RANKS } from './cards.js'

export const SCORING_VERSION = 'baseline-0.1'

const PRIOR = 0.35
const WEIGHTS = { statistics: 1.0, live_facial: 0.5 }
const MAX_REASONS = 3
const MIN_CONTRIBUTION = 0.01

const LARGE_BET_RATIO = 0.75
const OVERBET_RATIO = 1.25
const SMALL_BET_RATIO = 0.33

const logit = (p) => Math.log(p / (1 - p))
const sigmoid = (x) => 1 / (1 + Math.exp(-x))

const rankIndex = (card) => RANKS.indexOf(card[0])
const countBy = (items) => {
  const counts = {}
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1
  return counts
}

// Three board cards within a five-rank window let two hole cards make a straight.
function straightPossible(ranks) {
  const values = new Set(ranks)
  if (values.has(RANKS.indexOf('A'))) values.add(-1) // The ace also plays low.
  for (let start = -1; start < 9; start += 1) {
    if ([...values].filter((v) => v >= start && v < start + 5).length >= 3) return true
  }
  return false
}

// Unpaired, with no flush or straight possible.
function isDry(board) {
  const ranks = board.map(rankIndex)
  const unpaired = new Set(ranks).size === ranks.length
  const maxSuited = Math.max(...Object.values(countBy(board.map((c) => c[1]))))
  return unpaired && maxSuited <= 2 && !straightPossible(ranks)
}

// A flush draw was possible on the turn, and the river did not complete it.
function missedFlushDraw(board) {
  const turnSuits = countBy(board.slice(0, 4).map((c) => c[1]))
  return Math.max(...Object.values(turnSuits)) === 2 && (turnSuits[board[4][1]] ?? 0) < 2
}

const evidence = (code, description, logOdds) => ({ code, description, logOdds })

function betSizeEvidence(state, ratio) {
  const items = []
  if (ratio >= OVERBET_RATIO) {
    items.push(evidence('overbet', `Bet is ${ratio.toFixed(1)}x the pot, a size often used to force folds`, 0.6))
  } else if (ratio <= SMALL_BET_RATIO) {
    items.push(
      evidence('small_bet', `Bet is only ${Math.round(ratio * 100)}% of the pot, which pressures few hands`, -0.3),
    )
  }
  if (state.street !== 'preflop' && ratio >= LARGE_BET_RATIO && isDry(state.board)) {
    items.push(evidence('large_bet_on_dry_board', 'Large bet on a dry board, where few strong hands are likely', 0.5))
  }
  if (state.street === 'river' && ratio >= LARGE_BET_RATIO && missedFlushDraw(state.board)) {
    items.push(evidence('missed_flush_draw', 'Large river bet after a flush draw missed', 0.4))
  }
  return items
}

function tableEvidence(state) {
  const items = []
  if (state.activePlayers >= 3) {
    items.push(
      evidence(
        'multiway_pot',
        `${state.activePlayers} players are still in, and bluffs rarely work against several opponents`,
        -0.5,
      ),
    )
  }
  if (state.street === 'preflop') {
    if (state.position === 'late') {
      items.push(evidence('late_position_raise', 'Raise from late position, a common spot to steal the blinds', 0.4))
    } else if (state.position === 'early') {
      items.push(
        evidence('early_position_raise', 'Raise from early position, which usually shows a strong range', -0.5),
      )
    }
  }
  return items
}

function lineEvidence(state, ratio) {
  const postflop = state.priorActions.filter((a) => a.street !== 'preflop')
  if (postflop.length === 0 || ratio < LARGE_BET_RATIO) return []
  if (postflop.every((a) => a.action === 'check' || a.action === 'call')) {
    return [evidence('sudden_aggression', 'Large bet after only checking or calling on earlier streets', 0.3)]
  }
  if (postflop.every((a) => a.action === 'bet' || a.action === 'raise')) {
    return [evidence('consistent_aggression', 'Has bet or raised on every earlier street, a consistent story', -0.2)]
  }
  return []
}

function blockerEvidence(state) {
  if (state.myCards.length === 0 || state.board.length === 0) return []
  const counts = countBy(state.board.map((c) => c[1]))
  const [suit, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (count >= 3 && state.myCards.includes(`A${suit}`)) {
    return [evidence('observer_blocks_nut_flush', "You hold the flush suit's ace, so they can't have the nut flush", 0.35)]
  }
  return []
}

// Rule-based read of the bet and the board.
function statisticsSignal(state) {
  const ratio = state.betSize / state.potSize
  return {
    name: 'statistics',
    confidence: state.street === 'preflop' ? 0.5 : 0.8,
    evidence: [
      ...betSizeEvidence(state, ratio),
      ...tableEvidence(state),
      ...lineEvidence(state, ratio),
      ...blockerEvidence(state),
    ],
  }
}

// --- Face signal -----------------------------------------------------------------------
// The browser measures the video; the server only judges the derived numbers.

const NEUTRAL_SCORE = 3.0
const LOG_ODDS_PER_POINT = 0.15
const MIN_FACE_LOG_ODDS = -0.3
const MAX_FACE_LOG_ODDS = 1.0
const MIN_SAMPLES = 3
const MIN_TRACKED_RATIO = 0.3
const TELL_Z = 2.0
const MAX_TELLS = 3

const FACE_GROUPS = [
  ['brow movement', /brow/],
  ['lip movement', /mouthPress|mouthPucker|mouthFunnel|mouthRoll|mouthShrug/],
  ['smile movement', /mouthSmile|mouthDimple/],
  ['jaw movement', /jaw/],
  ['eye narrowing', /eyeSquint|eyeWide/],
]

function faceLabel(name) {
  for (const [label, pattern] of FACE_GROUPS) if (pattern.test(name)) return label
  return name.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
}

function tellsOf(face) {
  return [...face.deviations]
    .filter((d) => Math.abs(d.z) >= TELL_Z)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, MAX_TELLS)
    .map((d) => {
      const label = faceLabel(d.name)
      return evidence(`tell:${d.name}`, `${label[0].toUpperCase()}${label.slice(1)} ${d.z > 0 ? 'up' : 'down'} vs resting`, 0)
    })
}

// Reads the expression-change score the browser measured against the player's own baseline.
// Tell evidence has log-odds 0: it feeds the opponent profile but never changes the score.
function faceSignal(face) {
  if (!face || face.samples < MIN_SAMPLES || face.trackedRatio < MIN_TRACKED_RATIO) return null
  const logOdds = Math.max(
    MIN_FACE_LOG_ODDS,
    Math.min(MAX_FACE_LOG_ODDS, (face.meanScore - NEUTRAL_SCORE) * LOG_ODDS_PER_POINT),
  )
  let description = 'Face stayed close to their own resting baseline'
  if (face.meanScore >= NEUTRAL_SCORE) {
    const strongest = [...face.deviations].sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0]
    description = `Face moved away from their own resting baseline${strongest ? `, mostly ${faceLabel(strongest.name)}` : ''}`
  }
  return {
    name: 'live_facial',
    confidence: face.trackedRatio * Math.min(1, face.samples / 6),
    evidence: [evidence('expression_change', description, logOdds), ...tellsOf(face)],
  }
}

// state: { street, board, betSize, potSize, activePlayers, position, priorActions, myCards }
// face:  { samples, trackedRatio, meanScore, deviations: [{ name, z }] } or null.
// Returns { probability, reasons, tells, version }. Reasons are the strongest terms of the sum.
export function scoreBet(state, face) {
  const signals = [statisticsSignal(state), faceSignal(face)].filter(Boolean)
  let total = logit(PRIOR)
  const reasons = []
  const tells = []

  for (const signal of signals) {
    const scale = WEIGHTS[signal.name] * signal.confidence
    for (const item of signal.evidence) {
      const contribution = scale * item.logOdds
      total += contribution
      if (item.code.startsWith('tell:')) {
        tells.push({ code: item.code, description: item.description })
      } else if (Math.abs(contribution) >= MIN_CONTRIBUTION) {
        reasons.push({
          source: signal.name,
          code: item.code,
          description: item.description,
          direction: contribution > 0 ? 'toward_bluff' : 'away_from_bluff',
          contribution,
        })
      }
    }
  }

  reasons.sort(
    (a, b) =>
      Math.abs(b.contribution) - Math.abs(a.contribution) ||
      a.source.localeCompare(b.source) ||
      a.code.localeCompare(b.code),
  )
  return { probability: sigmoid(total), reasons: reasons.slice(0, MAX_REASONS), tells, version: SCORING_VERSION }
}
