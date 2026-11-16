import { sql } from './_lib/db.js'
import { HttpError, idFrom, route } from './_lib/http.js'
import { opponentProfile, ownedOpponent, sessionSummary, withNumbers } from './_lib/tracker.js'

const MAX_NAME = 60
const MAX_OPPONENTS = 200

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!name) throw new HttpError(400, 'Give the opponent a name')
  if (name.length > MAX_NAME) throw new HttpError(400, `Names can be at most ${MAX_NAME} characters`)
  return name
}

// Unique violation on (user_id, lower(name)).
const isDuplicate = (error) => error?.code === '23505'

// Everything this user has logged for one opponent, newest first.
const actionsFor = (userId, opponentId) => sql`
  select a.*, o.name as opponent_name
  from tracker_actions a
  join tracker_opponents o on o.id = a.opponent_id
  where o.user_id = ${userId} and (${opponentId}::uuid is null or a.opponent_id = ${opponentId})
  order by a.created_at desc
`

async function recentSessions(userId, opponentId) {
  const sessions = await sql`
    select s.* from tracker_sessions s
    where s.user_id = ${userId}
      and exists (select 1 from tracker_actions a where a.session_id = s.id and a.opponent_id = ${opponentId})
    order by s.created_at desc
    limit 5
  `
  const summaries = []
  for (const session of sessions) {
    const [{ count }] = await sql`select count(*)::int as count from tracker_hands where session_id = ${session.id}`
    const rows = await sql`
      select a.*, o.name as opponent_name from tracker_actions a
      join tracker_opponents o on o.id = a.opponent_id
      where a.session_id = ${session.id}
    `
    summaries.push(sessionSummary(session, count, withNumbers(rows)))
  }
  return summaries
}

export default route({
  // No id: every opponent with their numbers. With ?id: one full profile.
  async GET({ user, query }) {
    if (query.id !== undefined) {
      const opponent = await ownedOpponent(user.id, idFrom(query.id))
      const actions = withNumbers(await actionsFor(user.id, opponent.id))
      return opponentProfile(opponent, actions, await recentSessions(user.id, opponent.id))
    }
    const opponents = await sql`select * from tracker_opponents where user_id = ${user.id} order by lower(name)`
    const actions = withNumbers(await actionsFor(user.id, null))
    return opponents.map((opponent) =>
      opponentProfile(
        opponent,
        actions.filter((a) => a.opponent_id === opponent.id),
      ),
    )
  },

  async POST({ user, body, res }) {
    const name = cleanName(body.name)
    const [{ count }] = await sql`select count(*)::int as count from tracker_opponents where user_id = ${user.id}`
    if (count >= MAX_OPPONENTS) throw new HttpError(400, 'Opponent limit reached')
    try {
      const [row] = await sql`
        insert into tracker_opponents (user_id, name) values (${user.id}, ${name}) returning *
      `
      res.statusCode = 201
      return { id: row.id, name: row.name }
    } catch (error) {
      if (isDuplicate(error)) throw new HttpError(409, `You already track someone called ${name}`)
      throw error
    }
  },

  async PATCH({ user, query, body }) {
    const opponent = await ownedOpponent(user.id, idFrom(query.id))
    const name = cleanName(body.name)
    try {
      await sql`update tracker_opponents set name = ${name} where id = ${opponent.id}`
    } catch (error) {
      if (isDuplicate(error)) throw new HttpError(409, `You already track someone called ${name}`)
      throw error
    }
    return { id: opponent.id, name }
  },

  // Deleting an opponent also deletes the actions logged against them.
  async DELETE({ user, query }) {
    const opponent = await ownedOpponent(user.id, idFrom(query.id))
    await sql`delete from tracker_opponents where id = ${opponent.id}`
    return { ok: true }
  },
})
