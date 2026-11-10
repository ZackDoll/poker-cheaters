import { timingSafeEqual } from 'node:crypto'
import { createGoogleClient } from '../../_lib/google.js'
import { sql } from '../../_lib/db.js'
import {
  getAppUrl,
  parseCookies,
  clearCookie,
  createSession,
  redirect,
  STATE_COOKIE,
} from '../../_lib/session.js'

function statesMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// Step 2: Google sends the user back here with ?code=...&state=...
export default async function handler(req, res) {
  const appUrl = getAppUrl()
  const failure = `${appUrl}/login?error=google`

  try {
    const params = new URL(req.url, appUrl).searchParams
    const expectedState = parseCookies(req)[STATE_COOKIE]
    clearCookie(res, STATE_COOKIE)

    if (params.get('error') || !params.get('code')) {
      return redirect(res, failure)
    }
    if (!statesMatch(params.get('state'), expectedState)) {
      return redirect(res, failure)
    }

    const client = createGoogleClient()
    const { tokens } = await client.getToken(params.get('code'))
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const profile = ticket.getPayload()

    const rows = await sql`
      insert into users (google_sub, email, name, avatar_url, last_login_at)
      values (${profile.sub}, ${profile.email || null}, ${profile.name || null}, ${profile.picture || null}, now())
      on conflict (google_sub) do update set
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        last_login_at = now()
      returning id
    `

    await createSession(res, rows[0].id, req.headers['user-agent'])
    redirect(res, `${appUrl}/live`)
  } catch (error) {
    console.error('Google login failed:', error.message)
    redirect(res, failure)
  }
}
