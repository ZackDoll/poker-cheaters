import { createHash, randomBytes } from 'node:crypto'
import { sql } from './db.js'

export const SESSION_COOKIE = 'tell_session'
export const STATE_COOKIE = 'tell_oauth_state'
const SESSION_DAYS = 30

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
  const maxAge = SESSION_DAYS * 24 * 60 * 60
  await sql`
    insert into auth_sessions (user_id, token_hash, user_agent, expires_at)
    values (${userId}, ${hashToken(token)}, ${userAgent || null}, now() + make_interval(secs => ${maxAge}))
  `
  setCookie(res, SESSION_COOKIE, token, { maxAge })
}

// Returns the logged-in user for this request, or null.
export async function getUserFromRequest(req) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return null
  const rows = await sql`
    select u.id, u.email, u.name, u.avatar_url
    from auth_sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
  `
  return rows[0] || null
}

export async function destroySession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (token) {
    await sql`delete from auth_sessions where token_hash = ${hashToken(token)}`
  }
  clearCookie(res, SESSION_COOKIE)
}
