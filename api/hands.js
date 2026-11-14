import { BOARD_SIZE, isCardList } from './_lib/cards.js'
import { wasBluff } from './_lib/bluffRule.js'
import { sql } from './_lib/db.js'
import { HttpError, idFrom, isUuid, route } from './_lib/http.js'
import { handOut, ownedHand, ownedSession } from './_lib/tracker.js'

const HOLE_CARDS = 2
const MAX_BOARD = BOARD_SIZE.river

// The shown hands must be a { opponentId: [card, card] } object of this user's opponents.
function cleanShown(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new HttpError(400, 'Invalid shown hands')
  const shown = {}
  for (const [opponentId, cards] of Object.entries(value)) {
    if (!isUuid(opponentId)) throw new HttpError(400, 'Invalid opponent id')
    if (!Array.isArray(cards) || cards.length === 0) continue // An empty hand means "not shown".
    if (!isCardList(cards, HOLE_CARDS) || cards.length !== HOLE_CARDS) throw new HttpError(400, 'Enter both of an opponent’s cards')
    shown[opponentId] = cards
  }
  return shown
}

// A card can only be in one place: the board, the user's hand, or one opponent's hand.
function assertNoDuplicates(board, myCards, shown) {
  const all = [...board, ...myCards, ...Object.values(shown).flat()]
  if (new Set(all).size !== all.length) throw new HttpError(400, 'The same card is entered twice')
}

// Sets was_bluff on every judged bet from an opponent whose cards were shown. A bet that can't
// be scored (preflop, or no board at the time) stays unlabelled. Re-running after a correction
// replaces the old label, and removing a shown hand clears it.
async function labelActions(handId, shown) {
  const actions = await sql`
    select id, opponent_id, street, board from tracker_actions
    where hand_id = ${handId} and probability is not null
  `
  for (const action of actions) {
    const hole = shown[action.opponent_id]
    const label = hole ? wasBluff(hole, action.board, action.street) : null
    await sql`
      update tracker_actions
      set was_bluff = ${label}::boolean, labeled_at = case when ${label}::boolean is null then null else now() end
      where id = ${action.id}
    `
  }
}

export default route({
  // Starts the next hand of a session.
  async POST({ user, body, res }) {
    const session = await ownedSession(user.id, idFrom(body.sessionId, 'session id'))
    if (session.ended_at) throw new HttpError(409, 'This session has ended')
    const [row] = await sql`
      insert into tracker_hands (session_id, number)
      select ${session.id}::uuid, coalesce(max(number), 0) + 1 from tracker_hands where session_id = ${session.id}
      returning *
    `
    res.statusCode = 201
    return handOut(row)
  },

  // Updates the board, your own cards, the hands shown at showdown, or finishes the hand.
  // The board may only grow or be corrected; the shown hands are what label the bets.
  async PATCH({ user, query, body }) {
    const hand = await ownedHand(user.id, idFrom(query.id))
    const board = body.board === undefined ? hand.board : body.board
    const myCards = body.myCards === undefined ? hand.my_cards : body.myCards
    const shown = body.shown === undefined ? hand.shown : cleanShown(body.shown)

    if (!isCardList(board, MAX_BOARD) || ![0, 3, 4, 5].includes(board.length)) throw new HttpError(400, 'The board needs 0, 3, 4 or 5 cards')
    if (!isCardList(myCards, HOLE_CARDS)) throw new HttpError(400, 'Invalid cards for your hand')
    assertNoDuplicates(board, myCards, shown)
    if (body.shown !== undefined) {
      const ids = Object.keys(shown)
      if (ids.length) {
        const owned = await sql`select id from tracker_opponents where user_id = ${user.id}`
        if (!ids.every((id) => owned.some((o) => o.id === id))) throw new HttpError(404, 'Opponent not found')
      }
    }

    const [row] = await sql`
      update tracker_hands
      set board = ${JSON.stringify(board)}::jsonb,
          my_cards = ${JSON.stringify(myCards)}::jsonb,
          shown = ${JSON.stringify(shown)}::jsonb,
          ended_at = case when ${body.finish === true}::boolean then coalesce(ended_at, now()) else ended_at end
      where id = ${hand.id}
      returning *
    `
    if (body.shown !== undefined) await labelActions(hand.id, shown)
    return handOut(row)
  },

  async DELETE({ user, query }) {
    const hand = await ownedHand(user.id, idFrom(query.id))
    await sql`delete from tracker_hands where id = ${hand.id}`
    return { ok: true }
  },
})
