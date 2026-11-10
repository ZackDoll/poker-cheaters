import { randomBytes } from 'node:crypto'
import { createGoogleClient } from '../_lib/google.js'
import { setCookie, redirect, STATE_COOKIE } from '../_lib/session.js'

// Step 1: send the browser to Google's consent screen.
export default function handler(req, res) {
  const state = randomBytes(16).toString('hex')
  setCookie(res, STATE_COOKIE, state, { maxAge: 600 })

  const url = createGoogleClient().generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  })
  redirect(res, url)
}
