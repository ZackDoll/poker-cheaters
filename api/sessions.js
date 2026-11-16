import { sql } from './_lib/db.js'
import { HttpError, idFrom, route } from './_lib/http.js'
import { actionOut, handOut, ownedSession, sessionSummary, withNumbers } from './_lib/tracker.js'

const MAX_LABEL = 100
const LIST_LIMIT = 50

function cleanLabel(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new HttpError(400, 'Label must be text')
  const label = value.trim()
  if (label.length > MAX_LABEL) throw new HttpError(400, `Labels can be at most ${MAX_LABEL} characters`)
  return label || null
}

export default route({
  // No id: the user's sessions, newest first. With ?id: the whole session, hand by hand.
  async GET({ user, query }) {
    if (query.id !== undefined) {
      const session = await ownedSession(user.id, idFrom(query.id))
      const hands = await sql`select * from tracker_hands where session_id = ${session.id} order by number`
      const rows = await sql`
        select a.*, o.name as opponent_name from tracker_actions a
        join tracker_opponents o on o.id = a.opponent_id
        where a.session_id = ${session.id}
        order by a.created_at
      `
      const actions = withNumbers(rows)
      return {
        ...sessionSummary(session, hands.length, actions),
        hand_list: hands.map((hand) =>
          handOut(
            hand,
            rows.filter((a) => a.hand_id === hand.id).map(actionOut),
          ),
        ),
      }
    }

    const sessions = await sql`
      select * from tracker_sessions where user_id = ${user.id} order by created_at desc limit ${LIST_LIMIT}
    `
    const handCounts = await sql`
      select h.session_id, count(*)::int as count from tracker_hands h
      join tracker_sessions s on s.id = h.session_id
      where s.user_id = ${user.id}
      group by h.session_id
    `
    const rows = await sql`
      select a.*, o.name as opponent_name from tracker_actions a
      join tracker_opponents o on o.id = a.opponent_id
      join tracker_sessions s on s.id = a.session_id
      where s.user_id = ${user.id}
    `
    const actions = withNumbers(rows)
    return sessions.map((session) =>
      sessionSummary(
        session,
        handCounts.find((c) => c.session_id === session.id)?.count ?? 0,
        actions.filter((a) => a.session_id === session.id),
      ),
    )
  },

  async POST({ user, body, res }) {
    const [row] = await sql`
      insert into tracker_sessions (user_id, label) values (${user.id}, ${cleanLabel(body.label)}) returning *
    `
    res.statusCode = 201
    return sessionSummary(row, 0, [])
  },

  // Rename the session, or end it with { end: true }.
  async PATCH({ user, query, body }) {
    const session = await ownedSession(user.id, idFrom(query.id))
    const label = body.label === undefined ? session.label : cleanLabel(body.label)
    const [row] = await sql`
      update tracker_sessions
      set label = ${label}, ended_at = case when ${body.end === true}::boolean then coalesce(ended_at, now()) else ended_at end
      where id = ${session.id}
      returning *
    `
    return { id: row.id, label: row.label, ended_at: row.ended_at }
  },

  async DELETE({ user, query }) {
    const session = await ownedSession(user.id, idFrom(query.id))
    await sql`delete from tracker_sessions where id = ${session.id}`
    return { ok: true }
  },
})
