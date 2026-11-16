// Shared by the tracker endpoints: row-to-JSON shapes, ownership checks and the stats maths.
import { sql } from './db.js'
import { HttpError } from './http.js'

const BLUFF_THRESHOLD = 0.5
const TOP_ITEMS = 5
const RECENT_SESSIONS = 5

// --- Shapes ------------------------------------------------------------------------------

// numeric columns arrive from Postgres as strings, so convert them here once.
export function actionOut(row) {
  return {
    id: row.id,
    hand_id: row.hand_id,
    opponent_id: row.opponent_id,
    opponent_name: row.opponent_name,
    street: row.street,
    action: row.action,
    bet_size: Number(row.bet_size),
    pot_size: Number(row.pot_size),
    probability: row.probability === null ? null : Number(row.probability),
    reasons: row.reasons ?? [],
    tells: row.tells ?? [],
    has_face: Boolean(row.face),
    was_bluff: row.was_bluff,
    created_at: row.created_at,
  }
}

export function handOut(row, actions = []) {
  return {
    id: row.id,
    session_id: row.session_id,
    number: row.number,
    board: row.board ?? [],
    my_cards: row.my_cards ?? [],
    shown: row.shown ?? {},
    created_at: row.created_at,
    ended_at: row.ended_at,
    actions,
  }
}

// --- Ownership ---------------------------------------------------------------------------
// Every lookup includes the user id, so someone else's id is just "not found".

export async function ownedSession(userId, id) {
  const [row] = await sql`select * from tracker_sessions where id = ${id} and user_id = ${userId}`
  if (!row) throw new HttpError(404, 'Session not found')
  return row
}

export async function ownedHand(userId, id) {
  const [row] = await sql`
    select h.* from tracker_hands h
    join tracker_sessions s on s.id = h.session_id
    where h.id = ${id} and s.user_id = ${userId}
  `
  if (!row) throw new HttpError(404, 'Hand not found')
  return row
}

export async function ownedOpponent(userId, id) {
  const [row] = await sql`select * from tracker_opponents where id = ${id} and user_id = ${userId}`
  if (!row) throw new HttpError(404, 'Opponent not found')
  return row
}

// --- Stats -------------------------------------------------------------------------------

const isJudged = (a) => a.probability !== null
const isLabeled = (a) => a.probability !== null && a.was_bluff !== null

// How often the estimate's side of 50% matched what the cards showed. Labelled bets only.
export function readAccuracy(actions) {
  const labeled = actions.filter(isLabeled)
  if (labeled.length === 0) return null
  const hits = labeled.filter((a) => a.probability >= BLUFF_THRESHOLD === a.was_bluff).length
  return hits / labeled.length
}

function counted(actions, field) {
  const counts = new Map()
  for (const action of actions) {
    for (const item of action[field] ?? []) {
      const entry = counts.get(item.code) ?? { code: item.code, label: item.description, count: 0 }
      entry.count += 1
      counts.set(item.code, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, TOP_ITEMS)
}

// Numbers shared by session and opponent summaries.
export function betStats(actions) {
  const judged = actions.filter(isJudged)
  const labeled = judged.filter(isLabeled)
  const bluffs = labeled.filter((a) => a.was_bluff).length
  return {
    judged_bets: judged.length,
    labeled_bets: labeled.length,
    bluffs,
    bluff_rate: labeled.length ? bluffs / labeled.length : null,
    average_read: judged.length ? judged.reduce((sum, a) => sum + a.probability, 0) / judged.length : null,
    read_accuracy: readAccuracy(actions),
  }
}

// `actions` are rows with probability already converted to a number (see withNumbers).
export function withNumbers(rows) {
  return rows.map((row) => ({ ...row, probability: row.probability === null ? null : Number(row.probability) }))
}

export function sessionSummary(session, handCount, actions) {
  const opponents = new Map()
  for (const action of actions) opponents.set(action.opponent_id, action.opponent_name)
  return {
    id: session.id,
    label: session.label,
    created_at: session.created_at,
    ended_at: session.ended_at,
    hands: handCount,
    opponents: [...opponents].map(([id, name]) => ({ id, name })),
    ...betStats(actions),
  }
}

export function opponentProfile(opponent, actions, sessions = []) {
  const handIds = new Set(actions.map((a) => a.hand_id))
  const sessionIds = new Set(actions.map((a) => a.session_id))
  return {
    opponent: { id: opponent.id, name: opponent.name },
    sessions: sessionIds.size,
    hands_seen: handIds.size,
    ...betStats(actions),
    top_reasons: counted(actions.filter(isJudged), 'reasons'),
    top_tells: counted(actions, 'tells'),
    recent_sessions: sessions.slice(0, RECENT_SESSIONS),
  }
}
