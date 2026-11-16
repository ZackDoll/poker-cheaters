import { BOARD_SIZE, STREETS } from './_lib/cards.js'
import { sql } from './_lib/db.js'
import { HttpError, idFrom, route } from './_lib/http.js'
import { scoreBet } from './_lib/scoring.js'
import { actionOut, ownedHand, ownedOpponent } from './_lib/tracker.js'

const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise']
const POSITIONS = ['early', 'middle', 'late']
const MAX_CHIPS = 1_000_000_000
const MAX_PLAYERS = 10
const MAX_FACE_DEVIATIONS = 60

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

function chips(value, label) {
  if (value === undefined || value === null || value === '') return 0
  if (!isNumber(value) || value < 0 || value > MAX_CHIPS) throw new HttpError(400, `Invalid ${label}`)
  return value
}

// The browser sends only derived scores. Anything malformed is dropped, not trusted.
function cleanFace(face) {
  if (!face || typeof face !== 'object') return null
  const { samples, trackedRatio, meanScore, deviations } = face
  if (!Number.isInteger(samples) || samples < 0 || samples > 100_000) return null
  if (!isNumber(trackedRatio) || trackedRatio < 0 || trackedRatio > 1) return null
  if (!isNumber(meanScore) || meanScore < 0 || meanScore > 10) return null
  if (!Array.isArray(deviations) || deviations.length > MAX_FACE_DEVIATIONS) return null
  const cleaned = deviations.filter(
    (d) => d && typeof d.name === 'string' && /^[A-Za-z]{1,40}$/.test(d.name) && isNumber(d.z) && Math.abs(d.z) < 100,
  )
  return { samples, trackedRatio, meanScore, deviations: cleaned.map((d) => ({ name: d.name, z: d.z })) }
}

export default route({
  // Logs what an opponent just did. Bets and raises come back with a bluff estimate.
  async POST({ user, body, res }) {
    const hand = await ownedHand(user.id, idFrom(body.handId, 'hand id'))
    const opponent = await ownedOpponent(user.id, idFrom(body.opponentId, 'opponent id'))
    if (hand.ended_at) throw new HttpError(409, 'This hand is finished')

    if (!STREETS.includes(body.street)) throw new HttpError(400, 'Invalid street')
    if (!ACTIONS.includes(body.action)) throw new HttpError(400, 'Invalid action')
    const aggressive = body.action === 'bet' || body.action === 'raise'
    const betSize = chips(body.betSize, 'bet size')
    const potSize = chips(body.potSize, 'pot size')
    if (body.action === 'call' && betSize === 0) throw new HttpError(400, 'Enter how much they called')
    if (aggressive && (betSize === 0 || potSize === 0)) throw new HttpError(400, 'Enter the bet size and the pot size')

    // The board showing on this street, so postflop reads have something to read.
    const board = hand.board.slice(0, BOARD_SIZE[body.street])
    if (board.length !== BOARD_SIZE[body.street]) {
      throw new HttpError(409, `Enter the ${body.street} cards before logging this action`)
    }

    const activePlayers = body.activePlayers ?? null
    if (activePlayers !== null && !(Number.isInteger(activePlayers) && activePlayers >= 2 && activePlayers <= MAX_PLAYERS)) {
      throw new HttpError(400, 'Players still in must be between 2 and 10')
    }
    const position = body.position ?? null
    if (position !== null && !POSITIONS.includes(position)) throw new HttpError(400, 'Invalid position')

    const face = cleanFace(body.face)
    let scored = { probability: null, reasons: [], tells: [] }
    if (aggressive) {
      const prior = await sql`
        select street, action from tracker_actions
        where hand_id = ${hand.id} and opponent_id = ${opponent.id}
        order by created_at
      `
      scored = scoreBet(
        {
          street: body.street,
          board,
          betSize,
          potSize,
          activePlayers: activePlayers ?? 2,
          position,
          priorActions: prior,
          myCards: hand.my_cards,
        },
        face,
      )
    }

    const [row] = await sql`
      insert into tracker_actions
        (hand_id, session_id, opponent_id, street, action, bet_size, pot_size, active_players, position,
         board, face, probability, reasons, tells)
      values
        (${hand.id}, ${hand.session_id}, ${opponent.id}, ${body.street}, ${body.action}, ${betSize}, ${potSize},
         ${activePlayers}, ${position}, ${JSON.stringify(board)}::jsonb,
         ${face ? JSON.stringify(face) : null}::jsonb, ${scored.probability},
         ${JSON.stringify(scored.reasons)}::jsonb, ${JSON.stringify(scored.tells)}::jsonb)
      returning *
    `
    res.statusCode = 201
    return actionOut({ ...row, opponent_name: opponent.name })
  },

  // Removes a mistaken entry.
  async DELETE({ user, query }) {
    const id = idFrom(query.id)
    const rows = await sql`
      delete from tracker_actions a using tracker_sessions s
      where a.id = ${id} and s.id = a.session_id and s.user_id = ${user.id}
      returning a.id
    `
    if (rows.length === 0) throw new HttpError(404, 'Action not found')
    return { ok: true }
  },
})
