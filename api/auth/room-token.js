import { createHmac } from 'node:crypto'
import { getUserFromRequest } from '../_lib/session.js'

const TOKEN_SECONDS = 60 * 60

// Signs a short-lived token that tells the game server (FastAPI) who this user is.
// Format: base64url(payload) + "." + base64url(HMAC-SHA256(secret, payload)).
// backend/app/services/room_token.py verifies it with the same secret.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const secret = process.env.ROOM_TOKEN_SECRET
  if (!secret) {
    res.status(503).json({ error: 'Live rooms are not configured' })
    return
  }
  try {
    const user = await getUserFromRequest(req, res)
    if (!user) {
      res.status(401).json({ error: 'Not logged in' })
      return
    }
    const expires = Math.floor(Date.now() / 1000) + TOKEN_SECONDS
    const payload = Buffer.from(
      JSON.stringify({
        sub: String(user.id),
        name: user.name || user.email || 'Player',
        avatar: user.avatar_url || null,
        exp: expires,
      }),
    ).toString('base64url')
    const signature = createHmac('sha256', secret).update(payload).digest('base64url')
    res.status(200).json({ token: `${payload}.${signature}`, expiresAt: expires * 1000 })
  } catch (error) {
    console.error('room-token failed:', error.message)
    res.status(500).json({ error: 'Server error' })
  }
}
