import { createHash, randomBytes } from 'node:crypto'
import { sql } from './db.js'

export const SESSION_COOKIE = 'tell_session'
export const STATE_COOKIE = 'tell_oauth_state'
const DAY_SECONDS = 24 * 60 * 60
const SESSION_MAX_AGE = 30 * DAY_SECONDS
// Sessions with less than this left are pushed back to the full 30 days.
const RENEW_BELOW_SECONDS = 15 * DAY_SECONDS

export function getAppUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function getRedirectUri() {
  return `${getAppUrl()}/api/auth/google/callback`
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function parseCookies(req) {
  const cookies = {}
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index > 0) {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
    }
  }
  return cookies
}

// Adds a Set-Cookie header without dropping any already set on the response.
export function setCookie(res, name, value, { maxAge } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge ?? 0}`,
  ]
  if (getAppUrl().startsWith('https://')) {
    parts.push('Secure')
  }
  const existing = res.getHeader('Set-Cookie') || []
  res.setHeader('Set-Cookie', [].concat(existing, parts.join('; ')))
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 })
}

export function redirect(res, location) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.end()
}

// Creates a login session, sets the cookie, and returns nothing.
export async function createSession(res, userId, userAgent) {
  const token = randomBytes(32).toString('base64url')
  await sql`
    insert into auth_sessions (user_id, token_hash, user_agent, expires_at)
    values (${userId}, ${hashToken(token)}, ${userAgent || null}, now() + make_interval(secs => ${SESSION_MAX_AGE}))
  `
  setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE })
}

// Returns the logged-in user for this request, or null.
// If `res` is given and the session is past its halfway point, it is renewed
// to the full 30 days (sliding expiry), so active users stay logged in.
export async function getUserFromRequest(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return null
  const tokenHash = hashToken(token)
  const rows = await sql`
    select u.id, u.email, u.name, u.avatar_url,
           extract(epoch from (s.expires_at - now())) as seconds_left
    from auth_sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.expires_at > now()
  `
  const row = rows[0]
  if (!row) return null

  if (res && Number(row.seconds_left) < RENEW_BELOW_SECONDS) {
    await sql`
      update auth_sessions
      set expires_at = now() + make_interval(secs => ${SESSION_MAX_AGE})
      where token_hash = ${tokenHash}
    `
    setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE })
  }

  const { seconds_left: _secondsLeft, ...user } = row
  return user
}

export async function destroySession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (token) {
    await sql`delete from auth_sessions where token_hash = ${hashToken(token)}`
  }
  clearCookie(res, SESSION_COOKIE)
}
